"""dvr — local CLI for DaVinci Resolve automation.

Drives a running Resolve instance via the Python Scripting API. Same engine
as the polling agent, exposed as one-shot commands. Useful for:
  - Manual renders without waiting for the chat-driven flow
  - Quick "is Resolve reachable?" health checks
  - Running a finishing job from a local JSON spec (offline replay)
  - Inspecting projects and FORMAT_PRESETS

Install (from this directory, with venv active):
    pip install -e .
Then `dvr --help` is available.

Without install, you can still run:
    python cli.py <subcommand>
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
import time
from pathlib import Path
from typing import Any

import config
import davinci_driver

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("dvr")


# ─── Subcommand handlers ──────────────────────────────────────────────


def cmd_status(_args: argparse.Namespace) -> int:
    """Report whether Resolve is reachable + agent config sanity."""
    print("Agent version:", config.AGENT_VERSION)
    issues = config.validate()
    if issues:
        print("\nConfig issues:")
        for i in issues:
            print(f"  - {i}")
    else:
        print("Config: OK")

    print("\nDaVinci Resolve:")
    try:
        resolve = davinci_driver.get_resolve()
        version = (
            resolve.GetVersionString()
            if hasattr(resolve, "GetVersionString")
            else "?"
        )
        pm = resolve.GetProjectManager()
        current = pm.GetCurrentProject()
        current_name = current.GetName() if current else "(none)"
        print(f"  Connection: OK")
        print(f"  Version:    {version}")
        print(f"  Current project: {current_name}")
        return 0
    except RuntimeError as exc:
        print(f"  Connection: FAILED — {exc}")
        print("  Hint: make sure Resolve is running, and PYTHONPATH includes")
        print(f"        {config.RESOLVE_SCRIPT_API}/Modules")
        return 2


def cmd_projects(_args: argparse.Namespace) -> int:
    """List all DaVinci projects in the current project library."""
    try:
        resolve = davinci_driver.get_resolve()
    except RuntimeError as exc:
        print(f"FAILED: {exc}")
        return 2
    pm = resolve.GetProjectManager()
    names = pm.GetProjectListInCurrentFolder() or []
    current = pm.GetCurrentProject()
    current_name = current.GetName() if current else None
    if not names:
        print("(no projects)")
        return 0
    for n in names:
        marker = "*" if n == current_name else " "
        print(f"{marker} {n}")
    return 0


def cmd_presets(_args: argparse.Namespace) -> int:
    """List FORMAT_PRESETS — the multi-format output keys we support."""
    print(f"{'KEY':<22} {'WIDTH':>6} {'HEIGHT':>6}  {'CODEC':<10} {'CONTAINER':<10}")
    print("-" * 60)
    for key, preset in davinci_driver.FORMAT_PRESETS.items():
        print(
            f"{key:<22} {preset.get('FormatWidth', '?'):>6} "
            f"{preset.get('FormatHeight', '?'):>6}  "
            f"{preset.get('VideoCodec', '?'):<10} "
            f"{preset.get('ExportFormat', '?'):<10}"
        )
    return 0


def cmd_open(args: argparse.Namespace) -> int:
    """Open an existing project by name (or create if --create)."""
    try:
        resolve = davinci_driver.get_resolve()
    except RuntimeError as exc:
        print(f"FAILED: {exc}")
        return 2
    pm = resolve.GetProjectManager()
    project = pm.LoadProject(args.name)
    if project:
        print(f"Loaded: {args.name}")
        return 0
    if args.create:
        project = pm.CreateProject(args.name)
        if project:
            print(f"Created and opened: {args.name}")
            return 0
    print(f"Project '{args.name}' not found. Use --create to create it.")
    return 1


def cmd_render(args: argparse.Namespace) -> int:
    """Queue + run renders for the currently-loaded (or named) project.

    Reads target formats from --formats (comma-separated list of preset keys).
    """
    try:
        resolve = davinci_driver.get_resolve()
    except RuntimeError as exc:
        print(f"FAILED: {exc}")
        return 2
    pm = resolve.GetProjectManager()
    if args.project:
        project = pm.LoadProject(args.project)
        if not project:
            print(f"Project '{args.project}' not found")
            return 1
    else:
        project = pm.GetCurrentProject()
        if not project:
            print("No project loaded. Pass --project NAME or open one first.")
            return 1

    project_name = project.GetName()
    target_formats = [f.strip() for f in args.formats.split(",") if f.strip()]
    if not target_formats:
        print("No formats. Pass --formats tiktok-9x16,youtube-16x9 (etc.)")
        return 1

    out_dir = Path(args.out).expanduser().resolve()
    print(f"Project:  {project_name}")
    print(f"Output:   {out_dir}")
    print(f"Formats:  {', '.join(target_formats)}")

    expected = davinci_driver.queue_renders(project, target_formats, out_dir, project_name)
    if not expected:
        print("No render jobs queued — formats may all be unrecognized.")
        return 1

    print(f"\nQueued {len(expected)} render jobs. Starting…")
    t0 = time.time()
    davinci_driver.render_all(project, expected)
    dt = time.time() - t0
    print(f"\nDone in {dt:.1f}s. Outputs:")
    for p in expected:
        size = p.stat().st_size if p.exists() else 0
        print(f"  {p.name}  ({size / 1024 / 1024:.1f} MB)")
    return 0


def cmd_finish(args: argparse.Namespace) -> int:
    """Run a finishing job from a local JSON spec (offline replay).

    Spec format matches the polling-agent payload exactly:
      {
        "projectName": "Flight 420 — Episode 03",
        "scenes": [{"sceneIndex": 0, "videoUrl": "file:///path/scene0.mp4", ...}],
        "scoreUrl": "file:///path/score.mp3",
        "voiceoverUrl": "file:///path/vo.mp3",
        "targetFormats": ["tiktok-9x16", "youtube-16x9"],
        "brandLut": "flight420.cube"
      }

    URLs may be file:// or http(s):// — http(s) downloads to /tmp first.
    """
    spec_path = Path(args.spec).expanduser().resolve()
    if not spec_path.exists():
        print(f"Spec not found: {spec_path}")
        return 1

    spec: dict[str, Any] = json.loads(spec_path.read_text())
    out_dir = Path(args.out).expanduser().resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    project_name = spec.get("projectName") or f"dvr-cli-{int(time.time())}"
    scenes = sorted(spec.get("scenes", []), key=lambda s: s["sceneIndex"])
    target_formats = spec.get("targetFormats", [])

    if not scenes or not target_formats:
        print("Spec missing scenes or targetFormats")
        return 1

    # Resolve URLs to local paths (file:// or http(s)://).
    scene_paths: list[Path] = []
    for s in scenes:
        local = _resolve_url(s["videoUrl"], out_dir / f"scene_{s['sceneIndex']:02d}.mp4")
        scene_paths.append(local)

    score_path = (
        _resolve_url(spec["scoreUrl"], out_dir / "score.mp3") if spec.get("scoreUrl") else None
    )
    voiceover_path = (
        _resolve_url(spec["voiceoverUrl"], out_dir / "voiceover.mp3")
        if spec.get("voiceoverUrl")
        else None
    )

    project = davinci_driver.assemble_project(
        project_name=project_name,
        scene_paths=scene_paths,
        score_path=score_path,
        voiceover_path=voiceover_path,
        brand_lut=spec.get("brandLut"),
    )
    expected = davinci_driver.queue_renders(project, target_formats, out_dir, project_name)
    if not expected:
        print("No render jobs queued")
        return 1
    print(f"Queued {len(expected)} renders, starting…")
    davinci_driver.render_all(project, expected)
    print("\nFinished. Outputs:")
    for p in expected:
        print(f"  {p}")
    return 0


def _resolve_url(url: str, dest: Path) -> Path:
    """If url is file://, return its local path. Else download to dest."""
    if url.startswith("file://"):
        return Path(url[len("file://"):])
    if url.startswith("http://") or url.startswith("https://"):
        import requests  # local import to avoid hard dep when not used
        log.info("Downloading %s -> %s", url, dest)
        with requests.get(url, stream=True, timeout=300) as r:
            r.raise_for_status()
            with open(dest, "wb") as f:
                for chunk in r.iter_content(chunk_size=1024 * 1024):
                    if chunk:
                        f.write(chunk)
        return dest
    # Otherwise treat as a local path
    return Path(url)


