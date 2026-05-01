# Muapi vs. Prince Marketing Stack — Capability Gap Analysis

**Date:** 2026-04-30
**Subject:** What new "superpowers" Muapi exposes vs. our current stack
**Author:** Sales / Engineering brief

---

## Executive Summary

**Where we stand:** our stack is already mature on the **video pipeline** (Seedance 2 + Lyria 3 + ElevenLabs + Gemini Director + Pinecone Production Brain) and uses Nano Banana Pro for image references. The .com is the UI; the .ai backend orchestrates models.

**The gaps that matter for the $10K/mo agency offer (in priority order):**

| Priority | Capability | Status | Business impact |
|---|---|---|---|
| 🔴 HIGH | **Seedance 2 Omni Reference Train** (real face identity lock) | ❌ Not exposed | Solves "character drift" — the #1 risk in selling AI series |
| 🔴 HIGH | **GPT Image 2** for hero/ad creative with text overlays | ❌ Not exposed | Better text-in-image + 20,000-char prompts — directly useful for ad creative |
| 🟡 MED | **1080p / VIP quality tiers** for video | ❌ No `quality` field in schema | Production-grade output for premium clients |
| 🟡 MED | **HeyGen Video Translate** ($0.05/sec) | ❌ Not exposed | Powers the localization service tier ($500–$1,500/lang) |
| 🟢 LOW | Alternative video models (Veo 4, Sora 2, Kling 3.0 4K, WAN 2.7) | ❌ Not exposed | Variety / fallback — not yet needed |

**Bottom line:** two changes to `action-validation.ts` and two new API routes unlock the most commercially-relevant superpowers. ~1 day of work.

---

## 1. Current Stack Snapshot

Mapped from `src/lib/action-validation.ts` and `src/app/api/generate/*` routes:

### Video
- **Seedance 2** — text-to-video, image-to-video, character mode, extend, first-last-frame interpolation ("Lock Endpoints")
- Schema: `prompt`, `scenes[{prompt, duration: 5-15s}]`, `mode: t2v|i2v|character|extend`, `aspectRatio: 16:9|9:16|1:1`, `fast: boolean`
- Backend proxy: `princemarketing.ai/api/v1/generate/video/*`

### Image
- **Nano Banana Pro** — multi-image reference sheets (up to 20 input images per `CREATE_REFERENCE_FROM_PHOTOS`)
- **No standalone hero/ad image gen path** — only reference-sheet generation

### Audio
- **Lyria 3** — score-first pipeline, 3 track options in parallel via `CREATE_SCORE`, then `GENERATE_SCORE` runs the Sound Director
- **ElevenLabs** — AI voiceover via `OFFER_VOICEOVER` / `GENERATE_VOICEOVER`
- **Karaoke** — user records own voiceover via `OPEN_KARAOKE`

### Director / Brain
- **Gemini** — prompt enrichment before Seedance calls
- **Pinecone** — 125-vector research corpus (Attention Architecture, Storylocks, neurochemistry, cinematography) via `QUERY_PRODUCTION_BRAIN`

### Distribution / Scheduling
- `DISTRIBUTE`, `SCHEDULE_POST`, `PUBLISH_NOW` across Meta / Google / TikTok / LinkedIn / etc.
- `GET_ANALYTICS`, `GET_ADS_ANALYTICS`, `SCORE_CONTENT` (Attention Architecture scoring — 6 Storylocks + 6 Dopamine Ladder levels)

---

## 2. Muapi Catalog — What's Available

Muapi is an aggregator. They wrap and resell access to ~100+ models across video, image, and audio. Below is the inventory relevant to our use cases.

### Video Models on Muapi (selection)

