# DaVinci Finishing Agent + `dvr` CLI

Two ways to drive Resolve from this directory:

1. **`finishing-agent`** — daemon that polls the production app for jobs,
   runs them through Resolve, uploads results to GCS. The chat-driven flow.
2. **`dvr` CLI** — one-shot commands for manual operation. Render an
   existing project, list projects, replay a job spec offline, etc.

Both share the same engine (`davinci_driver.py`), so what works in one
works in the other.

## What it does

1. Polls `https://princemarketing.com/api/finish/davinci/poll` every 30s
2. When a job is claimed:
   - Downloads scene clips + audio (score, voiceover) to local /tmp
   - Drives DaVinci Resolve (must be running) to:
     - Create a new project named after the job's `projectName`
     - Import all clips into the media pool
     - Build a timeline with scenes in order
     - Add audio tracks (score on bus 1, voiceover on bus 2)
     - Apply brand LUT if specified
     - For each target format (TikTok 9:16, YouTube 16:9, etc.):
       - Configure render settings (resolution, codec, bitrate)
       - Add a render job to the queue
     - Start the render queue, wait for completion
   - Uploads finished videos to GCS bucket
   - POSTs results to `/api/finish/davinci/update` with the GCS URLs
3. Loops back to polling

## Why this is local-only

DaVinci Resolve's Python API requires the Resolve application to be running.
That means it can't run on the Hostinger VPS — it has to run on the Mac
where Resolve is installed. This is a personal-production layer, not a
multi-tenant SaaS feature.

## Setup

### 1. Install Python dependencies

```bash
cd davinci-finishing-agent
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Configure DaVinci's Python API

DaVinci's scripting modules live in:
`/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Scripting`

The agent loads them via env vars. Add to your shell profile (`~/.zshrc`):

```bash
export RESOLVE_SCRIPT_API="/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Scripting"
export RESOLVE_SCRIPT_LIB="/Applications/DaVinci Resolve/DaVinci Resolve.app/Contents/Libraries/Fusion/fusionscript.so"
export PYTHONPATH="$PYTHONPATH:$RESOLVE_SCRIPT_API/Modules/"
```

Then `source ~/.zshrc`.

### 3. Configure the agent

Copy `.env.example` to `.env` and fill in:

```bash
cp .env.example .env
```

Required:
- `API_BASE` — your production URL (e.g. `https://princemarketing.com`)
- `FINISHING_AGENT_TOKEN` — shared secret. Must match the same value set
  in the production VPS `.env`. Generate with `openssl rand -hex 32`.
- `GCS_BUCKET` — bucket where finished videos upload (use the same one
  the rest of the production app uses)
- `GOOGLE_APPLICATION_CREDENTIALS` — path to a service-account JSON with
  Storage Object Creator role on `GCS_BUCKET`
- `POLL_INTERVAL_SECONDS` — default 30

### 4. Set the same token on the VPS

SSH to the production VPS and add:

```bash
echo "FINISHING_AGENT_TOKEN=<same-value-as-local>" >> /var/www/princemarketing.com/.env
pm2 restart princemarketing-com
```

### 5. Install the CLI + agent as console commands

From this directory, with your venv active:

```bash
pip install -e .
```

That gives you two commands in your venv:

- `dvr` — the CLI wrapper
- `finishing-agent` — the daemon

### 6. Run

Make sure DaVinci Resolve is running, then either:

```bash
# A) Run the polling agent (chat-driven flow)
finishing-agent

# B) One-shot CLI commands (manual flow)
dvr status
dvr projects
dvr presets
```

You should see:
```
[2026-05-01 12:00:00] DaVinci Finishing Agent starting…
[2026-05-01 12:00:00] Resolve detected: 19.x  Studio: True
[2026-05-01 12:00:00] Polling https://princemarketing.com/api/finish/davinci/poll
```

Leave it running while you produce. When the strategist emits
`FINISH_IN_DAVINCI`, the agent picks the job up within 30s.

## `dvr` CLI reference

```
dvr status                              # Check Resolve connection + config
dvr projects                            # List all Resolve projects
dvr presets                             # List supported render presets

dvr open NAME [--create]                # Open a project (or create if missing)

dvr render --formats KEYS [--project NAME] [--out DIR]
   # Queue and run renders for the current (or named) project.
   # KEYS: comma-separated preset keys, e.g. "tiktok-9x16,youtube-16x9"

dvr finish SPEC.json [--out DIR]
   # Replay a finishing job from a JSON spec (offline / debug flow).
   # Spec matches the polling-agent payload exactly.
```

### Quick examples

```bash
# 1. Health check (do this first, every session)
dvr status

# 2. Open the project that was created by the polling agent or in chat
dvr open "Flight 420 — Episode 03"

# 3. Render the current timeline to TikTok + YouTube formats
dvr render --formats tiktok-9x16,youtube-16x9 --out ~/Desktop/episode-03

# 4. Replay a job spec saved from the chat flow (great for debugging)
dvr finish ~/Desktop/job-spec.json --out ~/Desktop/episode-03-out
```

### Spec format for `dvr finish`

```json
{
  "projectName": "Flight 420 — Episode 03",
  "scenes": [
    {"sceneIndex": 0, "videoUrl": "file:///Users/black/clips/scene0.mp4", "durationSec": 5},
    {"sceneIndex": 1, "videoUrl": "file:///Users/black/clips/scene1.mp4", "durationSec": 5}
  ],
  "scoreUrl": "file:///Users/black/audio/score.mp3",
  "voiceoverUrl": "file:///Users/black/audio/vo.mp3",
  "targetFormats": ["tiktok-9x16", "youtube-16x9"],
  "brandLut": "flight420.cube"
}
```

URLs accept `file://`, `http://`, or `https://` (the latter two get
downloaded to `--out` first).

## Output formats

| Format key | Resolution | Aspect | Codec |
|---|---|---|---|
| `tiktok-9x16` | 1080×1920 | 9:16 | H.264 |
| `reels-9x16` | 1080×1920 | 9:16 | H.264 |
| `youtube-shorts-9x16` | 1080×1920 | 9:16 | H.264 |
| `youtube-16x9` | 1920×1080 | 16:9 | H.264 |
| `feed-1x1` | 1080×1080 | 1:1 | H.264 |
| `feed-4x5` | 1080×1350 | 4:5 | H.264 |
| `twitter-16x9` | 1280×720 | 16:9 | H.264 |
| `brand-film-16x9` | 3840×2160 | 16:9 | ProRes 422 HQ |

Add presets in `davinci_driver.py` → `FORMAT_PRESETS`.

## Troubleshooting

- **"Resolve not detected"**: Resolve isn't running, or the `PYTHONPATH`
  isn't set. Test with `python -c "import DaVinciResolveScript; print(DaVinciResolveScript.scriptapp('Resolve'))"`.
- **"Forbidden" on poll**: token mismatch. Verify `FINISHING_AGENT_TOKEN`
  is identical in `.env` (local) and `/var/www/princemarketing.com/.env`
  on the VPS.
- **GCS upload fails**: service account lacks `roles/storage.objectAdmin`.

## Versioning

Edit `AGENT_VERSION` in `config.py` whenever you ship updates. The version
gets persisted on every job for audit.
