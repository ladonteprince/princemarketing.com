# GPT Image 2 + Seedance 2.0 — Prompt Share (@aimikoda / Kōda)

Source: https://x.com/aimikoda/status/2053053922332262547
Captured: 2026-05-09
Method: contemporary dance performance with simultaneous live singing
Image: `aimikoda_storyboard_prompt_share.jpg` (1672×941 — color-coded 12-panel storyboard)

---

## Parent post (status 2053053922332262547)

> **GPT Image 2 + Seedance 2.0 Prompt Share**
>
> Tried using IPA + FACS for a contemporary performance piece where live singing and choreography happen simultaneously. Not sure how much of it actually worked technically but I think the final result turned out pretty interesting.
>
> I also ended up color-coding the storyboard annotations because otherwise annotations were confusing the model. Different colors helped separate body movement, camera motion, framing and lighting directions from the actual environment and character drawings.
>
> You can find color-coded storyboard prompt + seedance 2.0 prompt in the replies.

Engagement: 26.8K views, 605 likes, 573 bookmarks, 83 reposts.

---

## Reply 1 — GPT Image 2 storyboard prompt (status 2053054407923626321)

> GPT Image 2 Prompt for the storyboard:
>
> Create a raw contemporary dance performance storyboard focused on intense physical movement and live singing. Use reference image for the character.
>
> 16:9 storyboard sheet, 12 cinematic panels. The actual storyboard drawings must be black and white only: rough pencil lines, minimal detail, fast gesture drawing energy, simple anatomy construction and strong silhouette readability. Keep the artwork lightweight, dynamic and unfinished like early choreography previs.
>
> A solitary female performer sings continuously while executing an emotionally charged contemporary dance routine inside a massive empty brutalist hall. The choreography is aggressive, fluid and constantly evolving: rapid turns, floor slides, crawling transitions, sharp body isolations, trembling hands, extreme balance shifts, hair whips, lunges, jumps, collapsing movements and distorted sculptural poses.
>
> Every panel must contain visible motion and strong body momentum. Avoid static standing poses. The performer should feel trapped between ritual, exhaustion and emotional release.
>
> Use cinematic arthouse camerawork with handheld energy, whip pans, orbit movement, overhead shots, side silhouettes, aggressive close-ups, long lens compression and extreme negative space.
>
> Keep the environment minimal: empty space, smoke, fabric motion, harsh light beams and wet floor reflections only.
>
> **Annotation color system:**
> - red arrows = body movement
> - blue arrows = camera movement
> - green marks = framing / composition notes
> - orange marks = lighting direction
> - purple marks = vocal / emotional emphasis
> - black text = short lens notes and panel labels
>
> No timestamps. End with one overwhelming final movement pose beneath a harsh isolated spotlight.

---

## Reply 2 — Seedance 2.0 video prompt (status 2053054787596255547)

> Seedance 2.0 Prompt:
>
> Use the storyboard reference @[storyboard ref] as the complete visual and choreography source for a 15-second video. Follow all 12 beats sequentially from left to right, top to bottom. Do not reinterpret the actions, poses, camera angles or emotional progression. Preserve the storyboard's shot order, movement logic, framing variety and final pose.
>
> Compress the full 12-beat sequence into 15 seconds. Each beat must appear clearly as a fast motion snapshot, not as a full-length action. Use urgent rhythm, quick cuts, match cuts and whip transitions. No pauses until the final beat.
>
> Keep the same single female performer @[character ref] identity from the character reference. Do not duplicate her. Continuous live singing throughout, with visible breath, mouth movement, body strain, fabric motion, floor contact and emotional escalation.
>
> Environment: massive empty brutalist hall, wet reflective floor, smoke, harsh light beams, minimal space. Cinematic arthouse camera energy: handheld movement, close-ups, overhead flashes, low angles, orbit motion and extreme negative space.
>
> Final beat holds for the last 1 seconds under one harsh isolated spotlight.
>
> Lyrics only once,
> IPA:
> /aɪ muːv θruː ˈsaɪləns/
> /ðə laɪt breɪks miː/
>
> FACS: AU1+AU4 tension, AU5 intensity, AU25 singing mouth, AU26 open release, AU43 exhausted blink.
>
> No text, no annotations, no timestamps, no watermark.

---

## Author's prompt-engineering reflection (status 2053087559291490669)

> It definitely affects the output, but we still don't have 100% control. A lot of the detail helps with consistency more than exact execution.
>
> One thing that helps is testing the prompt as a storyboard first with GPT Image 2 before sending it to a video model. You can quickly see if the framing, pacing and overall feel match what you imagined, then adjust the prompt before generating video.

---

## What's actually novel here (notes for our stack)

1. **IPA (International Phonetic Alphabet) for lyrics in video prompts.** Forces the model to render mouth shapes that sing the *correct* phonemes rather than generic mouthing. The two lines used:
   - `/aɪ muːv θruː ˈsaɪləns/` → "I move through silence"
   - `/ðə laɪt breɪks miː/` → "the light breaks me"

2. **FACS (Facial Action Coding System) AU references** for emotional facial control:
   - AU1 + AU4 = inner brow raise + brow lowerer → tension
   - AU5 = upper lid raiser → intensity / fear
   - AU25 = lips part → singing mouth
   - AU26 = jaw drop → open release
   - AU43 = eyes closed → exhausted blink

3. **Color-coded storyboard annotations** to separate semantic channels the model would otherwise blur together. Six channels: body, camera, framing, lighting, vocal, lens-notes.

4. **Storyboard-as-control-image workflow**: generate 12 panels with GPT Image 2 first → feed back into Seedance 2.0 as a single reference image with explicit "follow all 12 beats sequentially, do not reinterpret" constraint. This is image-as-shotlist, not just style reference.

5. **Time compression rule**: "Compress 12 beats into 15s. Each beat is a fast motion snapshot, not a full-length action." Important constraint to stop video models from dwelling on one panel.

---

## Application to our work

- **Storyboard agent (`/storyboard`)**: bake IPA + FACS slots into the prompt template for any music-video / vocal-performance scene. We're already using `nano-banana-pro` as default — same principle applies (B&W rough panels with annotation color key).
- **Veo 3.1 prompts**: add the "compress N beats into Ts, fast motion snapshots, no pauses until final beat" pattern to our `veo_interpolate` and `veo_text_to_video` workflows.
- **Multi-agent music video skill**: the Audio Psychologist agent should output FACS AU sequences per emotional beat; Subtitle Master should optionally output IPA alongside text for high-fidelity mouth sync.
