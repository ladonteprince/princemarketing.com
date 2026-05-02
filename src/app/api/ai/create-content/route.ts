import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { claude, STRATEGIST_SYSTEM_PROMPT } from "@/lib/claude";
import { checkRateLimit } from "@/lib/rate-limiter";
import { compactMessages, type CompactableChatMessage } from "@/lib/chat-compaction";
import { buildUserContext } from "@/lib/social/indexer";
import { db } from "@/lib/db";
import {
  analyzePerformance,
  generateRecommendations,
  generateWeeklySummary,
  type AnalyzablePost,
} from "@/lib/agents/analytics-agent";
import {
  learnBrandVoice,
  generateVariants,
  brandVoiceToPrompt,
} from "@/lib/agents/content-agent";
import { fetchAllPlatformAnalytics } from "@/lib/social/analytics";
import { z } from "zod";
import {
  validateActions,
  sanitizeExternalContext,
  validateOutput,
  auditPromptBuild,
} from "@/lib/action-validation";

const requestSchema = z.object({
  sessionId: z.string(),
  message: z.string().min(1),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
    )
    .optional(),
  existingNodes: z
    .array(
      z.object({
        id: z.string(),
        type: z.string(),
        title: z.string(),
      }),
    )
    .optional(),
  creationMode: z.enum(["plan", "step", "auto"]).optional(),
  memories: z.string().optional(),
  projectName: z.string().max(200).optional(),
  // WHY: The active video project's reference images — the AI needs to know
  // what's already been attached (especially products/envs the user picked via
  // the inline picker) so it can tag them in CREATE_VIDEO. Without this, the
  // AI hallucinates that only references it added in its own response exist.
  currentProjectReferences: z
    .array(
      z.object({
        id: z.string(),
        url: z.string().url(),
        label: z.string(),
        category: z.enum(["character", "prop", "scene"]).optional(),
      }),
    )
    .max(20)
    .optional(),
  activeVideoProjectId: z.string().optional(),
  // WHY: Resolved @-mentions from the user's message. The frontend
  // extracted real asset URLs from its mention library; we inject these
  // into the system prompt as a "MENTIONED ASSETS" block so the AI uses
  // real URLs in ADD_REFERENCE_IMAGE instead of hallucinating placeholders.
  mentionedAssets: z
    .array(
      z.object({
        tag: z.string(),
        label: z.string(),
        url: z.string().url(),
        type: z.string().optional(),
      }),
    )
    .max(20)
    .optional(),
  // WHY: Approved storyboard keyframes from /dashboard/storyboard. The
  // ChatPanel reads pm-storyboard-approved on mount and passes them here.
  // The strategist injects them as a "STORYBOARD APPROVED" block into the
  // system prompt and the Video Engineer MUST set mode="i2v" with exact
  // firstFrameUrl per scene. This closes the chat-driven loop: brief →
  // storyboard → approve → return to chat → video gen with locked frames.
  approvedStoryboard: z
    .object({
      videoProjectId: z.string(),
      approvedAt: z.string(),
      scenes: z
        .array(
          z.object({
            sceneIndex: z.number().int().min(0).max(50),
            prompt: z.string().max(2000),
            sourceImage: z.string().url(),
            aspectRatio: z.enum(["16:9", "9:16", "1:1"]).optional(),
          }),
        )
        .min(1)
        .max(20),
    })
    .optional(),
});

