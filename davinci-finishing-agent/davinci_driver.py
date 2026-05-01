"""DaVinci Resolve driver — wraps the Python Scripting API.

This module assumes Resolve is running. It connects, creates projects,
builds timelines, applies LUTs, configures render presets per target
format, and runs the render queue. All clip files must be downloaded
to local disk first (Resolve cannot import remote URLs).

Spec for each format key — fed into Resolve's render settings dict:
"""
from __future__ import annotations

import sys
import time
import logging
from pathlib import Path
from typing import Any

from config import RESOLVE_SCRIPT_API, RESOLVE_SCRIPT_LIB

log = logging.getLogger("davinci_driver")


# ─── Format presets ────────────────────────────────────────────────────

# WHY: One source of truth for all output formats. The agent reads the
# job's target_formats list and converts each to a render setting dict.
# Resolve's render settings keys are NOT well-documented; this is the
# canonical surface our agent supports.
FORMAT_PRESETS: dict[str, dict[str, Any]] = {
    "tiktok-9x16": {
        "TargetDir": None,  # filled at runtime
        "CustomName": None,
        "ExportVideo": True,
        "ExportAudio": True,
        "FormatWidth": 1080,
        "FormatHeight": 1920,
        "FrameRate": "30",
        "VideoQuality": 0,  # auto/optimal
        "AudioCodec": "aac",
        "AudioBitDepth": "16",
        "AudioSampleRate": "48000",
        "ExportFormat": "MP4",
        "VideoCodec": "H.264",
    },
    "reels-9x16": {
        "FormatWidth": 1080,
        "FormatHeight": 1920,
        "FrameRate": "30",
        "ExportFormat": "MP4",
        "VideoCodec": "H.264",
    },
    "youtube-shorts-9x16": {
        "FormatWidth": 1080,
        "FormatHeight": 1920,
        "FrameRate": "30",
        "ExportFormat": "MP4",
        "VideoCodec": "H.264",
    },
    "youtube-16x9": {
        "FormatWidth": 1920,
        "FormatHeight": 1080,
        "FrameRate": "30",
        "ExportFormat": "MP4",
        "VideoCodec": "H.264",
    },
    "feed-1x1": {
        "FormatWidth": 1080,
        "FormatHeight": 1080,
        "FrameRate": "30",
        "ExportFormat": "MP4",
        "VideoCodec": "H.264",
    },
    "feed-4x5": {
        "FormatWidth": 1080,
        "FormatHeight": 1350,
        "FrameRate": "30",
        "ExportFormat": "MP4",
        "VideoCodec": "H.264",
    },
    "twitter-16x9": {
        "FormatWidth": 1280,
        "FormatHeight": 720,
        "FrameRate": "30",
        "ExportFormat": "MP4",
        "VideoCodec": "H.264",
    },
    "brand-film-16x9": {
        "FormatWidth": 3840,
        "FormatHeight": 2160,
        "FrameRate": "30",
        "ExportFormat": "MOV",
        "VideoCodec": "ProRes",
    },
}


# ─── Connection ────────────────────────────────────────────────────────

def get_resolve():
    """Connect to the running Resolve instance via the Scripting API.

    Raises if Resolve isn't running OR the env vars aren't set right.
    """
    # WHY: Python module is loaded from the Resolve install directory.
    # The user's .zshrc must have RESOLVE_SCRIPT_API exported and PYTHONPATH
    # pointing at $RESOLVE_SCRIPT_API/Modules.
    api_modules = Path(RESOLVE_SCRIPT_API) / "Modules"
    if str(api_modules) not in sys.path:
        sys.path.append(str(api_modules))

    try:
        import DaVinciResolveScript as dvr_script  # type: ignore
    except ImportError as exc:
        raise RuntimeError(
            f"DaVinciResolveScript not importable. Check PYTHONPATH includes {api_modules}. "
            f"Original error: {exc}"
        )

    resolve = dvr_script.scriptapp("Resolve")
    if not resolve:
        raise RuntimeError(
            "Resolve.scriptapp() returned None — is DaVinci Resolve running?"
        )
    return resolve


# ─── Project + timeline assembly ───────────────────────────────────────

