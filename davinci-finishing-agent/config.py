"""Config loader — reads .env and exposes typed constants."""
import os
from pathlib import Path

try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).parent / ".env")
except ImportError:
    pass

AGENT_VERSION = "0.1.0"

API_BASE: str = os.environ.get("API_BASE", "").rstrip("/")
FINISHING_AGENT_TOKEN: str = os.environ.get("FINISHING_AGENT_TOKEN", "")
GCS_BUCKET: str = os.environ.get("GCS_BUCKET", "")
POLL_INTERVAL_SECONDS: int = int(os.environ.get("POLL_INTERVAL_SECONDS", "30"))

# WHY: Default macOS paths. Override via env if Resolve is in a non-standard
# location.
RESOLVE_SCRIPT_API_DEFAULT = (
    "/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Scripting"
)
RESOLVE_SCRIPT_LIB_DEFAULT = (
    "/Applications/DaVinci Resolve/DaVinci Resolve.app/Contents/Libraries/Fusion/fusionscript.so"
)
RESOLVE_SCRIPT_API: str = os.environ.get("RESOLVE_SCRIPT_API", RESOLVE_SCRIPT_API_DEFAULT)
RESOLVE_SCRIPT_LIB: str = os.environ.get("RESOLVE_SCRIPT_LIB", RESOLVE_SCRIPT_LIB_DEFAULT)


def validate() -> list[str]:
    """Return a list of missing/invalid config items (empty = OK)."""
    issues: list[str] = []
    if not API_BASE:
        issues.append("API_BASE not set")
    if not FINISHING_AGENT_TOKEN:
        issues.append("FINISHING_AGENT_TOKEN not set (must match VPS .env)")
    if not GCS_BUCKET:
        issues.append("GCS_BUCKET not set")
    if POLL_INTERVAL_SECONDS < 5 or POLL_INTERVAL_SECONDS > 600:
        issues.append("POLL_INTERVAL_SECONDS out of range (5-600)")
    return issues