# ─── Entry point ──────────────────────────────────────────────────────


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="dvr",
        description="Local CLI for DaVinci Resolve automation (Prince Marketing finishing agent)",
    )
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("status", help="Check Resolve connection + config")
    sub.add_parser("projects", help="List Resolve projects")
    sub.add_parser("presets", help="List supported FORMAT_PRESETS")

    sp_open = sub.add_parser("open", help="Open an existing project (--create to create)")
    sp_open.add_argument("name", help="Project name")
    sp_open.add_argument(
        "--create", action="store_true", help="Create the project if it doesn't exist"
    )

    sp_render = sub.add_parser(
        "render", help="Queue + run renders for the current/named project"
    )
    sp_render.add_argument(
        "--project", help="Project name (default: currently loaded)"
    )
    sp_render.add_argument(
        "--formats",
        required=True,
        help="Comma-separated preset keys (e.g. tiktok-9x16,youtube-16x9)",
    )
    sp_render.add_argument(
        "--out",
        default="./renders",
        help="Output directory (default: ./renders)",
    )

    sp_finish = sub.add_parser(
        "finish", help="Run a full finishing job from a local JSON spec"
    )
    sp_finish.add_argument("spec", help="Path to JSON spec (matches agent payload)")
    sp_finish.add_argument(
        "--out",
        default="./finishing-out",
        help="Working + output directory",
    )

    return p


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    handler = {
        "status": cmd_status,
        "projects": cmd_projects,
        "presets": cmd_presets,
        "open": cmd_open,
        "render": cmd_render,
        "finish": cmd_finish,
    }[args.cmd]
    return handler(args)


if __name__ == "__main__":
    sys.exit(main())