| Model | Variants | Notable feature |
|---|---|---|
| **Seedance 2** | Pro T2V, Pro T2V Fast, Lite T2V, Pro I2V, Pro I2V Fast, Lite I2V, Video Extend, Video Extend Fast | Same model we already use |
| **SD 2.0** (sibling) | VIP, 1080p VIP, 480p, Watermark Remover | **Higher-quality VIP tier — not in our stack** |
| **Veo 4** | Text-to-Video, Image-to-Video | Newer than our Veo |
| **Veo 3.1** | Fast, Reference, Lite, 4K | 4K output, multi-reference |
| **Sora 2** | Standard, Pro, Storyboard, Image-to-Video | Storyboard mode is unique |
| **Kling 3.0** | Standard, Pro, 4K Pro, Motion Control | 4K + motion control |
| **WAN 2.7** | T2V, Reference-to-Video | Frequently free / very cheap |
| **LTX-2** | 19B, Pro, Fast, 2.3 LipSync | Fast iterations |
| **PixVerse v6** | Image, Transition modes | |
| **Minimax Hailuo 2.3** | Standard, Pro, Fast | |
| **Happy Horse 1.0** | 1080p, 720p, Reference 1080p | |
| **Runway** | Act Two, Aleph, V2V | |

### Image Models on Muapi (selection)

| Model | Variants | Notable feature |
|---|---|---|
| **Nano Banana** | Pro, 2, Effects, Edit, Pro Edit | We use Pro |
| **GPT Image 2** | T2I, I2I | **20,000-char prompts, best text-in-image** |
| **Flux** | Dev, Redux, Krea Dev, Kontext Pro, 2 Dev/Flex/Pro, Klein | High realism |
| **Ideogram v3** | Reframe, Character | Character consistency |
| **Google Imagen 4** | Fast, Ultra | High quality |
| **Qwen** | Image, 2.0 Pro | Strong on Chinese / multilingual |
| **Midjourney Niji** | — | Anime / stylized |
| **SOUL** | — | Hyper-realistic fashion / lifestyle |

### Specialty / Post-Production

- **AI Face Swap, AI Background Remover, AI Object Eraser** — post-production tools
- **AI Product Shot, AI Product Photography** — e-commerce
- **AI Image Upscaler, SeedVR2 Upscale, Topaz Image Upscale** — final polish
- **HeyGen Video Translate** — $0.05/sec for video localization (relevant to our localization tier!)
- **Sync LipSync, LatentSync, Creatify LipSync** — lip sync for AI talking heads

---

## 3. The Gap Analysis — "New Superpowers" Worth Adopting

### 🔴 GAP 1: Seedance 2 Omni Reference Train (Real Face Identity Lock)

**What it is:** Muapi rolled this out April 10. New mode that *trains* on a person's face/character and preserves identity across generations. Distinct from standard reference images — this is identity *learning*, not reference matching.

**Endpoint (per Muapi email):** `https://muapi.ai/playground/seedance-2-omni-reference-train`

**Why it's the #1 superpower for us:**
- Our agency offer sells **AI series** — same character every episode
- Biggest technical risk: episode 4 character doesn't look like episode 1 → brand cancels contract
- Standard `ADD_REFERENCE_IMAGE` matches against *images*; Omni Train binds to *identity*
- Differentiator vs. competitors using Veo 3.1 reference (capped at 3 refs, weak on real faces)

**Current schema can't express this.** `ADD_REFERENCE_IMAGE` only attaches a URL + label; no training step.

**Recommended addition to `action-validation.ts`:**
```ts
const TrainCharacterIdentityAction = z.object({
  action: z.literal("TRAIN_CHARACTER_IDENTITY"),
  videoProjectId: VideoProjectIdSchema,
  characterLabel: z.string().max(100),  // e.g. "@LaDonte"
  trainingImages: z.array(z.string().url()).min(3).max(20),
  preservationStrength: z.enum(["soft", "balanced", "strict"]).optional(),
});
```

Plus a new API route at `/api/generate/character/train` that proxies to the .ai backend's Seedance Omni Train endpoint.

---

### 🔴 GAP 2: GPT Image 2 for Hero/Ad Creative

