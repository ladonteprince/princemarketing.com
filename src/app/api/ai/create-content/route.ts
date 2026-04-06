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
});

// WHY: Agentic system prompt — tells Claude to return structured action blocks
// that the frontend will parse and execute against the platform's APIs.
const WORKSPACE_SYSTEM_PROMPT = `${STRATEGIST_SYSTEM_PROMPT}

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

    const { message, history, existingNodes, creationMode, memories, projectName } = parsed.data;

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
You are in STEP MODE. Generate ONE scene at a time and pause for user feedback before generating the next.

When the user asks you to create a video or commercial:
1. Brief written outline of all planned scenes (3-4 sentences total)
2. Output a CREATE_VIDEO action with ONLY the FIRST scene in the scenes array. Do NOT include all 6 scenes — just scene 1.
3. Use placeholder "auto" for videoProjectId
4. Output ADD_REFERENCE_IMAGE for each tagged @asset (also with "auto" videoProjectId)
5. Output TAG_REFERENCE_TO_SCENE only for scene 0 with the references that apply
6. After generation, the user sees the scene inline and can:
   - Approve → triggers your next message which generates scene 2
   - Regenerate → same prompt, different result (no chat needed)
   - Reject + feedback → user types feedback, the scene prompt is auto-revised, scene regenerates
7. When the user says "approve" or "next" → output the NEXT scene as a single CREATE_VIDEO with one scene (use the existing videoProjectId from canvas state if known, otherwise "auto")
8. After the LAST scene is approved → offer "Stitch & Export" or trigger STITCH_VIDEO

CRITICAL Step Mode rules:
- Output ONLY ONE scene per CREATE_VIDEO action in Step Mode
- Wait for explicit user signal ("approve", "next", "looks good") before generating the next scene
- Always include the scene number context: "Scene 1 of 6 generating..."
- NEVER use Auto Mode behavior (all scenes at once) when in Step Mode

Example flow:
User: "Make a 6-scene sneaker commercial with @LaDonte"
You: "I'll generate this scene by scene. The full plan: STIMULATION (boring profiles) → CAPTIVATION (LaDonte reveal) → ANTICIPATION (lifestyle montage) → VALIDATION (final challenge) — 6 scenes total. Generating Scene 1 of 6 now."
[CREATE_VIDEO with scenes: [scene 1 only]]
[ADD_REFERENCE_IMAGE for LaDonte]
[TAG_REFERENCE_TO_SCENE for scene 0]
[Wait for user response]
User: "approve"
You: "Scene 1 approved. Generating Scene 2 of 6..."
[CREATE_VIDEO with scenes: [scene 2 only]]
...`
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
