"""DaVinci Finishing Agent — main poll loop.

Run on the Mac where DaVinci Resolve is installed. Resolve must be open
before starting the agent. The agent polls the production app for queued
finishing jobs, claims them, drives Resolve to assemble + render multi-
format outputs, uploads results to GCS, and reports completion.

Start:
    source .venv/bin/activate
    python agent.py

Stop:
    Ctrl-C
"""
from __future__ import annotations

import logging
import time
import shutil
import tempfile
from pathlib import Path
from typing import Any

import requests

import config
import davinci_driver
import gcs_upload

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("agent")


# ─── HTTP helpers ──────────────────────────────────────────────────────

def _headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {config.FINISHING_AGENT_TOKEN}",
        "Content-Type": "application/json",
    }


def poll_for_job() -> dict[str, Any] | None:
    url = f"{config.API_BASE}/api/finish/davinci/poll"
    resp = requests.get(url, headers=_headers(), timeout=30)
    if resp.status_code == 204:
        return None
    if resp.status_code != 200:
        log.error("Poll failed: %d %s", resp.status_code, resp.text[:200])
        return None
    return resp.json()


def update_job(
    job_id: str,
    status: str,
    result: Any | None = None,
    error: str | None = None,
) -> None:
    url = f"{config.API_BASE}/api/finish/davinci/update"
    body: dict[str, Any] = {
        "jobId": job_id,
        "status": status,
        "agentVersion": config.AGENT_VERSION,
    }
    if result is not None:
        body["result"] = result
    if error is not None:
        body["error"] = error
    resp = requests.post(url, headers=_headers(), json=body, timeout=30)
    if resp.status_code != 200:
        log.error("Update failed: %d %s", resp.status_code, resp.text[:200])


# ─── Download helpers ─────────────────────────────────────────────────

def download_to(url: str, dest: Path) -> Path:
    """Stream a URL to disk. Used for scene clips + audio."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    with requests.get(url, stream=True, timeout=300) as r:
        r.raise_for_status()
        with open(dest, "wb") as f:
            for chunk in r.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    f.write(chunk)
    return dest


# ─── Job runner ───────────────────────────────────────────────────────

def run_job(job: dict[str, Any]) -> None:
    """Execute one job end-to-end. Updates status throughout."""
    job_id = job["jobId"]
    spec = job["spec"]

    log.info("Job %s claimed — spec keys: %s", job_id, list(spec.keys()))

    project_name = spec.get("projectName") or f"PrinceMarketing — {job_id[:8]}"
    scenes = spec.get("scenes", [])
    score_url = spec.get("scoreUrl")
    voiceover_url = spec.get("voiceoverUrl")
    target_formats = spec.get("targetFormats", [])
    brand_lut = spec.get("brandLut")

    # Working directory unique per job, cleaned on success.
    work = Path(tempfile.mkdtemp(prefix=f"finishing-{job_id[:8]}-"))
    log.info("Work dir: %s", work)

    try:
        # 1. Download all media to local disk
        log.info("Downloading %d scenes + audio…", len(scenes))
        scene_paths: list[Path] = []
        for s in sorted(scenes, key=lambda x: x["sceneIndex"]):
            local = work / f"scene_{s['sceneIndex']:02d}.mp4"
            download_to(s["videoUrl"], local)
            scene_paths.append(local)

        score_path = download_to(score_url, work / "score.mp3") if score_url else None
        voiceover_path = (
            download_to(voiceover_url, work / "voiceover.mp3") if voiceover_url else None
        )

        # 2. Drive DaVinci to assemble project + timeline
        log.info("Assembling DaVinci project…")
        project = davinci_driver.assemble_project(
            project_name=project_name,
            scene_paths=scene_paths,
            score_path=score_path,
            voiceover_path=voiceover_path,
            brand_lut=brand_lut,
        )

        # 3. Queue render jobs per target format
        log.info("Queuing renders for: %s", target_formats)
        out_dir = work / "renders"
        expected = davinci_driver.queue_renders(project, target_formats, out_dir, project_name)
        if not expected:
            raise RuntimeError("No render jobs queued — all target formats unrecognized?")

        # 4. Run the queue (blocks until done)
        log.info("Rendering %d outputs…", len(expected))
        davinci_driver.render_all(project, expected)

        # 5. Upload to GCS
        log.info("Uploading %d outputs to GCS…", len(expected))
        outputs: list[dict[str, str]] = []
        for path, fmt in zip(expected, [f for f in target_formats if f in davinci_driver.FORMAT_PRESETS]):
            blob_path = gcs_upload.make_blob_path(job_id, path.name)
            url = gcs_upload.upload_file(path, blob_path)
            outputs.append({"format": fmt, "url": url, "filename": path.name})

        # 6. Report completion
        update_job(
            job_id,
            "COMPLETE",
            result={
                "outputs": outputs,
                "projectName": project_name,
                "renderedAt": time.time(),
            },
        )
        log.info("Job %s complete (%d outputs)", job_id, len(outputs))

    except Exception as exc:
        log.exception("Job %s failed", job_id)
        update_job(job_id, "FAILED", error=str(exc)[:1900])
    finally:
        shutil.rmtree(work, ignore_errors=True)


# ─── Main loop ────────────────────────────────────────────────────────

def main() -> None:
    log.info("DaVinci Finishing Agent v%s starting…", config.AGENT_VERSION)

    issues = config.validate()
    if issues:
        for i in issues:
            log.error("Config: %s", i)
        raise SystemExit(1)

    # Check Resolve is reachable on startup so we fail fast if not running.
    try:
        resolve = davinci_driver.get_resolve()
        version = resolve.GetVersionString() if hasattr(resolve, "GetVersionString") else "?"
        log.info("Resolve detected: %s", version)
    except RuntimeError as exc:
        log.error("Resolve not detected: %s", exc)
        log.error("Make sure DaVinci Resolve is running and PYTHONPATH includes:")
        log.error("  %s/Modules", config.RESOLVE_SCRIPT_API)
        raise SystemExit(1)

    log.info("Polling %s every %ds…", f"{config.API_BASE}/api/finish/davinci/poll", config.POLL_INTERVAL_SECONDS)

    try:
        while True:
            try:
                job = poll_for_job()
                if job:
                    run_job(job)
                    # Immediately poll again — there might be more queued.
                    continue
            except requests.RequestException as exc:
                log.warning("Poll request error: %s", exc)
            time.sleep(config.POLL_INTERVAL_SECONDS)
    except KeyboardInterrupt:
        log.info("Shutting down (Ctrl-C)…")


if __name__ == "__main__":
    main()
