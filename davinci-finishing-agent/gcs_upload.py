"""GCS upload helper — push finished cuts back to the bucket."""
from __future__ import annotations

import logging
import mimetypes
from pathlib import Path
from datetime import datetime, timedelta, timezone

from google.cloud import storage  # type: ignore

from config import GCS_BUCKET

log = logging.getLogger("gcs_upload")


def upload_file(local_path: Path, dest_blob_name: str) -> str:
    """Upload a local file to GCS_BUCKET/dest_blob_name. Returns the public
    URL (signed for 30 days)."""
    client = storage.Client()
    bucket = client.bucket(GCS_BUCKET)
    blob = bucket.blob(dest_blob_name)

    content_type, _ = mimetypes.guess_type(str(local_path))
    blob.upload_from_filename(str(local_path), content_type=content_type or "application/octet-stream")

    # WHY: Signed URL valid for 30 days — short enough for security, long
    # enough that the user/clients can review without urgent re-signing.
    url = blob.generate_signed_url(
        version="v4",
        expiration=datetime.now(timezone.utc) + timedelta(days=30),
        method="GET",
    )
    log.info("Uploaded %s -> gs://%s/%s", local_path.name, GCS_BUCKET, dest_blob_name)
    return url


def make_blob_path(job_id: str, filename: str) -> str:
    """Standard GCS path layout: finishing/<jobId>/<filename>."""
    return f"finishing/{job_id}/{filename}"