**What it is:** OpenAI's latest image gen, available on Muapi since April 21. Standout features:
- **20,000-character prompts** (vs. Nano Banana's much shorter context)
- **Best-in-class text rendering inside images** (logos, ad copy, captions baked in)
- **Complex grid layouts** (10×10 grids effortlessly — useful for mood boards, thumbnail sheets)
- **More photorealistic outputs** than Nano Banana for hero/ad

**Endpoint (per Muapi):** `https://muapi.ai/playground/gpt-image-2-image-to-image`

**Where it fills a gap:** our stack uses Nano Banana Pro for reference sheets (multi-image input). We have **no standalone image-gen path for hero ad creative or thumbnails** — `CREATE_IMAGE` action exists in schema but I couldn't find an active route wired to it in `src/app/api/generate/`.

**Recommended:**
- Wire up `CREATE_IMAGE` action to a new `/api/generate/image/gpt2` route
- Add `model` field to schema: `z.enum(["gpt-image-2", "nano-banana-pro", "flux-2", "imagen-4"]).default("gpt-image-2")`
- Use GPT Image 2 as the default for hero/ad creative; keep Nano Banana for multi-ref sheets

---

### 🟡 GAP 3: Quality Tier Flag (1080p / VIP / Fast)

**What it is:** Seedance 2 (since April 17) supports 1080p generation, plus VIP variants for higher quality. Today our schema has only a `fast: boolean` flag.

**Why it matters:**
- Premium clients ($8.5K+/mo Brand tier) expect production-grade 1080p+
- Pilot clients ($3K/mo) can run at standard quality to keep margins healthy
- Current schema can't express the trade-off — every client gets the same render quality

**Recommended schema change:**
```ts
// In CreateVideoAction
quality: z.enum(["lite", "standard", "vip", "1080p-vip"]).default("standard"),
resolution: z.enum(["480p", "720p", "1080p", "4k"]).optional(),
```

Cluely context (`docs/sales/cluely-context.md`) should map tiers → quality:
- Pilot ($3K/mo) → `standard`
- Series ($5K/mo) → `standard` or `vip` for hero pieces
- Brand ($8.5K+/mo) → `vip` or `1080p-vip`
- Always-On / Enterprise → `1080p-vip` + 4K when needed

---

### 🟡 GAP 4: HeyGen Video Translate (Localization Service)

**What it is:** Muapi exposes HeyGen's video translation at **$0.05/sec**. That's $1.50 for a 30-sec ad. We can resell at $500–$1,500/language and run 90%+ margins.

**Already in our service catalog (`cluely-context.md`):** "Localization (per language) — $500–$1,500." But no implementation backing it.

**Recommended:**
- Add a `LOCALIZE_VIDEO` action and route
- Schema: `videoUrl`, `targetLanguages: string[]`, `preserveVoice: boolean`
- Wire to Muapi's HeyGen endpoint via the .ai backend

---

### 🟢 GAP 5: Alternative Video Models (low priority)

Muapi exposes Veo 4, Sora 2 Storyboard, Kling 3.0 4K, LTX-2, WAN 2.7. **Not urgent** — Seedance 2 is our differentiator and we shouldn't dilute the pipeline. Add later only if a client requests a specific look.

---

## 4. GPT Image 2 vs. Nano Banana — Honest Comparison

You said GPT Image 2 "seems superior to Nano Banana." **Partially true, with caveats.**

### Where GPT Image 2 wins
| Strength | Why it matters |
|---|---|
| **Text rendering inside images** | Ad creative with copy baked in, logos, captions — huge for our paid social work |
| **Complex grids / layouts** | 10×10 thumbnail sheets, mood boards |
| **20,000-char prompts** | Lets you brief the model with full creative direction in one shot |
| **Photorealism** | Higher fidelity for hero shots and product photography |

### Where Nano Banana wins (don't kill it)
| Strength | Why we keep it |
|---|---|
| **Multi-image input (up to 20 refs)** | This is exactly how we build reference sheets for character/prop/environment consistency |
| **Identity preservation across many refs** | Our reference-sheet flow depends on this |
| **Tight Gemini integration** | Already uses our Director + Lyria credentials |
| **Cheaper per generation** (typically) | Margin protection for `Pilot` tier |

### Verdict

**Add GPT Image 2 — don't replace Nano Banana.** They serve different jobs:

- **GPT Image 2:** hero shots, ad creative with text, mood boards, single-ref or text-only generation
- **Nano Banana Pro:** multi-image reference sheets, character/prop/environment lock, anything where identity must hold across many input photos

Default routing rule:
- If `imageUrls.length >= 3` and intent is "reference sheet" → Nano Banana Pro
- Otherwise → GPT Image 2

---

## 5. Recommended Build Sequence

If we ship in this order, each step delivers an independent commercial benefit:

### Day 1 (highest leverage)
1. Add `TRAIN_CHARACTER_IDENTITY` action + `/api/generate/character/train` route → unlocks **character-locked series** (the #1 sales differentiator)
2. Update `cluely-context.md` to mention "Seedance 2 Omni Reference Train — real face identity lock" as a differentiator on sales calls

### Day 2
3. Wire `CREATE_IMAGE` to a new `/api/generate/image/gpt2` route → unlocks **hero/ad creative with text** at GPT Image 2 quality
4. Add `model` enum to `CreateImageAction` schema with smart routing

### Day 3
5. Add `quality` + `resolution` enums to `CreateVideoAction` schema → unlocks **tier-aligned production quality**
6. Map quality tiers to Pilot/Series/Brand/Enterprise pricing

### Day 4 (when first localization client asks)
7. Add `LOCALIZE_VIDEO` action + HeyGen Video Translate route → activates the localization service tier

---

## 6. Open Questions / What We Still Need

1. **Muapi API docs** — their public docs page returned 404 / connection refused on `/docs`, `docs.muapi.ai`, `/api`. Endpoint paths and request schemas need to be pulled from the actual playground or by emailing `support@muapi.ai`. **Recommendation:** reply to one of their announcement emails asking for the dev docs link.
2. **.ai backend integration path** — current architecture proxies through `princemarketing.ai`. Need to confirm whether new Muapi-sourced endpoints (Omni Train, GPT Image 2, HeyGen Translate) get added there or directly in the .com `/api/generate/*` routes.
3. **Pricing per call** — Muapi's homepage doesn't expose most pricing. Need a Muapi account login to see the per-call cost matrix. Without it we can't compute true margin per agency tier.
4. **Quota model** — does our .ai backend have rate limits that would conflict with new model additions? Today the `interpolate` route does `checkRateLimit('interpolate:${email}', 10)`. Each new model needs a similar rate-limit bucket.

---

## 7. Where We Stand — Honest Read

| Capability | Status |
|---|---|
| Score-first audio pipeline (Lyria 3) | ✅ Best-in-class, no peer matches this |
| Production Brain (125-vector research) | ✅ Unique moat, not replicable on Muapi |
| Seedance 2 video pipeline | ✅ Mature, with first-last-frame ("Lock Endpoints") |
| Nano Banana reference sheets | ✅ Solid foundation |
| **Character-locked series at production scale** | ⚠️ **Vulnerable** — current `ADD_REFERENCE_IMAGE` is matching, not training |
| **Hero/ad creative with text-in-image** | ⚠️ Gap — Nano Banana is wrong tool, GPT Image 2 is right |
| **Premium quality tier (1080p VIP)** | ⚠️ Schema can't express it |
| **Localization service** | ❌ Sold but not built |

**TL;DR:** the **Director + Brain + Score** layers are already best-in-class and would be expensive for a competitor to replicate. The **gaps are at the model-execution layer** — and Muapi sells the missing pieces off the shelf. Closing them is small surface area: ~4 days of work for a meaningful capability lift.

---

*End of analysis*