def assemble_project(
    project_name: str,
    scene_paths: list[Path],
    score_path: Path | None,
    voiceover_path: Path | None,
    brand_lut: str | None,
) -> Any:
    """Create a project, build a timeline, return the project handle.

    Caller passes ALREADY-DOWNLOADED local file paths (Resolve can't import
    URLs). Scene order in the list = scene order in the timeline.
    """
    resolve = get_resolve()
    pm = resolve.GetProjectManager()

    # Close any open project so we don't accidentally clobber unsaved work.
    pm.CloseProject(pm.GetCurrentProject())

    project = pm.CreateProject(project_name)
    if not project:
        # If the name collides, append a timestamp.
        ts = int(time.time())
        project = pm.CreateProject(f"{project_name} {ts}")
    if not project:
        raise RuntimeError(f"Could not create project '{project_name}'")

    log.info("Created project: %s", project.GetName())
    media_pool = project.GetMediaPool()

    # Import all media (scenes + audio).
    media_paths = [str(p) for p in scene_paths]
    if score_path:
        media_paths.append(str(score_path))
    if voiceover_path:
        media_paths.append(str(voiceover_path))
    imported = media_pool.ImportMedia(media_paths)
    if not imported:
        raise RuntimeError("ImportMedia returned no clips — check file paths")

    log.info("Imported %d media items", len(imported))

    # Identify clips by name. Resolve doesn't preserve original order on
    # ImportMedia return, so we map by stem.
    by_stem = {Path(c.GetClipProperty("File Path") or "").stem: c for c in imported}
    scene_clips = [by_stem[p.stem] for p in scene_paths if p.stem in by_stem]
    score_clip = by_stem.get(score_path.stem) if score_path else None
    vo_clip = by_stem.get(voiceover_path.stem) if voiceover_path else None

    timeline_name = f"{project_name} — Master"
    timeline = media_pool.CreateTimelineFromClips(timeline_name, scene_clips)
    if not timeline:
        raise RuntimeError("CreateTimelineFromClips failed")

    project.SetCurrentTimeline(timeline)

    # WHY: Add audio tracks. Resolve auto-creates one audio track when a clip
    # has audio; for score + VO we want them on separate buses for sidechain
    # ducking later. v1 just appends to the timeline; Fairlight bus routing
    # is a future iteration.
    if score_clip:
        try:
            media_pool.AppendToTimeline([score_clip])
        except Exception as exc:
            log.warning("Score append failed: %s", exc)
    if vo_clip:
        try:
            media_pool.AppendToTimeline([vo_clip])
        except Exception as exc:
            log.warning("VO append failed: %s", exc)

    # WHY: Brand LUT — if supplied, attempts to apply at the timeline level
    # via a node-graph ColorCorrector. v1 is a no-op stub; full LUT apply
    # uses Resolve's color page DaVinciControl APIs which are more involved.
    if brand_lut:
        log.info("Brand LUT '%s' requested — apply step is a v1 stub", brand_lut)
        # TODO: Resolve Color page API to bind LUT to first node of every clip.

    return project


# ─── Render queue ──────────────────────────────────────────────────────

def queue_renders(
    project: Any,
    target_formats: list[str],
    output_dir: Path,
    project_name: str,
) -> list[Path]:
    """Queue one render job per target format. Returns the list of expected
    output file paths.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    expected: list[Path] = []

    for fmt in target_formats:
        preset = FORMAT_PRESETS.get(fmt)
        if not preset:
            log.warning("Unknown format key '%s' — skipping", fmt)
            continue

        ext = preset.get("ExportFormat", "MP4").lower()
        custom_name = f"{project_name}__{fmt}"
        out_path = output_dir / f"{custom_name}.{ext}"

        settings = dict(preset)
        settings["TargetDir"] = str(output_dir)
        settings["CustomName"] = custom_name

        if not project.SetRenderSettings(settings):
            log.warning("SetRenderSettings failed for %s", fmt)
            continue
        job_id = project.AddRenderJob()
        if not job_id:
            log.warning("AddRenderJob failed for %s", fmt)
            continue
        log.info("Queued render: %s → %s (job %s)", fmt, out_path.name, job_id)
        expected.append(out_path)

    return expected


def render_all(project: Any, expected_outputs: list[Path], poll_seconds: int = 5) -> None:
    """Start the render queue and block until all jobs report finished."""
    if not project.StartRendering():
        raise RuntimeError("StartRendering returned False — queue might be empty")

    # WHY: IsRenderingInProgress polls the queue. We check every poll_seconds.
    while project.IsRenderingInProgress():
        time.sleep(poll_seconds)
    log.info("All renders complete")

    missing = [p for p in expected_outputs if not p.exists()]
    if missing:
        raise RuntimeError(
            f"Render finished but {len(missing)} expected files missing: "
            + ", ".join(p.name for p in missing)
        )
