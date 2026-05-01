# DaVinci Finishing Agent

Local Python agent that runs on your Mac. Polls the production app for
finishing jobs, drives DaVinci Resolve via its Python Scripting API to
assemble + grade + render multi-format outputs, and uploads the finished
cuts back to GCS.

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

### 5. Run

Make sure DaVinci Resolve is running, then:

```bash
source .venv/bin/activate
python agent.py
```

You should see:
```
[2026-05-01 12:00:00] DaVinci Finishing Agent starting…
[2026-05-01 12:00:00] Resolve detected: 19.x  Studio: True
[2026-05-01 12:00:00] Polling https://princemarketing.com/api/finish/davinci/poll
```

Leave it running while you produce. When the strategist emits
`FINISH_IN_DAVINCI`, the agent picks the job up within 30s.

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