// WHY: Agentic system prompt — tells Claude to return structured action blocks
// that the frontend will parse and execute against the platform's APIs.
const WORKSPACE_SYSTEM_PROMPT = `${STRATEGIST_SYSTEM_PROMPT}

You are now operating in the Creative Workspace as a coordinated team of
specialist engineers. The user briefs once. You carry the work through to
completion. Each engineer has ONE domain, executes via structured action
blocks, and hands off automatically when its job is done.

THE ENGINEER PIPELINE — read this before every response:

1. STORYBOARD ENGINEER — first contact. Clarifies format / platform / goal
   in ONE turn (only what's missing). Writes scene plans with platform-aware
   constraints. Emits GENERATE_STORYBOARD. Hands off when storyboard approved.

2. SCORE ENGINEER — once visuals are locked, picks 3 track options matching
   format and mood. Emits CREATE_SCORE. Hands off when user picks a track.

3. VOICEOVER ENGINEER — drafts timestamped script aligned to the locked
   timeline. Emits OFFER_VOICEOVER (record-vs-AI fork). Hands off when user
   picks a path or skips ("no VO").

4. VIDEO ENGINEER — once a STORYBOARD APPROVED block is in your system
   prompt, take over. Emit CREATE_VIDEO with mode="i2v" and use the EXACT
   firstFrameUrls from the approved set per scene. Tag references to every
   relevant scene. Hands off when all scenes generated.

5. SOUND ENGINEER — auto-fires GENERATE_SCORE after stitch in Auto Mode.
   Lyria 3 generates the music bed timestamp-aligned to the cut.

6. DISTRIBUTION ENGINEER — when user is ready to ship, emit DISTRIBUTE or
   SCHEDULE_POST per platform. Re-format aspect/duration per platform.

7. FINISHING ENGINEER (DaVinci, LOCAL) — runs on the user's Mac. After
   Sound Engineer locks the music bed, emit FINISH_IN_DAVINCI with all
   stitched scene URLs + score URL + voiceover URL + target formats
   (TikTok 9:16, YouTube 16:9, etc.). The user's Mac-local DaVinci agent
   claims the job, assembles the timeline in Resolve, applies brand LUT,
   runs Optical Flow flicker repair, mixes audio (score ducked under VO
   in Fairlight), and renders the multi-format queue. Outputs land in
   GCS. Use this whenever the user wants finished, polished, deliverable
   cuts — not raw stitched output. Skip if user says "just stitch and
   download, no finishing."
   Example:
   \`\`\`action
   {"action": "FINISH_IN_DAVINCI", "videoProjectId": "auto", "projectName": "Flight 420 — Episode 03", "scenes": [{"sceneIndex": 0, "videoUrl": "https://princemarketing.ai/scenes/...mp4", "durationSec": 5}], "scoreUrl": "https://princemarketing.ai/audio/lyria-...mp3", "voiceoverUrl": "https://princemarketing.ai/audio/eleven-...mp3", "targetFormats": ["tiktok-9x16", "youtube-16x9"], "brandLut": "flight420.cube"}
   \`\`\`

8. ANALYTICS ENGINEER — post-publish: GET_ADS_ANALYTICS + SCORE_CONTENT
   retroactively to feed forward into the next brief.

GOLDEN RULE — clarify the MINIMUM, never interrogate. If the user already
gave you something in their first message, never re-ask it. Be lazy about
clarification, decisive about execution.

You are now operating in the Creative Workspace mode. The user's canvas currently has {existingNodes} content nodes.

When you take actions, the frontend will automatically:
- CREATE_IMAGE: call the image generation API and add a node to the canvas
- CREATE_VIDEO: create VideoScene objects and add a video node to the canvas
- CREATE_COPY: call the copy generation API and add a node to the canvas
- SCHEDULE_POST: create a calendar entry
- PUBLISH_NOW: publish content to connected social platforms
- GET_ANALYTICS: fetch performance insights — tells you what's working, what's not, and why
- GET_ADS_ANALYTICS: fetch ad campaign data from connected ad platforms (Meta, Google, TikTok, LinkedIn)
- GET_RECOMMENDATIONS: get AI-powered content recommendations — what to post next, when, and where
- WEEKLY_SUMMARY: generate a natural language weekly performance brief
- GENERATE_VARIANTS: create A/B/C content variants with different strategic angles for the same message
- ANALYZE_COMPETITORS: call the strategy agent to research competitors and display results
- BUILD_STRATEGY: call the strategy agent to generate a full marketing strategy
- AUDIENCE_INSIGHT: call the strategy agent to analyze the user's audience from connected platforms

You can also return a legacy JSON block (wrapped in \`\`\`json ... \`\`\`) with a "nodes" array if you need to create canvas nodes directly:
\`\`\`json
{
  "nodes": [
    {"type": "image|video|copy|post", "title": "...", "prompt": "..."}
  ]
}
\`\`\`

For video requests, break the video into scenes:
\`\`\`json
{
  "nodes": [
    {"type": "video", "title": "...", "prompt": "...", "videoProjectId": "auto", "scenes": [{"prompt": "...", "duration": 5}]}
  ]
}
\`\`\`

For campaign requests, return multiple nodes of different types that form a connected pipeline.

IMPORTANT REMINDERS:
- When the user asks for a video or commercial, you MUST output a \`\`\`action block with "action": "CREATE_VIDEO" and a "scenes" array. Never just describe what the video would look like — actually create it.
- Example for a 15-second commercial:
\`\`\`action
{"action": "CREATE_VIDEO", "prompt": "15-second luxury sneaker commercial", "scenes": [{"prompt": "Close-up of sneaker on reflective surface, dramatic lighting", "duration": 5}, {"prompt": "Model walking in urban setting wearing the sneakers, cinematic slow motion", "duration": 5}, {"prompt": "Logo reveal with tagline, premium brand aesthetic", "duration": 5}]}
\`\`\`
- When the user asks for multiple things (images + video, copy + images, etc.), output ALL action blocks in a single response. Do not stop after the first action.

STORYBOARD ENGINEER PROTOCOL (you on every NEW video brief):

Before writing scene prompts, clarify the THREE constraints that drive every
downstream decision. Ask only what's MISSING from the user's first message —
if they said "make me a TikTok ad to drive sales" you already have all three.

Three constraints:
1. FORMAT — commercial / music video / social ad / brand film / narrative
   short / explainer / doc-style
2. PLATFORM — TikTok / Instagram Reels / Instagram Feed / YouTube Shorts /
   YouTube long / YouTube ad / Paid Meta / Twitter / Facebook / Netflix-grade
   / Brand film for website / Multi-platform
3. GOAL — sales / brand awareness / community / clout / education / signups

If 1+ are missing, ask in ONE conversational turn:
"Quick gate before I plan visuals — what format (commercial / music video /
social ad / brand film / narrative)? Platform target (TikTok, Reels, YouTube,
paid Meta, Netflix-grade)? Goal (sales / awareness / signups / clout)?"

PLATFORM-AWARE DEFAULTS — apply silently once platform is known:
| Platform        | Aspect | Duration   | Hook   | CTA         |
|-----------------|--------|------------|--------|-------------|
| TikTok          | 9:16   | 15-60s     | <2s    | Native      |
| IG Reels        | 9:16   | 15-90s     | <3s    | Shoppable   |
| IG Feed         | 1:1/4:5| 15-60s     | <3s    | Comment     |
| YT Shorts       | 9:16   | <60s       | <3s    | Subscribe   |
| YT long         | 16:9   | 5-30min    | <30s   | Watch-time  |
| YT ad           | 16:9   | 6/15/30s   | <5s    | Skip-defeat |
| Paid Meta       | 9:16/1:1| 6-30s     | <3s    | Click       |
| Twitter         | 16:9/1:1| <140s     | <3s    | Quote/share |
| Facebook        | 16:9/1:1| 15-60s    | <3s    | Share       |
| Netflix-grade   | 16:9   | 30s-2hr    | (slow) | none        |
| Brand film/web  | 16:9   | 30s-3min   | <5s    | Premium     |

Inject these constraints into every scene's aspectRatio + total scene
durations summing to the platform's duration ceiling. NEVER ask the user to
confirm aspect ratio after platform is known — infer it.

SCORE-FIRST PRODUCTION ORDER (MANDATORY for Step Mode and Plan Mode videos):
Pro commercial/music-video shops never "cut to picture" anymore. Rhythm is
the skeleton, not the afterthought. Every scene's duration, cut point, and
camera move must be timed to the music BEFORE a single frame is generated.
So for any video >8 seconds (anything beyond a single clip), the order is:

1. PLAN — write the scene outline (Attention Architecture beats)
2. CREATE_SCORE — output 3 track options for the user to pick from.
   Different genres/tempos matching the Attention Architecture read.
   Use CREATE_SCORE action with a trackOptions array. Example:
   \`\`\`action
   {"action": "CREATE_SCORE", "videoProjectId": "auto", "trackOptions": [
     {"prompt": "Dark trap beat, sub-bass, slow rolling hi-hats, luxury menace", "genre": "trap", "bpm": 70, "duration": 30},
     {"prompt": "Orchestral cinematic, strings swelling, tension-to-release", "genre": "cinematic", "bpm": 90, "duration": 30},
     {"prompt": "Minimalist house, deep bassline, hypnotic synth", "genre": "deep house", "bpm": 120, "duration": 30}
   ]}
   \`\`\`
3. (user picks a track inline → timeline is now locked)
4. OFFER_VOICEOVER — draft the timestamped VO script aligned to the locked
   timeline, then emit OFFER_VOICEOVER so the user picks between two paths:
   (a) record it themselves via karaoke, or (b) pick an AI voice (ElevenLabs).
   The inline picker handles both branches — you don't decide for them. You
   MAY recommend one of these preset voice IDs based on brand tone:
   - 39Gpp1Eo6GMymVahbquM = **LaDonte's trained voice** (custom clone) —
     DEFAULT for first-person / personal-brand / "I'm the talent" content
     (Flight 420, ladonteprince.com pieces, founder-narration of Prince
     Marketing agency work). Use this whenever the speaker IS LaDonte.
   - 21m00Tcm4TlvDq8ikWAM = Rachel/warm-female (when a non-LaDonte female VO
     fits the brief)
   - pNInz6obpgDQGcFmaJgB = Adam/deep-male (alternate male voice if the
     character isn't LaDonte)
   - AZnzlk1XvdvUeBnXmlld = Domi/intimate-sultry (intimate brand tone, e.g.,
     fashion / luxury / late-night ad reads)
   Example:
   \`\`\`action
   {"action": "OFFER_VOICEOVER", "videoProjectId": "auto", "script": [
     {"startTime": 0, "endTime": 3, "text": "Some men chase attention."},
     {"startTime": 3, "endTime": 7, "text": "Others make attention chase them."},
     {"startTime": 7, "endTime": 12, "text": "Tom Ford. Unmistakable."}
   ], "recommendedVoiceId": "pNInz6obpgDQGcFmaJgB"}
   \`\`\`
   SKIP this step entirely if the user explicitly said they don't want a
   voiceover ("no VO", "music only", "no narration"). In that case go
   straight from CREATE_SCORE to CREATE_VIDEO.
5. (user picks a VO path inline → voiceoverUrl lands on the project)
6. GENERATE_STORYBOARD — Before firing expensive Seedance video calls
   (~$1/scene), generate cheap keyframe thumbnails (~$0.04 each) so the user
   — or a paying client — can approve the visual direction. Approved
   keyframes become firstFrameUrl on each downstream scene's i2v generation.
   This is the "send the brand a storyboard for sign-off" workflow that
   powers agency client approvals. Default model is "nano-banana-pro"
   (multi-image refs, wired today). Use "gpt-image-2" when the scene needs
   strong text rendering or photoreal hero composition.
   Skip ONLY when the user explicitly says "no storyboard, just generate"
   or you're in Auto Mode. Example:
   \`\`\`action
   {"action": "GENERATE_STORYBOARD", "videoProjectId": "auto", "model": "nano-banana-pro-preview", "scenes": [
     {"sceneIndex": 0, "prompt": "Wide establishing shot of luxury penthouse at golden hour", "aspectRatio": "16:9"},
     {"sceneIndex": 1, "prompt": "Close-up of @LaDonte adjusting cufflinks, intense focus", "aspectRatio": "16:9"},
     {"sceneIndex": 2, "prompt": "Medium shot of @LaDonte walking through space, hard light", "aspectRatio": "16:9"}
   ]}
   \`\`\`
7. (user reviews keyframes in the Storyboard strip → approves or regenerates
   each → approved imageUrls land on scenes as firstFrameUrl)
8. CREATE_VIDEO — NOW generate scenes. Every scene duration derived from a
   musical section of the chosen track. Every relevant reference (characters,
   products, environments) tagged to every scene it belongs in. If
   GENERATE_STORYBOARD ran, set each scene's "mode": "i2v" and let the
   approved keyframe drive the first frame. The final stitch will layer:
   video → music bed (ducked) → voiceover on top.

Auto Mode is the exception — in Auto Mode, skip score-first AND skip
storyboard. Let Seedance generate directly, then Sound Director scores post.
Only Step/Plan use score-first + storyboard-first.

PRODUCTION BRAIN — PER-ENGINEER NAMESPACE MAP:
Each engineer queries the right specialty namespace. Pass \`namespace\` to
QUERY_PRODUCTION_BRAIN for sharper retrieval than the default catch-all.

| Engineer            | Primary namespace(s)                            | When to query                          |
|---------------------|-------------------------------------------------|----------------------------------------|
| Storyboard Engineer | "cinematography" + "save-the-cat" + "neurochemicals" | Camera moves, beat shape, dopamine targeting per scene |
| Score Engineer      | "music-sound-design" + "neurochemicals"         | Genre/tempo to drive the emotional arc |
| Voiceover Engineer  | "spoken-word" + "neurochemicals"                | Hook structure, dopamine targeting     |
| Video Engineer      | "cinematography" + "ladonte-character-refs"     | Shot grammar + which LaDonte ref fits  |
| Sound Engineer      | "music-sound-design"                            | Sound bed alignment / texture          |
| Distribution Eng.   | "production-research"                           | Platform best-practices                |
| Analytics Engineer  | "production-research"                           | Performance frameworks                 |
| Limerence System    | "limerence-KB"                                  | Limerence/medusa-effect specifics      |

Available namespaces and their counts:
- production-research (125) — general catch-all (default)
- save-the-cat (79) — story structure / beat sheets
- ladonte-character-refs (41) — character ref images with descriptions
- neurochemicals (18) — dopamine ladder / attention chemistry
- limerence-KB (18) — limerence system docs
- spoken-word (17) — VO / script structure
- cinematography (16) — camera techniques
- music-sound-design (13) — audio aesthetic
- filmmaking-sop (1) — process

Examples (use namespace explicitly when an engineer is making a domain call):
\`\`\`action
{"action": "QUERY_PRODUCTION_BRAIN", "query": "best shot type for medusa-stare anticipation hook", "namespace": "cinematography"}
\`\`\`
\`\`\`action
{"action": "QUERY_PRODUCTION_BRAIN", "query": "dopamine cycle for 30-second luxury reveal", "namespace": "neurochemicals"}
\`\`\`
\`\`\`action
{"action": "QUERY_PRODUCTION_BRAIN", "query": "save-the-cat beat structure for 60-second product film", "namespace": "save-the-cat"}
\`\`\`
\`\`\`action
{"action": "QUERY_PRODUCTION_BRAIN", "query": "intense direct stare close-up for hook scene", "namespace": "ladonte-character-refs"}
\`\`\`

If the user is making a generic strategic question (no specific engineer in
flight), omit \`namespace\` — that defaults to production-research (125 general
vectors). Citations get rendered inline below your message. Never fabricate
citations; if the brain returns nothing, say so and call from first principles.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXECUTION CONTRACT — READ THIS BEFORE EVERY RESPONSE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

When the user says any of: "execute", "go", "do it", "run it", "begin",
"start", "ship it", "make it", "build it", "produce it", "send it" — OR
any unambiguous instruction to generate the planned video — you are
REQUIRED to emit a CREATE_VIDEO action with a populated scenes array IN
THE SAME RESPONSE. Reference setup actions alone (ADD_REFERENCE_IMAGE,
TAG_REFERENCE_TO_SCENE) DO NOT generate video. If you only emit
reference setup actions without CREATE_VIDEO, NOTHING WILL HAPPEN — the
user will see "Tagged reference to scene N" status messages but no
actual video clips, no scenes on the canvas, and a frustrated session.
This is the most common failure mode. Do not let it happen.

The CORRECT execute response shape is:
1. ADD_REFERENCE_IMAGE for any new refs you need (use REAL urls only —
   from the MENTIONED ASSETS block, the CURRENT VIDEO PROJECT REFERENCES
   block, or the asset list. NEVER fabricate URLs or use placeholders
   like "https://example.com/image.png" or "/placeholder.jpg".)
2. CREATE_VIDEO with the full scenes array — durations, prompts, all
   of it. The videoProjectId MAY be "auto" — the frontend assigns a real
   UUID at execution time.
3. TAG_REFERENCE_TO_SCENE for every relevant ref × every relevant scene.
   These ONLY work if CREATE_VIDEO was emitted in the same response and
   the sceneIndex you tag actually exists in that CREATE_VIDEO's scenes
   array. Tagging into nonexistent scenes is silently dropped.

URL HONESTY RULE — ABSOLUTE:
- ADD_REFERENCE_IMAGE.url MUST be a real https URL from the MENTIONED
  ASSETS block, the CURRENT VIDEO PROJECT REFERENCES block, the user's
  asset list, or a freshly-completed FIND_PRODUCT result the user has
  selected.
- If the user @-tags an asset that is NOT in any of those blocks, the
  asset does not exist. Tell the user clearly: "I don't see @TagName in
  your library — can you upload it or do a product search?" Do NOT
  fabricate a URL to keep the response moving.
- This rule has zero exceptions. Fabricated URLs cause broken thumbnails
  and silent generation failures downstream.

VIDEO ENGINEER OVERRIDE — STORYBOARD APPROVED:
When a "STORYBOARD APPROVED" block appears in your context (below the
references blocks), the Storyboard Engineer's gate is closed. The Video
Engineer takes over. You MUST:
- Emit CREATE_VIDEO with mode="i2v"
- For each scene, use the EXACT firstFrameUrl from the approved set
  (matched by sceneIndex). Pass it as scene.sourceImage in the action.
- Use the scene's prompt and aspectRatio from the approved set verbatim.
- Do NOT regenerate keyframes. Do NOT call GENERATE_STORYBOARD again.
- Tag every relevant character/prop/environment reference to its scene.

If the user is just chatting or asking questions, respond normally WITHOUT any action or JSON blocks.`;

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = session.user.email ?? session.user.id ?? "unknown";
    const { allowed, remaining } = checkRateLimit(`create:${email}`, 15);
    if (!allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again in a minute." },
        { status: 429, headers: { "X-RateLimit-Remaining": String(remaining) } },
      );
    }

    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const { message, history, existingNodes, creationMode, memories, projectName, currentProjectReferences, activeVideoProjectId, mentionedAssets, approvedStoryboard } = parsed.data;

    // WHY: Inject the user's social media context so the AI can give personalized advice.
    // e.g. "Based on your recent Instagram posts about sneakers..." instead of generic tips.
    let socialContext = "";
    let analyticsContext = "";
    try {
      socialContext = await buildUserContext(session.user.id ?? "");
    } catch (err) {
      console.error("[CreateContent] Failed to build social context:", err);
    }

    // WHY: Pre-fetch lightweight analytics summary so the AI can proactively say things
    // like "Based on your analytics, video content performs 3x better on Tuesdays."
    // This runs in parallel with the social context build and only adds a sentence or two.
    try {
      const recentEntries = await db.calendarEntry.findMany({
        where: { userId: session.user.id ?? "", status: "PUBLISHED" },
        include: { analytics: true },
        orderBy: { publishedAt: "desc" },
        take: 20,
      });

      if (recentEntries.length > 0) {
        const totalEng = recentEntries.reduce(
          (sum, e) => sum + e.analytics.reduce((s, a) => s + a.engagement, 0),
          0,
        );
        const totalImp = recentEntries.reduce(
          (sum, e) => sum + e.analytics.reduce((s, a) => s + a.impressions, 0),
          0,
        );
        const avgEngRate = totalImp > 0 ? ((totalEng / totalImp) * 100).toFixed(1) : "0";
        const topEntry = recentEntries
          .map((e) => ({
            title: e.title,
            platform: e.platform,
            engagement: e.analytics.reduce((s, a) => s + a.engagement, 0),
          }))
          .sort((a, b) => b.engagement - a.engagement)[0];

        const parts = [
          `User has ${recentEntries.length} recent published posts with ${avgEngRate}% avg engagement rate.`,
        ];
        if (topEntry && topEntry.engagement > 0) {
          parts.push(
            `Top performer: "${topEntry.title}" on ${topEntry.platform} (${topEntry.engagement} engagements).`,
          );
        }
        analyticsContext = parts.join(" ");
      }
    } catch (err) {
      console.error("[CreateContent] Failed to build analytics context:", err);
    }

    // Fetch user's existing assets so the AI can reference them
    let assetsContext = "";
    try {
      const assetRes = await fetch(`${process.env.PRINCE_API_URL || "https://princemarketing.ai"}/api/v1/user/generations?limit=10`, {
        headers: { "x-api-key": process.env.PRINCE_API_KEY || "" },
      });
      if (assetRes.ok) {
        const assetData = await assetRes.json();
        const gens = assetData?.data?.generations ?? [];
        const passed = gens.filter((g: any) => g.status === "passed" || g.status === "completed");
        if (passed.length > 0) {
          assetsContext = `\n\nUser's existing assets (use these URLs for ADD_REFERENCE_IMAGE when the user wants character/product consistency):\n${
            passed.map((g: any, i: number) => `${i+1}. [${g.type}] "${g.prompt?.slice(0,60)}..." — URL: ${g.resultUrl}`).join("\n")
          }`;
        }
      }
    } catch (err) {
      console.error("[CreateContent] Failed to fetch assets:", err);
    }

    // WHY: Sanitize external social content before injecting into the system prompt.
    // Social posts are user-generated and could contain prompt injection payloads.
    const safeSocialContext = socialContext
      ? sanitizeExternalContext(socialContext)
      : "";

    const contextSources: string[] = ["base_prompt"];
    if (existingNodes?.length) contextSources.push("existing_nodes");
    if (safeSocialContext) contextSources.push("social_context");
    if (analyticsContext) contextSources.push("analytics_context");
    if (memories) contextSources.push("user_memories");
    if (currentProjectReferences?.length) contextSources.push("project_references");
    if (mentionedAssets?.length) contextSources.push("mentioned_assets");

    // WHY: Tell the AI exactly which references are already attached to the active
    // video project so it can tag them in EVERY CREATE_VIDEO scene. Without this,
    // products picked via the inline picker were being silently dropped because
    // the AI only knew about refs it added itself via ADD_REFERENCE_IMAGE.
    const projectRefsContext = currentProjectReferences?.length
      ? `\n\nCURRENT VIDEO PROJECT REFERENCES (already attached to project${activeVideoProjectId ? ` ${activeVideoProjectId}` : ""} — you MUST tag these in every relevant CREATE_VIDEO scene):\n${currentProjectReferences
          .map((r) => `- @${r.label}${r.category ? ` (${r.category})` : ""}: ${r.url}`)
          .join("\n")}\n\nCRITICAL: When outputting CREATE_VIDEO, output a TAG_REFERENCE_TO_SCENE action for EVERY relevant reference across ALL scenes. Characters should be tagged to every scene they appear in. Props (watches, suits, cars) should be tagged to scenes where they're visible. Environments should be tagged to scenes set there. Never forget a reference that's already in the project — the user added it for a reason.`
      : "";

    // WHY: User's message contained @-mentions like @LaDonte. The frontend
    // resolved each tag to a real asset URL from the user's library. The AI
    // MUST use these exact URLs when emitting ADD_REFERENCE_IMAGE for those
    // tags — never invent a URL, never use a placeholder. If a tag wasn't
    // resolved, it means the asset doesn't exist; tell the user instead of
    // fabricating one.
    const mentionedAssetsContext = mentionedAssets?.length
      ? `\n\nMENTIONED ASSETS (resolved from the user's @-tags — use these EXACT URLs):\n${mentionedAssets
          .map((m) => `- @${m.tag} → label="${m.label}", url=${m.url}${m.type ? `, type=${m.type}` : ""}`)
          .join("\n")}\n\nCRITICAL: When the user @-tags an asset, you MUST emit an ADD_REFERENCE_IMAGE action with the EXACT url shown above (and the label shown). NEVER fabricate a URL or use a placeholder. If a user mentioned a tag that is NOT in the list above, the asset does not exist in their library — tell them so instead of inventing one. After ADD_REFERENCE_IMAGE, also emit TAG_REFERENCE_TO_SCENE for every relevant scene.`
      : "";

    // WHY: Storyboard Engineer's gate is closed when this block exists.
    // Video Engineer takes over: emit CREATE_VIDEO with mode="i2v" and use
    // the EXACT firstFrameUrl per scene. The user already approved these
    // keyframes — regenerating them is a UX failure (and a refund risk on
    // agency work).
    const approvedStoryboardContext = approvedStoryboard?.scenes?.length
      ? `\n\nSTORYBOARD APPROVED — VIDEO ENGINEER, EXECUTE (videoProjectId: ${approvedStoryboard.videoProjectId}, approved ${approvedStoryboard.approvedAt}):\n${approvedStoryboard.scenes
          .map(
            (s) =>
              `- Scene ${s.sceneIndex + 1} (${s.aspectRatio ?? "16:9"}): firstFrameUrl=${s.sourceImage}\n    prompt: ${s.prompt.slice(0, 300)}${s.prompt.length > 300 ? "…" : ""}`,
          )
          .join("\n")}\n\nCRITICAL — these are LOCKED keyframes. Your next CREATE_VIDEO action MUST:\n1. Set mode="i2v" on every scene\n2. Pass each scene's firstFrameUrl as scene.sourceImage in the action payload\n3. Use the prompts and aspectRatios EXACTLY as shown above\n4. Tag every relevant character / prop / environment reference to every scene it appears in\n5. NOT call GENERATE_STORYBOARD again — the gate is closed.`
      : "";
    if (approvedStoryboardContext) contextSources.push("approved_storyboard");

    const systemPrompt = WORKSPACE_SYSTEM_PROMPT.replace(
      "{existingNodes}",
      existingNodes
        ? `${existingNodes.length} (${existingNodes.map((n) => `${n.type}: ${n.title}`).join(", ")})`
        : "0",
    ) + (safeSocialContext
      ? `\n\nUser's social media context (use this to personalize your advice and content):\n${safeSocialContext}`
      : "")
    + (analyticsContext
      ? `\n\nUser's recent analytics (reference this proactively when relevant):\n${analyticsContext}\nWhen the user asks to create content, suggest using GENERATE_VARIANTS to get A/B options. When they ask about performance, use GET_ANALYTICS for deep insights.`
      : "")
    + assetsContext
    + projectRefsContext
    + mentionedAssetsContext
    + approvedStoryboardContext
    + (memories
      ? `\n\nUSER MEMORIES (remembered from past conversations — use these to personalize your responses. Reference them naturally, e.g. "Based on what I remember about your brand..."):\n${memories}`
      : "")
    + (projectName && projectName !== "Default Project"
      ? `\n\nACTIVE PROJECT: ${projectName}\nAll content and memories are scoped to this project. Reference the project name when relevant.`
      : "")
    + (creationMode === "plan"
      ? `\n\nCREATION MODE: PLAN
You are in PLAN MODE. Your ONLY job is to write the plan. NO ACTIONS. NO GENERATION. NO CLAIMS THAT ANYTHING IS GENERATING.

CRITICAL ANTI-HALLUCINATION RULES:
- NEVER say "Scene 1 is generating", "you should see it on your canvas", "it's processing now", or any variant. NOTHING is generating in Plan Mode.
- NEVER claim videos have been created or that the user should "wait for it to complete". Plan Mode produces ZERO output beyond text.
- NEVER reference a canvas, video editor, or generation status. There is none in Plan Mode.
- If the user asks "is it done?" or "is it generating?" — answer truthfully: "We're in Plan Mode — nothing has been generated yet. Switch to Step or Auto Mode (Shift+Tab) and say 'execute' to start generation."

When the user asks you to create a video or commercial:
1. Open with: "I'm in **Plan Mode** — I'll build the full plan, but nothing will generate until you switch to Step or Auto."
2. Build the FULL scene-by-scene plan as a written outline (no actions, just text)
3. Each scene includes:
   - Scene number + Attention Architecture role (STIMULATION / CAPTIVATION / ANTICIPATION / VALIDATION / REVELATION)
   - Visual description (what the camera sees)
   - Duration estimate
   - References needed (which @assets are used) — if the user tagged @LaDonte, every relevant scene MUST reference @LaDonte explicitly
   - Why this scene works (the neurochemical/psychological purpose)
4. End your message with EXACTLY this format:
   "---
   **Plan complete.** Ready to begin?
   - To execute: switch to **Step Mode** (review each scene) or **Auto Mode** (hands-off), then say **'execute'**
   - To revise: tell me what to change
   - To continue planning: ask more questions"
5. If the user says "execute" or "go" or "do it" — IGNORE IT in Plan Mode. Tell them: "I can't generate while in Plan Mode. Switch to Step or Auto Mode first (Shift+Tab toggles)."
6. NEVER output a CREATE_VIDEO, ADD_REFERENCE_IMAGE, or TAG_REFERENCE_TO_SCENE action in Plan Mode. EVER. The validator will allow it but the user expects Plan Mode to be 100% advisory.

Example flow:
User: "Make a 15-second sneaker commercial with @SneakerPro"
You: "Here's the plan for your 15-second sneaker commercial:

**Scene 1 (0-5s) — STIMULATION FRAME**
ECU of @SneakerPro on reflective surface. Dramatic backlighting reveals the silhouette. Camera pushes in aggressively. Stinger SFX on reveal.
*Why: Bottom-up attentional capture via high-contrast motion. Triggers norepinephrine spike (amygdala → LC → NE pathway).*

**Scene 2 (5-10s) — ANTICIPATION BUILD**
Model walks through urban setting in slow-motion. @SneakerPro catches light at unusual angle. Rising ostinato underscore.
*Why: Predictive processing — building tension through visual foreshadowing.*

**Scene 3 (10-15s) — VALIDATION + REVELATION**
Hero shot of @SneakerPro. Logo reveal with brand leitmotif. Warm lighting shift.
*Why: Reward prediction error resolution. Endorphin release via crescendo + warm color.*

---
**Plan complete.** Ready to begin?
- To execute: switch to **Auto Mode** (Shift+Tab) or say **'execute'**
- To revise: tell me what to change
- To continue planning: ask more questions"

[NO ACTION BLOCKS — wait for user to confirm execution]`
      : creationMode === "step"
        ? `\n\nCREATION MODE: STEP
You are in STEP MODE. The frontend automatically PAUSES generation after each scene completes and waits for the user to click Approve before generating the next. You output all scenes ONCE — the per-scene gating happens in the frontend, not in your responses.

When the user asks you to create a video or commercial:
1. Brief written outline of all scenes (3-4 sentences total). Mention: "I'll output all scenes now and the frontend will pause after each one for your review."
2. Output a SINGLE CREATE_VIDEO action with ALL scenes in the scenes array
3. Use placeholder "auto" for videoProjectId in CREATE_VIDEO
4. Output ADD_REFERENCE_IMAGE for each @asset the user tagged (use videoProjectId "auto")
5. Output TAG_REFERENCE_TO_SCENE for EVERY scene that uses the reference (one action per scene-reference pair). If @LaDonte is in all 6 scenes, output 6 TAG_REFERENCE_TO_SCENE actions, sceneIndex 0 through 5.

The frontend handles the rest:
- Generates Scene 1 → pauses → user sees inline card → clicks Approve
- Generates Scene 2 → pauses → repeat
- Reject + feedback → AI revises scene prompt → regenerates same scene
- After last scene approved → auto-stitches + Sound Director runs

You only output the actions ONCE. Do NOT output another CREATE_VIDEO when the user clicks approve — that's handled by the frontend gating loop. Do not respond to "approve" messages with new actions; just acknowledge briefly.

Example:
User: "Make a 6-scene sneaker commercial with @LaDonte"
You: "Building the 6-scene commercial. I'll output all scenes now and the frontend will pause after each one for your review. Tagging @LaDonte to every scene for character consistency."
\`\`\`action
{"action": "CREATE_VIDEO", "videoProjectId": "auto", "prompt": "...", "scenes": [{"prompt": "scene 1...", "duration": 5}, {"prompt": "scene 2...", "duration": 5}, {"prompt": "scene 3...", "duration": 5}, {"prompt": "scene 4...", "duration": 5}, {"prompt": "scene 5...", "duration": 5}, {"prompt": "scene 6...", "duration": 5}]}
\`\`\`
\`\`\`action
{"action": "ADD_REFERENCE_IMAGE", "videoProjectId": "auto", "url": "...", "label": "LaDonte"}
\`\`\`
\`\`\`action
{"action": "TAG_REFERENCE_TO_SCENE", "videoProjectId": "auto", "sceneIndex": 0, "refLabel": "LaDonte"}
\`\`\`
(... repeat TAG_REFERENCE_TO_SCENE for sceneIndex 1, 2, 3, 4, 5)`
        : creationMode === "auto"
        ? `\n\nCREATION MODE: AUTO
You are in AUTO MODE. Skip all clarifying questions if the user has already tagged references with @ in their message. Just execute.

When the user asks you to create a video or commercial:
1. Output ALL scenes in a single CREATE_VIDEO action with the full scenes array
2. Use placeholder "auto" for videoProjectId in CREATE_VIDEO — the frontend will assign a UUID
3. Use the SAME placeholder "auto" for videoProjectId in ADD_REFERENCE_IMAGE and TAG_REFERENCE_TO_SCENE actions in the same response — the frontend substitutes them with the actual UUID
4. Output ALL three action types in the same response: CREATE_VIDEO + ADD_REFERENCE_IMAGE (one per @asset) + TAG_REFERENCE_TO_SCENE (one per scene-asset link)
5. Structure scenes using Attention Architecture (STIMULATION → ANTICIPATION → VALIDATION → REVELATION)
6. The frontend generates scenes SEQUENTIALLY (one at a time, not parallel — prevents API overload)
7. After all scenes complete, the Sound Director auto-generates the score via Lyria 3
8. After audio is ready, offer Karaoke Mode for voiceover

CRITICAL: Use the literal string "auto" for videoProjectId across all related actions in the same response. Example:
\`\`\`action
{"action": "CREATE_VIDEO", "videoProjectId": "auto", "prompt": "...", "scenes": [...]}
\`\`\`
\`\`\`action
{"action": "ADD_REFERENCE_IMAGE", "videoProjectId": "auto", "url": "https://...", "label": "LaDonte"}
\`\`\`
\`\`\`action
{"action": "TAG_REFERENCE_TO_SCENE", "videoProjectId": "auto", "sceneIndex": 0, "refLabel": "LaDonte"}
\`\`\`

The user wants hands-off generation. Do not ask for approval — just execute.`
        : "");

    // Audit log: track what went into the system prompt (metadata only, no PII)
    auditPromptBuild(
      email,
      systemPrompt.length,
      contextSources,
    );

    // Build conversation history: compact old messages + append new user message
    const fullHistory: CompactableChatMessage[] = [
      ...(history ?? []),
      { role: "user" as const, content: message },
    ];
    const compactedHistory = compactMessages(fullHistory);

    const response = await claude.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: systemPrompt,
      messages: compactedHistory.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const fullText =
      response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("\n") || "";

    // Parse ```action blocks for agentic actions
    const actions: Array<Record<string, unknown>> = [];
    const actionPattern = /```action\s*([\s\S]*?)```/g;
    let actionMatch;
    while ((actionMatch = actionPattern.exec(fullText)) !== null) {
      try {
        const parsed = JSON.parse(actionMatch[1].trim());
        actions.push(parsed);
      } catch {
        // Skip malformed action blocks
      }
    }

    // WHY: Validate actions against strict Zod schemas before passing to frontend.
    // Malformed or injected action types are dropped here — never executed.
    const validatedActions = validateActions(actions);

    // WHY: Process agent-specific actions server-side before returning to frontend.
    // These actions require DB access and Claude API calls that can't run client-side.
    const agentResults: Record<string, unknown> = {};
    const userId = session.user.id ?? "";

    for (const action of validatedActions) {
      try {
        switch (action.action) {
          case "GET_ANALYTICS": {
            // Fetch published posts with analytics data
            const entries = await db.calendarEntry.findMany({
              where: { userId, status: "PUBLISHED" },
              include: { analytics: true },
              orderBy: { publishedAt: "desc" },
              take: 100,
            });

            const posts: AnalyzablePost[] = entries.flatMap((entry) =>
              entry.analytics.length > 0
                ? [{
                    content: entry.title,
                    platform: entry.platform,
                    engagement: entry.analytics.reduce((s, a) => s + a.engagement, 0),
                    impressions: entry.analytics.reduce((s, a) => s + a.impressions, 0),
                    postedAt: entry.publishedAt?.toISOString() ?? entry.scheduledAt.toISOString(),
                  }]
                : [],
            );

            const insights = await analyzePerformance(posts);
            agentResults.analytics = { insights, postCount: posts.length };
            break;
          }

          case "GET_ADS_ANALYTICS": {
            // WHY: Fetch ad campaign performance from connected ad platforms so the AI
            // can reason about paid campaign data alongside organic performance.
            const adPlatformFilter = action.platform && action.platform !== "all" ? action.platform : undefined;
            const adDateRange = "since" in action && "until" in action && action.since && action.until
              ? { since: String(action.since), until: String(action.until) }
              : undefined;

            const AD_PLATFORM_TO_DB: Record<string, "FACEBOOK" | "GOOGLE_ANALYTICS" | "TIKTOK" | "LINKEDIN"> = {
              meta: "FACEBOOK",
              google: "GOOGLE_ANALYTICS",
              tiktok: "TIKTOK",
              linkedin: "LINKEDIN",
            };

            const adDbTypes = adPlatformFilter
              ? [AD_PLATFORM_TO_DB[adPlatformFilter]].filter(Boolean)
              : Object.values(AD_PLATFORM_TO_DB);

            const adConnections = await db.platform.findMany({
              where: {
                userId,
                connected: true,
                accessToken: { not: null },
                type: { in: adDbTypes },
              },
              select: { type: true, accessToken: true },
            });

            const DB_TO_AD: Record<string, string> = {
              FACEBOOK: "meta",
              GOOGLE_ANALYTICS: "google",
              TIKTOK: "tiktok",
              LINKEDIN: "linkedin",
            };

            const { fetchAllAdsAnalytics, summarizeAdsData } = await import("@/lib/social/ads");

            // WHY: Advertiser IDs and customer IDs come from environment variables since
            // the Platform model stores OAuth tokens, not platform-specific ad account IDs.
            const mappedConns = adConnections
              .filter((c): c is typeof c & { accessToken: string } => c.accessToken !== null)
              .map((c) => ({
                platform: DB_TO_AD[c.type] as "meta" | "google" | "tiktok" | "linkedin",
                accessToken: c.accessToken,
                advertiserId: process.env.TIKTOK_ADVERTISER_ID,
                customerId: process.env.GOOGLE_ADS_CUSTOMER_ID,
              }))
              .filter((c) => c.platform !== undefined);

            const adsData = await fetchAllAdsAnalytics(mappedConns, adDateRange);
            const adsSummary = summarizeAdsData(adsData);

            agentResults.adsAnalytics = {
              summary: adsSummary,
              data: adsData,
              connectedPlatforms: mappedConns.map((c) => c.platform),
            };
            break;
          }

          case "GET_RECOMMENDATIONS": {
            // Build recommendations from existing insights (or generate fresh ones)
            const recentEntries = await db.calendarEntry.findMany({
              where: { userId, status: "PUBLISHED" },
              include: { analytics: true },
              orderBy: { publishedAt: "desc" },
              take: 50,
            });

            const recentPosts: AnalyzablePost[] = recentEntries.flatMap((entry) =>
              entry.analytics.length > 0
                ? [{
                    content: entry.title,
                    platform: entry.platform,
                    engagement: entry.analytics.reduce((s, a) => s + a.engagement, 0),
                    impressions: entry.analytics.reduce((s, a) => s + a.impressions, 0),
                    postedAt: entry.publishedAt?.toISOString() ?? entry.scheduledAt.toISOString(),
                  }]
                : [],
            );

            const insights = await analyzePerformance(recentPosts);
            const recommendations = await generateRecommendations(insights);
            agentResults.recommendations = recommendations;
            break;
          }

          case "WEEKLY_SUMMARY": {
            // Fetch this week's data
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

            const [weekEntries, connectedPlatforms] = await Promise.all([
              db.calendarEntry.findMany({
                where: {
                  userId,
                  status: "PUBLISHED",
                  publishedAt: { gte: oneWeekAgo },
                },
                include: { analytics: true },
              }),
              db.platform.findMany({
                where: { userId, connected: true, accessToken: { not: null } },
                select: { type: true, accessToken: true },
              }),
            ]);

            const platformAnalytics = connectedPlatforms.length > 0
              ? await fetchAllPlatformAnalytics(
                  connectedPlatforms
                    .filter((p): p is typeof p & { accessToken: string } => p.accessToken !== null)
                    .map((p) => ({ type: p.type.toLowerCase(), accessToken: p.accessToken })),
                )
              : [];

            const publishedPosts = weekEntries.map((entry) => ({
              title: entry.title,
              platform: entry.platform,
              engagement: entry.analytics.reduce((s, a) => s + a.engagement, 0),
              impressions: entry.analytics.reduce((s, a) => s + a.impressions, 0),
              postedAt: entry.publishedAt?.toISOString() ?? entry.scheduledAt.toISOString(),
            }));

            const summary = await generateWeeklySummary(platformAnalytics, publishedPosts);
            agentResults.weeklySummary = summary;
            break;
          }

          case "SCORE_CONTENT": {
            // WHY: Score content against the Attention Architecture framework
            // using Gemini 3.1 Pro as an independent evaluator (not Claude scoring
            // its own output). The .ai service handles the Gemini API call.
            const contentToScore = String(action.content ?? "");
            const contentFormat = String(action.format ?? "short-form");

            try {
              const scoreRes = await fetch(
                `${process.env.PRINCE_API_URL || "https://princemarketing.ai"}/api/v1/score/attention`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "x-api-key": process.env.PRINCE_API_KEY || "",
                  },
                  body: JSON.stringify({
                    content: contentToScore,
                    format: contentFormat,
                  }),
                },
              );

              if (scoreRes.ok) {
                const scoreData = await scoreRes.json();
                agentResults.contentScore = scoreData.data ?? scoreData;
              } else {
                const errText = await scoreRes.text();
                console.error("[SCORE_CONTENT] Gemini scoring failed:", errText);
                agentResults.contentScore = { error: "Scoring service unavailable" };
              }
            } catch (err) {
              console.error("[SCORE_CONTENT] Failed to reach scoring service:", err);
              agentResults.contentScore = { error: "Scoring service unreachable" };
            }
            break;
          }

          case "GENERATE_VARIANTS": {
            const prompt = String(action.prompt ?? message);
            const platform = String(action.platform ?? "instagram");
            const count = Number(action.count) || 3;

            // Learn brand voice from user's existing content
            const platforms = await db.platform.findMany({
              where: { userId, connected: true, accessToken: { not: null } },
              select: { type: true, accessToken: true, accountName: true },
            });

            // Use the social indexer data to get recent posts for voice learning
            let brandVoice = await learnBrandVoice([]);
            if (platforms.length > 0) {
              // Fetch recent published entries as proxy for brand voice
              const recentContent = await db.calendarEntry.findMany({
                where: { userId, status: "PUBLISHED" },
                orderBy: { publishedAt: "desc" },
                take: 20,
                select: { title: true, content: true, platform: true },
              });

              if (recentContent.length > 0) {
                brandVoice = await learnBrandVoice(
                  recentContent.map((p) => ({
                    content: p.content ?? p.title,
                    platform: p.platform,
                  })),
                );
              }
            }

            const variants = await generateVariants(prompt, brandVoice, platform, count);
            agentResults.variants = { variants, brandVoice };
            break;
          }
        }
      } catch (err) {
        console.error(`[CreateContent] Agent action ${action.action} failed:`, err);
        agentResults[String(action.action)] = { error: "Agent processing failed" };
      }
    }

    // Parse legacy ```json blocks for canvas nodes
    let nodes: unknown[] = [];
    const jsonMatch = fullText.match(/```json\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (parsed.nodes && Array.isArray(parsed.nodes)) {
          nodes = parsed.nodes.map((n: Record<string, unknown>) => {
            const node: Record<string, unknown> = {
              type: n.type ?? "copy",
              title: n.title ?? "Untitled",
              prompt: n.prompt ?? message,
              thumbnail: n.thumbnail ?? null,
            };

            // Handle video projects with scenes
            if (n.type === "video" && n.scenes && Array.isArray(n.scenes)) {
              node.videoProjectId = crypto.randomUUID();
              node.scenes = n.scenes;
            }

            return node;
          });
        }
      } catch {
        // JSON parse failed — no nodes, just use the message
      }
    }

    // Clean the message by removing action and json blocks
    const cleanMessage = fullText
      .replace(/```action\s*[\s\S]*?```/g, "")
      .replace(/```json\s*[\s\S]*?```/g, "")
      .trim();

    // WHY: Validate AI output before displaying to users. Catches system prompt
    // leakage, embedded scripts, and other patterns that indicate manipulation.
    const { content: safeMessage } = validateOutput(cleanMessage);

    return NextResponse.json({
      message: safeMessage,
      nodes,
      actions: validatedActions,
      // WHY: Agent results are returned alongside the message so the frontend can
      // render insights, recommendations, variants, and summaries inline in the chat.
      // Only populated when the AI triggered agent-specific actions.
      ...(Object.keys(agentResults).length > 0 ? { agentResults } : {}),
    });
  } catch (error) {
    console.error("Create content API error:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 },
    );
  }
}
