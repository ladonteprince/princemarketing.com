"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import { InlineVideoSet } from "@/components/chat/InlineVideoCard";
import InlineProductPicker from "@/components/chat/InlineProductPicker";
import InlineTrackPicker from "@/components/chat/InlineTrackPicker";
import InlineVoiceoverPicker from "@/components/chat/InlineVoiceoverPicker";
import { ThinkingDots } from "@/components/ui/ThinkingDots";
import { Badge } from "@/components/ui/Badge";
import {
  PanelRightClose,
  PanelRightOpen,
  AlertCircle,
  ImageIcon,
  Video,
  FileText,
  Check,
  Loader2,
  Calendar,
  Send as SendIcon,
  BarChart3,
  Trash2,
  ListChecks,
  Rocket,
  Brain,
  FolderOpen,
  ChevronDown,
  Plus,
  Mic,
  Music,
  ShoppingBag,
} from "lucide-react";
import type { ContentNode, CanvasAction } from "@/types/canvas";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  nodeRefs?: string[]; // IDs of nodes created by this message
  actionStatuses?: ActionStatus[];
  videoProjectId?: string; // Links to a video project for inline rendering
  // WHY: Product search results attached to this message for inline picker rendering.
  // An array because the AI commonly fires multiple FIND_PRODUCT actions in a
  // single response (e.g., searching for the boat, island, pier, and terminal
  // all at once). Previously this was a single field and each subsequent
  // search overwrote the previous one, so only the last picker rendered.
  productSearches?: Array<{
    query: string;
    label: string;
    category?: "character" | "prop" | "environment";
    videoProjectId?: string;
    products: Array<{
      imageUrl: string;
      title: string;
      sourceUrl: string;
      sourceDomain: string;
      price?: string;
    }>;
  }>;
  // WHY: Score-first. Generated Lyria track options attached to this message
  // for inline picker rendering. User picks one → select-score-track action.
  scorePicker?: {
    videoProjectId: string;
    tracks: Array<{
      id: string;
      prompt: string;
      genre?: string;
      bpm?: number;
      duration: number;
      audioUrl?: string;
      status: "generating" | "ready" | "failed";
    }>;
  };
  // WHY: Production Brain citations returned from QUERY_PRODUCTION_BRAIN.
  // Rendered as expandable citation cards below the assistant message.
  brainCitations?: {
    query: string;
    matches: Array<{
      id: string;
      score: number;
      content: string;
      source: string;
      section: string;
    }>;
  };
  // WHY: Voiceover fork payload. When the AI offers a VO, this carries
  // the draft script + recommended voice so InlineVoiceoverPicker can
  // render the two-path chooser and the voice grid.
  voiceoverOffer?: {
    videoProjectId: string;
    script: Array<{ startTime: number; endTime: number; text: string }>;
    recommendedVoiceId?: string;
  };
};

type ActionStatus = {
  action: string;
  label: string;
  status: "pending" | "running" | "done" | "error";
  detail?: string;
  progress?: number; // 0-100 for progress bar
  stage?: string;    // Current stage name for display
};

type AgentAction = {
  action: string;
  prompt?: string;
  style?: string;
  scenes?: Array<{ prompt: string; duration: number }>;
  type?: string;
  title?: string;
  content?: string;
  platform?: string;
  platforms?: string[];
  scheduledAt?: string;
  period?: string;
  mode?: string;
  sourceImage?: string;
  sourceVideo?: string;
  // Video editor control fields
  videoProjectId?: string;
  sceneIndex?: number;
  url?: string;
  label?: string;
  refLabel?: string;
  // Ads analytics fields
  since?: string;
  until?: string;
  // Publishing fields
  mediaUrl?: string;
  mediaUrls?: string[];
  mediaType?: string;
  pageId?: string;
  scheduled?: number;
  // Reference sheet from photos
  category?: "character" | "prop" | "environment";
  imageUrls?: string[];
  description?: string;
  // Karaoke voiceover
  script?: Array<{ startTime: number; endTime: number; text: string }>;
  // Product search (Firecrawl + browser fallback)
  query?: string;
  // Brain query
  topK?: number;
  // Score-first: track options for CREATE_SCORE
  trackOptions?: Array<{
    prompt: string;
    genre?: string;
    bpm?: number;
    duration: number;
  }>;
  // Voiceover fork
  recommendedVoiceId?: string;
  voiceId?: string;
};

type ChatPanelProps = {
  collapsed: boolean;
  onToggle: () => void;
  onCanvasAction: (action: CanvasAction) => void;
  nodes: ContentNode[];
};

const INITIAL_MESSAGE: Message = {
  id: "initial",
  role: "assistant",
  content:
    "I am your marketing command center. Tell me what to do and I will execute it.\n\nI can create images, videos, copy, schedule posts, publish to your socials, and pull analytics. Try:\n\n- \"Create a product photo for my sneaker launch\"\n- \"Schedule an Instagram post for tomorrow at 9am\"\n- \"Show me this week's analytics\"\n- \"Plan a 30-second ad for Instagram\"",
};

type StatusUpdate = { progress?: number; stage?: string; detail?: string };

// WHY: Execute agentic actions returned by Claude against the platform APIs.
// Each action type maps to a specific API call and canvas operation.
// statusCallback provides real-time progress for long-running actions (SSE streaming).
// WHY: stepMode + waitForApproval enable per-scene gating in Step Mode.
// The CREATE_VIDEO loop awaits waitForApproval() after each scene completes
// (except the last) when stepMode is true. The promise is held by ChatPanel
// and only resolves when the user clicks the Approve button on the inline
// video card. In Auto Mode, waitForApproval is undefined and the loop runs
// straight through.
//
// pendingReferences contains ALL ADD_REFERENCE_IMAGE actions from the same
// AI batch — pre-extracted by processActions BEFORE the loop runs. CREATE_VIDEO
// passes them to the Seedance API so the video actually uses the @LaDonte tag.
// Without this, references would only land in local state AFTER generation
// already started.
async function executeAction(
  action: AgentAction,
  onCanvasAction: (action: CanvasAction) => void,
  nodes: ContentNode[],
  statusCallback?: (update: StatusUpdate) => void,
  stepMode?: boolean,
  waitForApproval?: (sceneIndex: number) => Promise<void>,
  pendingReferences?: Array<{ url: string; label: string }>,
  batchContext?: {
    createVideoSceneCounts: Map<string, number>;
    referenceLabels: Set<string>;
  },
): Promise<{
  success: boolean;
  detail: string;
  nodeRef?: string;
  videoProjectId?: string;
  productSearch?: {
    query: string;
    label: string;
    category?: "character" | "prop" | "environment";
    videoProjectId?: string;
    products: Array<{ imageUrl: string; title: string; sourceUrl: string; sourceDomain: string; price?: string }>;
  };
  scorePicker?: {
    videoProjectId: string;
    tracks: Array<{
      id: string;
      prompt: string;
      genre?: string;
      bpm?: number;
      duration: number;
      audioUrl?: string;
      status: "generating" | "ready" | "failed";
    }>;
  };
  brainCitations?: {
    query: string;
    matches: Array<{
      id: string;
      score: number;
      content: string;
      source: string;
      section: string;
    }>;
  };
  voiceoverOffer?: {
    videoProjectId: string;
    script: Array<{ startTime: number; endTime: number; text: string }>;
    recommendedVoiceId?: string;
  };
}> {
  switch (action.action) {
    case "CREATE_IMAGE": {
      try {
        const res = await fetch("/api/generate/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: action.prompt,
            style: action.style ?? "social",
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          const errMsg = typeof data.error === "string" ? data.error : data.error?.message ?? "Image generation failed";
          throw new Error(errMsg);
        }

        const id = crypto.randomUUID();
        let yPos = 60;
        for (const n of nodes) {
          if (n.position.y + 200 > yPos) yPos = n.position.y + 200;
        }

        const imageUrl = data.url ?? data.imageUrl ?? data.data?.imageUrl;
        const node: ContentNode = {
          id,
          type: "image",
          title: action.prompt?.slice(0, 50) ?? "Generated Image",
          thumbnail: imageUrl ? `/api/proxy/image?url=${encodeURIComponent(imageUrl)}` : undefined,
          status: "draft",
          prompt: action.prompt,
          createdAt: new Date().toISOString(),
          connections: [],
          position: { x: 60, y: yPos },
        };
        onCanvasAction({ type: "add-node", node });
        return { success: true, detail: "Image created", nodeRef: id };
      } catch (err) {
        return { success: false, detail: err instanceof Error ? err.message : "Failed" };
      }
    }

    case "CREATE_VIDEO": {
      try {
        const id = crypto.randomUUID();
        // WHY: Use pre-assigned videoProjectId from processActions if present
        // (set so subsequent ADD_REFERENCE_IMAGE / TAG_REFERENCE_TO_SCENE actions
        // can target this exact project), otherwise generate a fresh one.
        const videoProjectId =
          action.videoProjectId && action.videoProjectId !== "auto" && action.videoProjectId !== "current" && action.videoProjectId !== "latest"
            ? String(action.videoProjectId)
            : crypto.randomUUID();
        let yPos = 60;
        for (const n of nodes) {
          if (n.position.y + 200 > yPos) yPos = n.position.y + 200;
        }

        const node: ContentNode = {
          id,
          type: "video",
          title: action.prompt?.slice(0, 50) ?? "Video Project",
          status: "draft",
          prompt: action.prompt,
          videoProjectId,
          createdAt: new Date().toISOString(),
          connections: [],
          position: { x: 60, y: yPos },
        };
        onCanvasAction({ type: "add-node", node });

        // Always open the video editor for the new project
        onCanvasAction({ type: "open-video-editor", videoProjectId });

        // WHY: Scenes are created with status "draft" (not "generating") and then
        // generated SEQUENTIALLY — one at a time. This prevents Seedance API
        // overload from parallel requests (which break) and aligns with the
        // Attention Architecture where each scene has a specific psychological
        // role (Stimulation → Anticipation → Validation) that benefits from
        // sequential generation + review.
        const scenes = action.scenes ?? [];
        if (scenes.length > 0) {
          // Create all scene cards as "draft" first so the user sees the plan
          for (const scene of scenes) {
            onCanvasAction({
              type: "add-video-scene",
              videoProjectId,
              scene: {
                prompt: scene.prompt,
                mode: (action.mode as "t2v" | "i2v" | "character" | "extend") ?? "t2v",
                duration: scene.duration ?? 5,
              },
            });
          }

          // Generate scenes sequentially — scene 1, wait, scene 2, wait, etc.
          const { streamGeneration } = await import("@/lib/api");
          let completedCount = 0;

          for (let i = 0; i < scenes.length; i++) {
            const scene = scenes[i];
            const sceneNum = i + 1;
            const totalScenes = scenes.length;

            if (statusCallback) {
              statusCallback({
                progress: Math.round((i / totalScenes) * 100),
                stage: `Scene ${sceneNum}/${totalScenes}`,
                detail: `Generating scene ${sceneNum}: ${scene.prompt.slice(0, 60)}...`,
              });
            }

            // Mark this scene as generating
            onCanvasAction({
              type: "generate-video-scene",
              videoProjectId,
              sceneIndex: i,
            });

            // WHY: Set progressStartedAt + initial progress=0 in localStorage
            // so InlineVideoCard's synthetic clock has a known reference point.
            const sceneStartedAt = Date.now();
            try {
              const saved = localStorage.getItem("pm-video-projects");
              if (saved) {
                const entries: [string, { scenes: Array<{ progress?: number; progressStage?: string; progressStartedAt?: number; status?: string }> }][] = JSON.parse(saved);
                const updated = entries.map(([id, proj]) => {
                  if (id !== videoProjectId) return [id, proj] as const;
                  const updatedScenes = proj.scenes.map((s, idx) =>
                    idx === i
                      ? { ...s, status: "generating", progress: 0, progressStage: "Submitting", progressStartedAt: sceneStartedAt }
                      : s,
                  );
                  return [id, { ...proj, scenes: updatedScenes }] as const;
                });
                localStorage.setItem("pm-video-projects", JSON.stringify(updated));
                // Trigger a storage event for the InlineVideoCard to re-render
                window.dispatchEvent(new Event("pm-video-projects-update"));
              }
            } catch { /* ignore */ }

            // WHY: If references are pending from ADD_REFERENCE_IMAGE actions
            // in the same AI batch, switch to character mode (omni-reference)
            // and pass the references to Seedance. Otherwise the @LaDonte tag
            // is silently ignored and we get a generic person.
            const hasReferences = pendingReferences && pendingReferences.length > 0;
            const videoMode = action.mode
              ?? (action.sourceImage ? "i2v" : undefined)
              ?? (action.sourceVideo ? "extend" : undefined)
              ?? (hasReferences ? "character" : "t2v");

            const videoPayload: Record<string, unknown> = {
              prompt: scene.prompt,
              duration: scene.duration ?? 5,
              aspectRatio: "16:9",
              mode: videoMode,
              // WHY: Music is a post-production layer added by Sound Director +
              // Lyria 3 after stitching. Each scene must be SILENT so the score
              // doesn't fight with baked-in music tracks.
              includeAudio: false,
            };
            if (action.sourceImage) videoPayload.sourceImage = action.sourceImage;
            if (action.sourceVideo) videoPayload.sourceVideo = action.sourceVideo;
            if (hasReferences) {
              videoPayload.referenceImages = pendingReferences;
            }

            try {
              const res = await fetch("/api/generate/video", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(videoPayload),
              });
              const data = await res.json();

              if (res.ok && data.generationId) {
                // Wait for this scene to complete before starting the next
                await new Promise<void>((resolve) => {
                  const cancel = streamGeneration(data.generationId, {
                    onProgress: (event) => {
                      const sceneProgress = event.data.progress ?? 0;
                      const stageLabel = event.data.stage ?? event.data.message ?? "Generating";

                      // WHY: Write per-scene progress to localStorage so
                      // InlineVideoCard renders the bar in real time.
                      try {
                        const saved = localStorage.getItem("pm-video-projects");
                        if (saved) {
                          const entries: [string, { scenes: Array<{ progress?: number; progressStage?: string }> }][] = JSON.parse(saved);
                          const updated = entries.map(([id, proj]) => {
                            if (id !== videoProjectId) return [id, proj] as const;
                            const updatedScenes = proj.scenes.map((s, idx) =>
                              idx === i ? { ...s, progress: sceneProgress, progressStage: stageLabel } : s,
                            );
                            return [id, { ...proj, scenes: updatedScenes }] as const;
                          });
                          localStorage.setItem("pm-video-projects", JSON.stringify(updated));
                          window.dispatchEvent(new Event("pm-video-projects-update"));
                        }
                      } catch { /* ignore */ }

                      if (statusCallback) {
                        const overallProgress = Math.round(((i + sceneProgress / 100) / totalScenes) * 100);
                        statusCallback({
                          progress: overallProgress,
                          stage: `Scene ${sceneNum} of ${totalScenes}`,
                          detail: `${stageLabel} (${sceneProgress}%)`,
                        });
                      }
                    },
                    onCompleted: (event) => {
                      // WHY: Critic auto-score is included in the completion event.
                      // Also flip status to "ready" + clear progress so the
                      // InlineVideoCard renders the actual video.
                      const score = event.data.score;
                      const resultUrl = event.data.resultUrl;
                      try {
                        const saved = localStorage.getItem("pm-video-projects");
                        if (saved) {
                          const entries: [string, { scenes: Array<{ id: string; score?: number; status?: string; videoUrl?: string; progress?: number }> }][] = JSON.parse(saved);
                          const updated = entries.map(([id, proj]) => {
                            if (id !== videoProjectId) return [id, proj] as const;
                            const updatedScenes = proj.scenes.map((s, idx) =>
                              idx === i
                                ? {
                                    ...s,
                                    status: "ready",
                                    videoUrl: resultUrl
                                      ? `/api/proxy/image?url=${encodeURIComponent(resultUrl)}`
                                      : s.videoUrl,
                                    progress: 100,
                                    progressStage: "Complete",
                                    ...(score != null ? { score } : {}),
                                  }
                                : s,
                            );
                            return [id, { ...proj, scenes: updatedScenes }] as const;
                          });
                          localStorage.setItem("pm-video-projects", JSON.stringify(updated));
                          window.dispatchEvent(new Event("pm-video-projects-update"));
                        }
                      } catch { /* ignore */ }
                      completedCount++;
                      resolve();
                    },
                    onFailed: () => {
                      resolve(); // Continue to next scene even if one fails
                    },
                    onError: () => {
                      resolve();
                    },
                  });

                  // Per-scene timeout: 10 minutes
                  setTimeout(() => {
                    cancel();
                    resolve();
                  }, 10 * 60 * 1000);
                });
              }
            } catch {
              // Scene generation failed — continue to next scene
            }

            // WHY: Step Mode gating — after each scene completes, pause the
            // loop and wait for the user to click Approve on the inline card.
            // The waitForApproval promise is held by ChatPanel and resolves
            // when the user clicks Approve (or Reject + feedback regenerates
            // the same scene). Skip on the last scene since there's nothing to
            // advance to.
            if (stepMode && waitForApproval && i < scenes.length - 1) {
              if (statusCallback) {
                statusCallback({
                  progress: Math.round(((i + 1) / totalScenes) * 100),
                  stage: `Scene ${sceneNum} of ${totalScenes}`,
                  detail: `Waiting for your approval to continue...`,
                });
              }
              await waitForApproval(i);
            }
          }

          // WHY: Friendlier completion message — "All 6 scenes ready" instead
          // of the cryptic "6/6 scenes generated sequentially". On partial
          // completion, show what worked vs failed clearly.
          const detailMessage = completedCount === scenes.length
            ? `All ${scenes.length} ${scenes.length === 1 ? "scene" : "scenes"} ready`
            : completedCount === 0
              ? `Generation failed — 0 of ${scenes.length} ${scenes.length === 1 ? "scene" : "scenes"} completed`
              : `${completedCount} of ${scenes.length} scenes ready (${scenes.length - completedCount} failed)`;

          return {
            success: completedCount > 0,
            detail: detailMessage,
            nodeRef: id,
            videoProjectId,
          };
        }

        return { success: true, detail: "Video project created", nodeRef: id, videoProjectId };
      } catch (err) {
        return { success: false, detail: err instanceof Error ? err.message : "Failed" };
      }
    }

    case "CREATE_COPY": {
      try {
        const res = await fetch("/api/generate/copy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: action.prompt,
            type: action.type ?? "social",
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Copy generation failed");

        const id = crypto.randomUUID();
        let yPos = 60;
        for (const n of nodes) {
          if (n.position.y + 200 > yPos) yPos = n.position.y + 200;
        }

        const node: ContentNode = {
          id,
          type: "copy",
          title: action.prompt?.slice(0, 50) ?? "Generated Copy",
          status: "draft",
          prompt: action.prompt,
          createdAt: new Date().toISOString(),
          connections: [],
          position: { x: 60, y: yPos },
        };
        onCanvasAction({ type: "add-node", node });
        return { success: true, detail: data.copy ? "Copy generated" : "Copy created", nodeRef: id };
      } catch (err) {
        return { success: false, detail: err instanceof Error ? err.message : "Failed" };
      }
    }

    case "SCHEDULE_POST": {
      try {
        const res = await fetch("/api/calendar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: action.title ?? "Scheduled Post",
            content: action.content ?? "",
            platform: (action.platform ?? "INSTAGRAM").toUpperCase(),
            scheduledAt: action.scheduledAt ?? new Date(Date.now() + 86400000).toISOString(),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Scheduling failed");
        return { success: true, detail: `Scheduled for ${new Date(action.scheduledAt ?? Date.now()).toLocaleDateString()}` };
      } catch (err) {
        return { success: false, detail: err instanceof Error ? err.message : "Failed" };
      }
    }

    case "PUBLISH_NOW": {
      try {
        const res = await fetch("/api/social/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: action.content ?? "",
            platforms: action.platforms ?? [],
            mediaUrl: action.mediaUrl,
            mediaUrls: action.mediaUrls,
            mediaType: action.mediaType ?? action.type,
            scheduled: action.scheduled,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Publishing failed");

        const results = data.results ?? {};
        const successes = Object.values(results).filter((r: unknown) => (r as { success: boolean }).success).length;
        const total = Object.keys(results).length;
        return { success: successes > 0, detail: `Published to ${successes}/${total} platforms` };
      } catch (err) {
        return { success: false, detail: err instanceof Error ? err.message : "Failed" };
      }
    }

    case "GET_ANALYTICS": {
      try {
        const res = await fetch("/api/analytics");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Analytics fetch failed");

        const summary = [
          `Posts: ${data.postsPublished ?? 0}`,
          `Impressions: ${data.totalImpressions?.toLocaleString() ?? 0}`,
          `Engagement: ${data.totalEngagement?.toLocaleString() ?? 0}`,
          `Clicks: ${data.totalClicks?.toLocaleString() ?? 0}`,
        ].join(" | ");
        return { success: true, detail: summary };
      } catch (err) {
        return { success: false, detail: err instanceof Error ? err.message : "Failed" };
      }
    }

    case "GET_ADS_ANALYTICS": {
      try {
        const params = new URLSearchParams();
        if (action.platform) params.set("platform", action.platform);
        if (action.since) params.set("since", action.since);
        if (action.until) params.set("until", action.until);
        const qs = params.toString();
        const res = await fetch(`/api/analytics/ads${qs ? `?${qs}` : ""}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Ads analytics fetch failed");

        const t = data.totals ?? {};
        const summary = [
          `Campaigns: ${t.activeCampaigns ?? 0} active`,
          `Spend: $${parseFloat(t.spend ?? 0).toFixed(2)}`,
          `Impressions: ${parseInt(t.impressions ?? 0).toLocaleString()}`,
          `Clicks: ${parseInt(t.clicks ?? 0).toLocaleString()}`,
          `CTR: ${t.ctr ?? "0"}%`,
          `Conversions: ${t.conversions ?? 0}`,
        ].join(" | ");
        return { success: true, detail: summary };
      } catch (err) {
        return { success: false, detail: err instanceof Error ? err.message : "Failed" };
      }
    }

    // WHY: New video modes delegate to CREATE_VIDEO logic with mode pre-set.
    // This keeps backward compatibility while supporting i2v, extend, and video-edit.
    case "ANIMATE_IMAGE": {
      const i2vAction: AgentAction = {
        ...action,
        action: "CREATE_VIDEO",
        mode: "i2v",
      };
      return executeAction(i2vAction, onCanvasAction, nodes, statusCallback);
    }

    case "EXTEND_VIDEO": {
      const extendAction: AgentAction = {
        ...action,
        action: "CREATE_VIDEO",
        mode: "extend",
      };
      return executeAction(extendAction, onCanvasAction, nodes, statusCallback);
    }

    case "EDIT_VIDEO": {
      const editAction: AgentAction = {
        ...action,
        action: "CREATE_VIDEO",
        mode: "video-edit",
      };
      return executeAction(editAction, onCanvasAction, nodes, statusCallback);
    }

    // --- Video Editor Control Actions ---
    case "GENERATE_VIDEO_SCENE": {
      if (!action.videoProjectId || action.sceneIndex == null) {
        return { success: false, detail: "Missing videoProjectId or sceneIndex" };
      }
      onCanvasAction({
        type: "generate-video-scene",
        videoProjectId: action.videoProjectId,
        sceneIndex: action.sceneIndex,
      });
      return { success: true, detail: `Scene ${action.sceneIndex + 1} generation triggered` };
    }

    case "EXTEND_VIDEO_SCENE": {
      if (!action.videoProjectId || action.sceneIndex == null) {
        return { success: false, detail: "Missing videoProjectId or sceneIndex" };
      }
      onCanvasAction({
        type: "extend-video-scene",
        videoProjectId: action.videoProjectId,
        sceneIndex: action.sceneIndex,
      });
      return { success: true, detail: `Scene ${action.sceneIndex + 1} set to extend mode and regenerating` };
    }

    case "STITCH_VIDEO": {
      if (!action.videoProjectId) {
        return { success: false, detail: "Missing videoProjectId" };
      }
      onCanvasAction({
        type: "stitch-video",
        videoProjectId: action.videoProjectId,
      });
      return { success: true, detail: "Stitching all scenes into final video" };
    }

    case "SET_SCENE_MODE": {
      if (!action.videoProjectId || action.sceneIndex == null || !action.mode) {
        return { success: false, detail: "Missing videoProjectId, sceneIndex, or mode" };
      }
      onCanvasAction({
        type: "set-scene-mode",
        videoProjectId: action.videoProjectId,
        sceneIndex: action.sceneIndex,
        mode: action.mode as "t2v" | "i2v" | "character" | "extend",
      });
      return { success: true, detail: `Scene ${action.sceneIndex + 1} mode set to ${action.mode}` };
    }

    case "ADD_REFERENCE_IMAGE": {
      if (!action.videoProjectId || !action.url || !action.label) {
        return { success: false, detail: "Missing videoProjectId, url, or label" };
      }
      onCanvasAction({
        type: "add-reference-image",
        videoProjectId: action.videoProjectId,
        url: action.url,
        label: action.label,
      });
      return { success: true, detail: `Reference image "${action.label}" added to project` };
    }

    case "TAG_REFERENCE_TO_SCENE": {
      if (!action.videoProjectId || action.sceneIndex == null || !action.refLabel) {
        return { success: false, detail: "Missing videoProjectId, sceneIndex, or refLabel" };
      }
      // WHY: Pre-validate against the BATCH context (not localStorage,
      // which has React-state-update races). batchContext is populated by
      // processActions before any action runs — it knows every CREATE_VIDEO
      // in this response and how many scenes each one declares, plus every
      // ADD_REFERENCE_IMAGE label. Surfaces the real failure when the AI
      // emits TAG without a matching CREATE_VIDEO in the same response.
      const ctx = batchContext;
      if (ctx) {
        const sceneCount = ctx.createVideoSceneCounts.get(String(action.videoProjectId));
        if (sceneCount == null) {
          return { success: false, detail: `Cannot tag — video project ${action.videoProjectId} was not created in this response. CREATE_VIDEO must be emitted in the same response as TAG_REFERENCE_TO_SCENE.` };
        }
        if (action.sceneIndex >= sceneCount) {
          return { success: false, detail: `Cannot tag — scene index ${action.sceneIndex} is out of range (CREATE_VIDEO declared ${sceneCount} scenes)` };
        }
        if (!ctx.referenceLabels.has(action.refLabel)) {
          return { success: false, detail: `Cannot tag — reference "${action.refLabel}" was not added in this response or attached to the project. Emit ADD_REFERENCE_IMAGE first or check the spelling.` };
        }
      }
      onCanvasAction({
        type: "tag-reference-to-scene",
        videoProjectId: action.videoProjectId,
        sceneIndex: action.sceneIndex,
        refLabel: action.refLabel,
      });
      return { success: true, detail: `Reference "${action.refLabel}" tagged to scene ${action.sceneIndex + 1}` };
    }

    case "FIND_PRODUCT": {
      // WHY: Search the real web for actual products via Firecrawl (with
      // Playwright browser fallback for sites that block scraping). Returns
      // up to 5 product cards that the user picks inline in the chat. The
      // selected product gets auto-tagged as a reference image.
      if (!action.query || !action.label) {
        return { success: false, detail: "Missing query or label" };
      }
      try {
        const res = await fetch("/api/research/find-product", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: action.query, limit: 5 }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const code: string | undefined = data?.code;
          if (code === "TIMEOUT" || res.status === 504) {
            return { success: false, detail: `Search timed out for "${action.query}" — try again in a moment.` };
          }
          if (res.status === 429) {
            return { success: false, detail: "Rate limited — wait a minute and try again." };
          }
          if (code === "API_KEY_MISSING") {
            return { success: false, detail: "Product search backend isn't configured yet." };
          }
          return { success: false, detail: data?.error ?? "Product search failed" };
        }
        const products = data.products ?? [];
        if (products.length === 0) {
          return { success: false, detail: data?.message ?? `No products found for "${action.query}" — try a more specific search.` };
        }
        return {
          success: true,
          detail: `Found ${products.length} products for "${action.query}" — pick one to use as a reference`,
          productSearch: {
            query: action.query,
            label: action.label,
            category: action.category,
            videoProjectId: action.videoProjectId && action.videoProjectId !== "auto" && action.videoProjectId !== "current" && action.videoProjectId !== "latest"
              ? String(action.videoProjectId)
              : undefined,
            products,
          },
        };
      } catch (err) {
        return { success: false, detail: err instanceof Error ? err.message : "Product search failed" };
      }
    }

    case "OFFER_VOICEOVER": {
      // WHY: The voiceover fork. Stashes the draft script on the project
      // AND returns a voiceoverOffer payload that renders the inline
      // two-path picker (karaoke vs AI voice). No audio is generated yet;
      // that happens when the user clicks one of the two options.
      if (!action.videoProjectId || !action.script?.length) {
        return { success: false, detail: "Missing videoProjectId or script" };
      }
      onCanvasAction({
        type: "set-voiceover-script",
        videoProjectId: String(action.videoProjectId),
        script: action.script,
      });
      return {
        success: true,
        detail: `Voiceover script ready — ${action.script.length} line${action.script.length === 1 ? "" : "s"}. Pick how to record it.`,
        voiceoverOffer: {
          videoProjectId: String(action.videoProjectId),
          script: action.script,
          recommendedVoiceId: action.recommendedVoiceId,
        },
      };
    }

    case "GENERATE_VOICEOVER": {
      // WHY: Direct AI voice generation path. Normal flow goes through
      // OFFER_VOICEOVER → inline picker → this action, but the AI can
      // also call it directly when the user says "use the same voice".
      if (!action.videoProjectId || !action.voiceId || !action.script?.length) {
        return { success: false, detail: "Missing videoProjectId, voiceId, or script" };
      }
      try {
        const res = await fetch("/api/generate/voiceover", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoProjectId: action.videoProjectId,
            voiceId: action.voiceId,
            script: action.script,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          return { success: false, detail: data?.error ?? "Voiceover generation failed" };
        }
        const data = await res.json();
        const audioUrl =
          data?.data?.audioUrl ?? data?.audioUrl ?? data?.url;
        if (!audioUrl) {
          return { success: false, detail: "Voiceover returned no URL" };
        }
        onCanvasAction({
          type: "set-voiceover",
          videoProjectId: String(action.videoProjectId),
          url: audioUrl,
          source: "ai",
          voiceId: action.voiceId,
        });
        return {
          success: true,
          detail: `Voiceover generated (${data?.data?.voiceName ?? data?.voiceName ?? "AI voice"})`,
        };
      } catch (err) {
        return { success: false, detail: err instanceof Error ? err.message : "Voiceover generation failed" };
      }
    }

    case "CREATE_SCORE": {
      // WHY: Score-first production. Fire Lyria 3x in parallel for the
      // candidate track options. Returns a scorePicker payload that the
      // chat renders as an inline track selector. The chosen track locks
      // the project's timeline before any Seedance calls happen.
      if (!action.videoProjectId || !action.trackOptions?.length) {
        return { success: false, detail: "Missing videoProjectId or trackOptions" };
      }
      try {
        const res = await fetch("/api/generate/score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoProjectId: action.videoProjectId,
            trackOptions: action.trackOptions,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          return { success: false, detail: data?.error ?? "Score generation failed" };
        }
        const data = await res.json();
        const tracks = data.tracks ?? [];
        const readyCount = tracks.filter((t: { status: string }) => t.status === "ready").length;
        if (readyCount === 0) {
          return { success: false, detail: "No tracks generated successfully" };
        }
        // Also push into the project state so the canvas knows
        onCanvasAction({
          type: "add-score-options",
          videoProjectId: String(action.videoProjectId),
          options: tracks,
        });
        return {
          success: true,
          detail: `Generated ${readyCount} track option${readyCount === 1 ? "" : "s"} — pick one to lock the timeline`,
          scorePicker: {
            videoProjectId: String(action.videoProjectId),
            tracks,
          },
        };
      } catch (err) {
        return { success: false, detail: err instanceof Error ? err.message : "Score generation failed" };
      }
    }

    case "QUERY_PRODUCTION_BRAIN": {
      // WHY: Agentic research tool. Claude calls this when a creative or
      // strategic decision needs grounding in the 125-vector research
      // corpus. Returns citations that render inline below the message
      // so the user sees which research informed the advice.
      if (!action.query) {
        return { success: false, detail: "Missing query" };
      }
      try {
        const res = await fetch("/api/ai/query-brain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: action.query, topK: action.topK ?? 5 }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          return { success: false, detail: data?.error ?? "Brain query failed" };
        }
        const data = await res.json();
        const matches = data?.data?.matches ?? data?.matches ?? [];
        if (matches.length === 0) {
          return { success: false, detail: `No research found for "${action.query}"` };
        }
        return {
          success: true,
          detail: `Found ${matches.length} research citation${matches.length === 1 ? "" : "s"}`,
          brainCitations: {
            query: action.query,
            matches,
          },
        };
      } catch (err) {
        return { success: false, detail: err instanceof Error ? err.message : "Brain query failed" };
      }
    }

    case "CREATE_REFERENCE_FROM_PHOTOS": {
      // WHY: Generate a multi-angle reference sheet from user-uploaded photos
      // via Nano Banana Pro multi-image input. Used when the user has photos
      // of themselves/their product/their location that should be the source of truth.
      try {
        if (!action.imageUrls || action.imageUrls.length === 0) {
          return { success: false, detail: "No photos provided" };
        }
        const res = await fetch("/api/generate/reference-sheet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageUrls: action.imageUrls,
            category: action.category ?? "character",
            label: action.label ?? "Reference",
            description: action.description,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return { success: false, detail: err?.error ?? "Reference sheet generation failed" };
        }
        const data = await res.json();
        const generationId = data.generationId;

        // Poll for completion
        if (generationId) {
          const { streamGeneration } = await import("@/lib/api");
          return await new Promise((resolve) => {
            const cancel = streamGeneration(generationId, {
              onCompleted: (event) => {
                const url = event.data.resultUrl;
                if (url && action.videoProjectId) {
                  // Auto-add to the video project as a reference image
                  onCanvasAction({
                    type: "add-reference-image",
                    videoProjectId: action.videoProjectId,
                    url,
                    label: action.label ?? "Reference",
                    category: action.category === "environment" ? "scene" : (action.category ?? "character"),
                  });
                }
                resolve({ success: true, detail: `Reference sheet "${action.label}" ready` });
              },
              onFailed: () => resolve({ success: false, detail: "Reference sheet generation failed" }),
              onError: () => resolve({ success: false, detail: "Stream error" }),
            });
            setTimeout(() => { cancel(); resolve({ success: false, detail: "Reference generation timed out" }); }, 10 * 60 * 1000);
          });
        }
        return { success: true, detail: "Reference sheet queued" };
      } catch (err) {
        return { success: false, detail: err instanceof Error ? err.message : "Failed" };
      }
    }

    case "OPEN_KARAOKE": {
      // WHY: Opens the inline KaraokeRecorder in the VideoEditor with the
      // timestamped script so the user can record their own voiceover against
      // the playing video. The script is provided by the AI based on the
      // generated voiceover content.
      if (!action.videoProjectId || !action.script || action.script.length === 0) {
        return { success: false, detail: "Missing videoProjectId or script" };
      }
      onCanvasAction({
        type: "open-karaoke",
        videoProjectId: action.videoProjectId,
        script: action.script,
      });
      return { success: true, detail: "Karaoke recorder opened" };
    }

    case "GENERATE_SCORE": {
      // WHY: Triggers the Sound Director → Lyria 3 pipeline. The frontend
      // handles the actual call (it has access to the stitched video URL
      // and scene timing). This action just signals the intent.
      if (!action.videoProjectId) {
        return { success: false, detail: "Missing videoProjectId" };
      }
      // The VideoEditor watches for this via onCanvasAction and triggers
      // the Sound Director pipeline directly.
      onCanvasAction({
        type: "stitch-video",
        videoProjectId: action.videoProjectId,
      });
      return { success: true, detail: "Score generation triggered" };
    }

    default:
      return { success: false, detail: `Unknown action: ${action.action}` };
  }
}

const ACTION_LABELS: Record<string, { label: string; icon: typeof ImageIcon }> = {
  CREATE_IMAGE: { label: "Generating image", icon: ImageIcon },
  CREATE_VIDEO: { label: "Creating video project", icon: Video },
  ANIMATE_IMAGE: { label: "Animating image to video", icon: Video },
  EXTEND_VIDEO: { label: "Extending video", icon: Video },
  EDIT_VIDEO: { label: "Editing video", icon: Video },
  CREATE_COPY: { label: "Generating copy", icon: FileText },
  SCHEDULE_POST: { label: "Scheduling post", icon: Calendar },
  PUBLISH_NOW: { label: "Publishing", icon: SendIcon },
  GET_ANALYTICS: { label: "Fetching analytics", icon: BarChart3 },
  GET_ADS_ANALYTICS: { label: "Fetching ads analytics", icon: BarChart3 },
  GENERATE_VIDEO_SCENE: { label: "Generating scene", icon: Video },
  EXTEND_VIDEO_SCENE: { label: "Extending scene", icon: Video },
  STITCH_VIDEO: { label: "Stitching video", icon: Video },
  SET_SCENE_MODE: { label: "Setting scene mode", icon: Video },
  ADD_REFERENCE_IMAGE: { label: "Adding reference image", icon: ImageIcon },
  TAG_REFERENCE_TO_SCENE: { label: "Tagging reference to scene", icon: ImageIcon },
  FIND_PRODUCT: { label: "Searching the web for products", icon: ShoppingBag },
  CREATE_SCORE: { label: "Generating score options", icon: FileText },
  QUERY_PRODUCTION_BRAIN: { label: "Consulting production brain", icon: FileText },
  OFFER_VOICEOVER: { label: "Drafting voiceover script", icon: Mic },
  GENERATE_VOICEOVER: { label: "Generating AI voiceover", icon: Mic },
  CREATE_REFERENCE_FROM_PHOTOS: { label: "Building reference sheet from photos", icon: ImageIcon },
  OPEN_KARAOKE: { label: "Opening karaoke recorder", icon: Mic },
  GENERATE_SCORE: { label: "Composing score", icon: Music },
  SAVE_MEMORY: { label: "Saving memory", icon: Brain },
  DELETE_MEMORY: { label: "Forgetting memory", icon: Brain },
};

// Parse AI responses for structured content creation actions (legacy [NODE:...] markers)
function parseContentActions(
  responseText: string,
  userMessage: string,
): { actions: CanvasAction[]; nodeRefs: string[] } {
  const actions: CanvasAction[] = [];
  const nodeRefs: string[] = [];

  const nodePattern = /\[NODE:(\w+)\|([^\]]+)\]/g;
  let match;
  let xPos = 60;

  while ((match = nodePattern.exec(responseText)) !== null) {
    const type = match[1].toLowerCase() as ContentNode["type"];
    const title = match[2];
    const id = crypto.randomUUID();

    const node: ContentNode = {
      id,
      type,
      title,
      status: "draft",
      prompt: userMessage,
      createdAt: new Date().toISOString(),
      connections: nodeRefs.length > 0 ? [nodeRefs[nodeRefs.length - 1]] : [],
      position: { x: xPos, y: 60 + nodeRefs.length * 200 },
    };

    actions.push({ type: "add-node", node });
    nodeRefs.push(id);
    xPos += 260;
  }

  return { actions, nodeRefs };
}

// WHY: Chat history is per-project. Each project gets its own key
// "pm-chat-messages-{projectId}" so switching projects loads the
// conversation that belongs to that project — and starting a fresh
// project gives you a fresh chat instead of leaking the last project's
// context. The legacy unscoped "pm-chat-messages" key is migrated into
// the default project on first load.
const CHAT_STORAGE_KEY_PREFIX = "pm-chat-messages-";
const LEGACY_CHAT_STORAGE_KEY = "pm-chat-messages";
const MEMORIES_STORAGE_KEY = "pm-ai-memories";

type Project = {
  id: string;
  name: string;
  createdAt: string;
};

type AIMemory = {
  id: string;
  type: "brand" | "feedback" | "project" | "asset" | "reference";
  title: string;
  content: string;
  createdAt: string;
};

export function ChatPanel({ collapsed, onToggle, onCanvasAction, nodes }: ChatPanelProps) {
  const { data: session } = useSession();
  // WHY: Initial messages load from the active project's per-project key.
  // We resolve the active project ID synchronously here (before the
  // useState below sets it) by reading localStorage directly so the
  // first paint already shows the right conversation.
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window === "undefined") return [INITIAL_MESSAGE];
    const initialProjectId = localStorage.getItem("pm-active-project") || "default";
    const projectKey = `${CHAT_STORAGE_KEY_PREFIX}${initialProjectId}`;
    // First, try the per-project key
    const saved = localStorage.getItem(projectKey);
    if (saved) {
      try { return JSON.parse(saved); } catch { /* ignore corrupt data */ }
    }
    // Migrate legacy unscoped chat into the default project on first run
    if (initialProjectId === "default") {
      const legacy = localStorage.getItem(LEGACY_CHAT_STORAGE_KEY);
      if (legacy) {
        try {
          const parsed = JSON.parse(legacy);
          localStorage.setItem(projectKey, legacy);
          localStorage.removeItem(LEGACY_CHAT_STORAGE_KEY);
          return parsed;
        } catch { /* ignore */ }
      }
    }
    return [INITIAL_MESSAGE];
  });
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId] = useState(() => crypto.randomUUID());
  // WHY: Three creation modes —
  // plan: AI builds the written plan, never generates without explicit "execute"
  // step: AI generates one scene at a time, pauses for approval/feedback before next
  // auto: AI generates all scenes hands-off, no stops
  const [creationMode, setCreationMode] = useState<"plan" | "step" | "auto">("plan");

  // WHY: Force re-render when the CREATE_VIDEO loop writes progress updates
  // to localStorage. The inline video set IIFE reads from localStorage on
  // every render, so bumping this counter triggers a re-read.
  const [, setVideoProjectsTick] = useState(0);
  useEffect(() => {
    const handler = () => setVideoProjectsTick((t) => t + 1);
    window.addEventListener("pm-video-projects-update", handler);
    return () => window.removeEventListener("pm-video-projects-update", handler);
  }, []);

  // WHY: Per-scene approval gating in Step Mode. The CREATE_VIDEO loop
  // calls waitForApproval(sceneIndex) after each scene completes; this
  // returns a promise that only resolves when the user clicks Approve on
  // that scene. The resolver is stored in a ref so onApproveScene can call it.
  const pendingApprovalResolverRef = useRef<{ sceneIndex: number; resolve: () => void } | null>(null);
  const waitForApproval = useCallback((sceneIndex: number): Promise<void> => {
    return new Promise<void>((resolve) => {
      pendingApprovalResolverRef.current = { sceneIndex, resolve };
    });
  }, []);
  const releaseApproval = useCallback((sceneIndex: number) => {
    const pending = pendingApprovalResolverRef.current;
    if (pending && pending.sceneIndex === sceneIndex) {
      pending.resolve();
      pendingApprovalResolverRef.current = null;
    }
  }, []);
  // WHY: We need to read the LATEST creationMode inside the executeAction
  // closure (which captures stale state). Use a ref that always tracks current.
  const creationModeRef = useRef(creationMode);
  useEffect(() => {
    creationModeRef.current = creationMode;
  }, [creationMode]);

  // --- Project system ---
  const [projects, setProjects] = useState<Project[]>(() => {
    if (typeof window === "undefined") return [{ id: "default", name: "Default Project", createdAt: new Date().toISOString() }];
    try {
      const saved = JSON.parse(localStorage.getItem("pm-projects") || "[]");
      return saved.length > 0 ? saved : [{ id: "default", name: "Default Project", createdAt: new Date().toISOString() }];
    } catch { return [{ id: "default", name: "Default Project", createdAt: new Date().toISOString() }]; }
  });
  const [activeProjectId, setActiveProjectIdState] = useState<string>(() => {
    if (typeof window === "undefined") return "default";
    return localStorage.getItem("pm-active-project") || "default";
  });
  // WHY: Wrap setActiveProjectId so every project switch ALSO writes the
  // new active id to localStorage AND dispatches a custom event the
  // dashboard listens to. Without the event, the dashboard never knows
  // to swap its scoped canvas/video-project state — which was the
  // "stale refs leak into new project" bug.
  const setActiveProjectId = useCallback((id: string) => {
    setActiveProjectIdState(id);
    if (typeof window !== "undefined") {
      localStorage.setItem("pm-active-project", id);
      window.dispatchEvent(new Event("pm-active-project-changed"));
    }
  }, []);
  const [showProjectPicker, setShowProjectPicker] = useState(false);

  // Memories are scoped per project
  const memoriesKey = `pm-ai-memories-${activeProjectId}`;
  const [memories, setMemories] = useState<AIMemory[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem(`pm-ai-memories-${typeof window !== "undefined" ? (localStorage.getItem("pm-active-project") || "default") : "default"}`) || "[]");
    } catch { return []; }
  });
  const [showMemories, setShowMemories] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // WHY: Fetch user assets for the @ mention popup in ChatInput.
  // Users type @Name to tag characters, props, environments inline in chat.
  // Custom names from the Assets page (stored in localStorage) take priority
  // over the auto-generated prompt-based name.
  type MentionAsset = { id: string; name: string; url: string; type: "character" | "prop" | "environment" | "product" | "image" | "video"; thumbnail?: string };
  const [mentionAssets, setMentionAssets] = useState<MentionAsset[]>([]);

  const loadMentionAssets = useCallback(() => {
    fetch("/api/user/assets?limit=30")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        const raw = data?.assets ?? data ?? [];
        if (!Array.isArray(raw)) return;
        // Read custom names from localStorage (set on the Assets page)
        let customNames: Record<string, string> = {};
        try {
          customNames = JSON.parse(localStorage.getItem("pm-asset-names") || "{}");
        } catch { /* ignore */ }
        setMentionAssets(
          raw.map((a: { id: string; url: string; type: string; name?: string; prompt?: string; category?: string }) => {
            const proxyUrl = a.url?.startsWith("https://princemarketing.ai/")
              ? `/api/proxy/image?url=${encodeURIComponent(a.url)}`
              : a.url;
            return {
              id: a.id,
              // Custom name first (e.g. "Jerry"), then API-provided name, then prompt fallback
              name: customNames[a.id] || a.name || a.prompt?.slice(0, 30) || "Asset",
              url: a.url,
              type: (a.category as MentionAsset["type"]) || (a.type === "video" ? "video" : "image"),
              thumbnail: proxyUrl,
            };
          }),
        );
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadMentionAssets();
    // WHY: Re-read custom names when window regains focus — this handles the
    // case where the user renames an asset on the Assets page in another tab
    // and then comes back to chat.
    function handleFocus() { loadMentionAssets(); }
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [loadMentionAssets]);

  // Persist projects to localStorage
  useEffect(() => {
    localStorage.setItem("pm-projects", JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    localStorage.setItem("pm-active-project", activeProjectId);
  }, [activeProjectId]);

  // Reload memories when active project changes
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(memoriesKey) || "[]");
      setMemories(saved);
    } catch { setMemories([]); }
  }, [memoriesKey]);

  // Persist memories to localStorage (scoped by project)
  useEffect(() => {
    localStorage.setItem(memoriesKey, JSON.stringify(memories));
  }, [memories, memoriesKey]);

  // Persist chat messages to the ACTIVE project's per-project key.
  // Keep last 50 to prevent bloat. Skip the initial-greeting-only state
  // so we don't waste localStorage on empty conversations.
  const chatStorageKey = `${CHAT_STORAGE_KEY_PREFIX}${activeProjectId}`;
  useEffect(() => {
    if (messages.length > 1) {
      localStorage.setItem(chatStorageKey, JSON.stringify(messages.slice(-50)));
    }
  }, [messages, chatStorageKey]);

  // WHY: When the user switches projects, load that project's chat history
  // (or the initial greeting if it's brand new). Without this the chat from
  // the previous project bleeds into the new one — which was the bug.
  // We track the previous project ID to detect actual switches and skip the
  // mount-time pass (the useState initializer already handled that).
  const prevProjectIdRef = useRef(activeProjectId);
  useEffect(() => {
    if (prevProjectIdRef.current === activeProjectId) return;
    prevProjectIdRef.current = activeProjectId;
    const saved = localStorage.getItem(`${CHAT_STORAGE_KEY_PREFIX}${activeProjectId}`);
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
        return;
      } catch { /* fall through to initial */ }
    }
    setMessages([INITIAL_MESSAGE]);
  }, [activeProjectId]);

  const handleClearChat = useCallback(() => {
    localStorage.removeItem(chatStorageKey);
    setMessages([INITIAL_MESSAGE]);
  }, [chatStorageKey]);

  // WHY: Project deletion. Removes the project from the projects list,
  // its per-project chat history, and its per-project memories. Refuses
  // to delete the very last remaining project (you must always have one
  // home). If the deleted project was active, switches to the first
  // remaining project — falling back to a fresh "Default Project" if
  // we somehow ended up empty.
  const handleDeleteProject = useCallback((projectId: string) => {
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;
    if (projects.length <= 1) {
      alert("You must have at least one project. Create another before deleting this one.");
      return;
    }
    const ok = confirm(
      `Delete project "${project.name}"?\n\nThis will permanently remove its chat history and memories. Generated assets will not be deleted.`,
    );
    if (!ok) return;

    // Clean up per-project storage
    localStorage.removeItem(`${CHAT_STORAGE_KEY_PREFIX}${projectId}`);
    localStorage.removeItem(`pm-ai-memories-${projectId}`);

    setProjects((prev) => {
      const next = prev.filter((p) => p.id !== projectId);
      localStorage.setItem("pm-projects", JSON.stringify(next));
      return next;
    });

    // If we just deleted the active project, switch to the first remaining
    if (activeProjectId === projectId) {
      const remaining = projects.filter((p) => p.id !== projectId);
      const fallback = remaining[0]?.id ?? "default";
      setActiveProjectId(fallback);
    }
  }, [projects, activeProjectId]);

  const userName = session?.user?.name ?? "You";

  // Shift+Tab toggles between Plan and Auto mode
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.shiftKey && e.key === "Tab") {
        e.preventDefault();
        // Cycle: plan → step → auto → plan
        setCreationMode((prev) =>
          prev === "plan" ? "step" : prev === "step" ? "auto" : "plan"
        );
      }
      // Escape closes dropdowns
      if (e.key === "Escape") {
        if (showMemories) setShowMemories(false);
        if (showProjectPicker) setShowProjectPicker(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showMemories, showProjectPicker]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

  // WHY: Process agentic actions returned by the AI and update the message with live status.
  // SAVE_MEMORY actions are handled inline here (they need setMemories), others delegate to executeAction.
  const processActions = useCallback(
    async (
      agentActions: AgentAction[],
      messageId: string,
    ): Promise<string[]> => {
      const allNodeRefs: string[] = [];

      // WHY: Pre-extract ADD_REFERENCE_IMAGE actions so CREATE_VIDEO can pass
      // the references DIRECTLY to the Seedance API on its first call. Without
      // this, references would only land in local state AFTER generation
      // already started — meaning the @LaDonte tag would be silently dropped
      // and we'd get generic videos with no character consistency.
      const pendingReferences: Array<{ url: string; label: string }> = agentActions
        .filter((a) => a.action === "ADD_REFERENCE_IMAGE" && a.url && a.label)
        .map((a) => ({ url: String(a.url), label: String(a.label) }));

      // WHY: Belt-and-suspenders — also merge references already attached to
      // the most recent video project (products/envs picked via the inline
      // picker). Even if the AI forgets to re-emit TAG_REFERENCE_TO_SCENE for
      // them, Seedance still gets the refs on its first call. Dedupe by URL.
      try {
        const saved = typeof window !== "undefined" ? localStorage.getItem("pm-video-projects") : null;
        if (saved) {
          const all = JSON.parse(saved) as Array<{
            createdAt?: string;
            updatedAt?: string;
            referenceImages?: Array<{ url: string; label: string }>;
          }>;
          if (Array.isArray(all) && all.length > 0) {
            const latest = [...all].sort((a, b) => {
              const ta = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
              const tb = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime();
              return tb - ta;
            })[0];
            const seen = new Set(pendingReferences.map((r) => r.url));
            for (const ref of latest?.referenceImages ?? []) {
              if (ref?.url && ref?.label && !seen.has(ref.url)) {
                pendingReferences.push({ url: ref.url, label: ref.label });
                seen.add(ref.url);
              }
            }
          }
        }
      } catch {
        /* ignore corrupt state */
      }

      // WHY: When the AI outputs CREATE_VIDEO + ADD_REFERENCE_IMAGE + TAG_REFERENCE_TO_SCENE
      // in the same response, it uses placeholders ("auto"/"current"/"latest") for the
      // videoProjectId because it doesn't know the UUID yet. Pre-process the actions
      // to substitute these placeholders with actual UUIDs:
      // 1. For CREATE_VIDEO: pre-generate a UUID so the same one can be used by tags
      // 2. For dependent actions: replace placeholders with the most recent CREATE_VIDEO's ID
      const preprocessed = [...agentActions];
      let mostRecentVideoId: string | null = null;
      const PLACEHOLDER_IDS = new Set(["auto", "current", "latest"]);

      for (let i = 0; i < preprocessed.length; i++) {
        const a = preprocessed[i];
        if (a.action === "CREATE_VIDEO") {
          // Pre-assign a UUID so reference actions can target it
          if (!a.videoProjectId || PLACEHOLDER_IDS.has(String(a.videoProjectId))) {
            a.videoProjectId = crypto.randomUUID();
          }
          mostRecentVideoId = String(a.videoProjectId);
        } else if (
          a.videoProjectId &&
          PLACEHOLDER_IDS.has(String(a.videoProjectId)) &&
          mostRecentVideoId
        ) {
          a.videoProjectId = mostRecentVideoId;
        }
      }

      // WHY: Build a batch context the executor can use to pre-validate
      // dependent actions like TAG_REFERENCE_TO_SCENE. The map records every
      // CREATE_VIDEO in this batch and how many scenes it declared, plus
      // every reference label that's in scope (this batch's
      // ADD_REFERENCE_IMAGE actions PLUS already-attached refs from the
      // active video project). Without this the AI could emit TAG actions
      // pointing at scenes that don't exist and we'd silently no-op them.
      const batchContext = {
        createVideoSceneCounts: new Map<string, number>(),
        referenceLabels: new Set<string>(),
      };
      for (const a of preprocessed) {
        if (a.action === "CREATE_VIDEO" && a.videoProjectId) {
          batchContext.createVideoSceneCounts.set(
            String(a.videoProjectId),
            Array.isArray(a.scenes) ? a.scenes.length : 0,
          );
        }
        if (a.action === "ADD_REFERENCE_IMAGE" && a.label) {
          batchContext.referenceLabels.add(String(a.label));
        }
      }
      // Also accept already-attached project references as valid tag targets
      for (const r of pendingReferences) {
        batchContext.referenceLabels.add(r.label);
      }

      // Initialize action statuses
      const statuses: ActionStatus[] = preprocessed.map((a) => ({
        action: a.action,
        label: ACTION_LABELS[a.action]?.label ?? a.action,
        status: "pending" as const,
      }));

      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, actionStatuses: [...statuses] } : m,
        ),
      );

      // Execute actions sequentially so each can reference prior canvas state
      for (let i = 0; i < preprocessed.length; i++) {
        // Mark current as running
        statuses[i].status = "running";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId ? { ...m, actionStatuses: [...statuses] } : m,
          ),
        );

        let result: {
          success: boolean;
          detail: string;
          nodeRef?: string;
          videoProjectId?: string;
          productSearch?: {
            query: string;
            label: string;
            category?: "character" | "prop" | "environment";
            videoProjectId?: string;
            products: Array<{ imageUrl: string; title: string; sourceUrl: string; sourceDomain: string; price?: string }>;
          };
          scorePicker?: {
            videoProjectId: string;
            tracks: Array<{
              id: string;
              prompt: string;
              genre?: string;
              bpm?: number;
              duration: number;
              audioUrl?: string;
              status: "generating" | "ready" | "failed";
            }>;
          };
          brainCitations?: {
            query: string;
            matches: Array<{
              id: string;
              score: number;
              content: string;
              source: string;
              section: string;
            }>;
          };
          voiceoverOffer?: {
            videoProjectId: string;
            script: Array<{ startTime: number; endTime: number; text: string }>;
            recommendedVoiceId?: string;
          };
        };

        // Handle SAVE_MEMORY and DELETE_MEMORY inline since they need access to setMemories
        if (preprocessed[i].action === "SAVE_MEMORY") {
          const newMemory: AIMemory = {
            id: crypto.randomUUID(),
            type: (preprocessed[i].type as AIMemory["type"]) ?? "brand",
            title: preprocessed[i].title ?? "Memory",
            content: preprocessed[i].content ?? "",
            createdAt: new Date().toISOString(),
          };
          setMemories((prev) => {
            // Deduplicate by title — update existing memory if title matches
            const filtered = prev.filter((m) => m.title.toLowerCase() !== newMemory.title.toLowerCase());
            return [...filtered, newMemory];
          });
          result = { success: true, detail: `Remembered: ${newMemory.title}` };
        } else if (preprocessed[i].action === "DELETE_MEMORY") {
          const title = preprocessed[i].title ?? "";
          setMemories((prev) => prev.filter((m) => m.title.toLowerCase() !== title.toLowerCase()));
          result = { success: true, detail: `Forgot: ${title}` };
        } else {
          // Progress callback for SSE-streamed actions (video generation)
          const statusCallback = (update: StatusUpdate) => {
            statuses[i].progress = update.progress;
            statuses[i].stage = update.stage;
            if (update.detail) statuses[i].detail = update.detail;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === messageId ? { ...m, actionStatuses: [...statuses] } : m,
              ),
            );
          };

          // WHY: Pass the LIVE creationMode (via ref), the waitForApproval
          // gating function (Step Mode), AND the pre-extracted references
          // so CREATE_VIDEO can pass them to the Seedance API directly.
          const isStepMode = creationModeRef.current === "step";
          result = await executeAction(
            preprocessed[i],
            onCanvasAction,
            nodes,
            statusCallback,
            isStepMode,
            isStepMode ? waitForApproval : undefined,
            pendingReferences,
            batchContext,
          );
        }

        statuses[i].status = result.success ? "done" : "error";
        statuses[i].detail = result.detail;
        statuses[i].progress = undefined; // Clear progress bar on completion
        if (result.nodeRef) allNodeRefs.push(result.nodeRef);

        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  actionStatuses: [...statuses],
                  nodeRefs: [...allNodeRefs],
                  // WHY: Attach videoProjectId so InlineVideoSet can render scenes inline
                  ...(result.videoProjectId ? { videoProjectId: result.videoProjectId } : {}),
                  // WHY: Attach productSearch results so InlineProductPicker can render
                  // WHY: Append, don't overwrite — multiple FIND_PRODUCT
                  // actions in one response each need their own inline picker.
                  ...(result.productSearch
                    ? { productSearches: [...(m.productSearches ?? []), result.productSearch] }
                    : {}),
                  ...(result.scorePicker ? { scorePicker: result.scorePicker } : {}),
                  ...(result.brainCitations ? { brainCitations: result.brainCitations } : {}),
                  ...(result.voiceoverOffer ? { voiceoverOffer: result.voiceoverOffer } : {}),
                }
              : m,
          ),
        );
      }

      return allNodeRefs;
    },
    [onCanvasAction, nodes, waitForApproval],
  );

  async function handleSend(content: string, attachments?: Array<{ id: string; url: string; name: string; type: string }>) {
    // WHY: Inline attachments — when the user uploads images via the
    // paperclip in chat, append a structured note to the message so the
    // AI knows exactly which assets are now available to use as references.
    let finalContent = content;
    if (attachments && attachments.length > 0) {
      const list = attachments
        .map((a) => `- ${a.name} (${a.type}, url: ${a.url})`)
        .join("\n");
      finalContent = `${content}\n\n[Just uploaded ${attachments.length} reference file${attachments.length === 1 ? "" : "s"}:\n${list}\n\nUse these as references in any video/image generation. They are saved to the user's library and can be tagged via @ as well.]`;
      // Refresh the @ mention popup so the new uploads appear immediately
      loadMentionAssets();
    }

    // WHY: Plan Mode → Step Mode auto-handoff. If the user says any of
    // the execute-intent phrases while in Plan Mode, automatically flip
    // to Step Mode and proceed instead of refusing. The old behavior
    // forced users to manually Shift+Tab between modes — friction with
    // no upside. We keep a visible note so the mode switch isn't silent.
    const EXECUTE_INTENT = /^\s*(execute|go|do it|begin|start|run it|run that|ship it|make it|build it|produce it|kick it off|send it)[\s!.]*$/i;
    let effectiveCreationMode = creationMode;
    let autoHandoffNote: string | null = null;
    if (creationMode === "plan" && EXECUTE_INTENT.test(content)) {
      setCreationMode("step");
      effectiveCreationMode = "step";
      autoHandoffNote =
        "Switched to **Step Mode** — generating the plan you just wrote.";
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: finalContent,
    };
    setMessages((prev) => [...prev, userMessage]);
    if (autoHandoffNote) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: autoHandoffNote!,
        },
      ]);
    }
    setIsThinking(true);
    setError(null);

    // Build conversation history from existing messages (exclude initial greeting)
    const history = messages
      .filter((m) => m.id !== "initial")
      .map((m) => ({ role: m.role, content: m.content }));

    // WHY: Parse @-mentions out of the user's message and resolve each
    // tag to a real asset URL from the loaded mention library. The AI
    // previously saw "@LaDonte" as plain text and hallucinated a
    // placeholder URL when it emitted ADD_REFERENCE_IMAGE — leading to
    // broken thumbnails ("?") in the reference library. Now we extract
    // matched tags and pass them to the backend so the system prompt
    // can inject a "MENTIONED ASSETS" block with real URLs.
    const mentionRegex = /@([A-Za-z0-9_]+)/g;
    const mentionedTags = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = mentionRegex.exec(content)) !== null) {
      mentionedTags.add(match[1]);
    }
    const mentionedAssets = Array.from(mentionedTags)
      .map((tag) => {
        // Match by exact name (case-insensitive). The user types @LaDonte,
        // we look for an asset whose name is "LaDonte" or "ladonte".
        const asset = mentionAssets.find(
          (a) => a.name?.toLowerCase() === tag.toLowerCase(),
        );
        if (!asset) return null;
        return {
          tag,
          label: asset.name,
          url: asset.url,
          type: asset.type,
        };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);

    // WHY: Read the most recent video project's references so the AI knows
    // what's already attached (products/envs the user picked via the inline
    // picker). Without this the AI forgets to tag them and Seedance gets
    // generic videos with no character/prop consistency.
    let currentProjectReferences:
      | Array<{ id: string; url: string; label: string; category?: "character" | "prop" | "scene" }>
      | undefined;
    let activeVideoProjectId: string | undefined;
    try {
      const saved = typeof window !== "undefined" ? localStorage.getItem("pm-video-projects") : null;
      if (saved) {
        const all = JSON.parse(saved) as Array<{
          id: string;
          createdAt?: string;
          updatedAt?: string;
          referenceImages?: Array<{ id: string; url: string; label: string; category?: "character" | "prop" | "scene" }>;
        }>;
        if (Array.isArray(all) && all.length > 0) {
          const latest = [...all].sort((a, b) => {
            const ta = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
            const tb = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime();
            return tb - ta;
          })[0];
          if (latest?.referenceImages?.length) {
            activeVideoProjectId = latest.id;
            currentProjectReferences = latest.referenceImages
              .slice(0, 20)
              .map((r) => ({ id: r.id, url: r.url, label: r.label, category: r.category }));
          }
        }
      }
    } catch {
      /* ignore corrupt state */
    }

    try {
      const res = await fetch("/api/ai/create-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          message: content,
          history,
          existingNodes: nodes.map((n) => ({ id: n.id, type: n.type, title: n.title })),
          fetchAssets: true,
          creationMode: effectiveCreationMode,
          memories: memories.length > 0
            ? memories.map((m) => `[${m.type}] ${m.title}: ${m.content}`).join("\n")
            : undefined,
          projectName: projects.find((p) => p.id === activeProjectId)?.name ?? "Default Project",
          currentProjectReferences,
          activeVideoProjectId,
          mentionedAssets: mentionedAssets.length > 0 ? mentionedAssets : undefined,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to get AI response");
      }

      const data = await res.json();
      const assistantId = crypto.randomUUID();
      const assistantMessage: Message = {
        id: assistantId,
        role: "assistant",
        content: data.message,
        nodeRefs: [],
        actionStatuses: [],
      };

      // Process legacy canvas node responses
      if (data.nodes && Array.isArray(data.nodes) && data.nodes.length > 0) {
        const refs: string[] = [];
        let yPos = 60;
        for (const n of nodes) {
          if (n.position.y + 200 > yPos) yPos = n.position.y + 200;
        }

        for (let i = 0; i < data.nodes.length; i++) {
          const nodeData = data.nodes[i];
          const id = crypto.randomUUID();
          const node: ContentNode = {
            id,
            type: nodeData.type ?? "copy",
            title: nodeData.title ?? "Untitled",
            thumbnail: nodeData.thumbnail,
            status: "draft",
            prompt: nodeData.prompt ?? content,
            createdAt: new Date().toISOString(),
            connections: refs.length > 0 ? [refs[refs.length - 1]] : [],
            position: { x: 60 + i * 260, y: yPos },
          };
          onCanvasAction({ type: "add-node", node });
          refs.push(id);

          if (nodeData.type === "video" && nodeData.videoProjectId) {
            node.videoProjectId = nodeData.videoProjectId;
            onCanvasAction({ type: "open-video-editor", videoProjectId: nodeData.videoProjectId });
          }
        }
        assistantMessage.nodeRefs = refs;
      }

      // Parse inline [NODE:...] markers
      const { actions: nodeActions, nodeRefs } = parseContentActions(data.message, content);
      for (const action of nodeActions) {
        onCanvasAction(action);
      }
      if (nodeRefs.length > 0) {
        assistantMessage.nodeRefs = [...(assistantMessage.nodeRefs ?? []), ...nodeRefs];
      }

      setMessages((prev) => [...prev, assistantMessage]);
      setIsThinking(false);

      // Process agentic actions (the new system)
      if (data.actions && Array.isArray(data.actions) && data.actions.length > 0) {
        const actionRefs = await processActions(data.actions, assistantId);
        if (actionRefs.length > 0) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, nodeRefs: [...(m.nodeRefs ?? []), ...actionRefs] }
                : m,
            ),
          );
        }
      }
    } catch {
      // Fallback to streaming chat
      try {
        setIsThinking(true);
        const { streamChat } = await import("@/lib/api");
        const assistantId = crypto.randomUUID();
        let fullResponse = "";

        await streamChat(
          sessionId,
          content,
          (chunk) => {
            fullResponse += chunk;
            setMessages((prev) => {
              const existing = prev.find((m) => m.id === assistantId);
              if (existing) {
                return prev.map((m) =>
                  m.id === assistantId ? { ...m, content: fullResponse } : m,
                );
              }
              return [
                ...prev,
                { id: assistantId, role: "assistant" as const, content: fullResponse },
              ];
            });
          },
          () => {},
          history,
        );
      } catch (streamErr) {
        const message = streamErr instanceof Error ? streamErr.message : "Failed to connect to AI";
        setError(message);
      }
    } finally {
      setIsThinking(false);
    }
  }

  if (collapsed) {
    return (
      <div className="flex h-full w-12 flex-col items-center border-l border-smoke bg-graphite pt-4">
        <button
          onClick={onToggle}
          className="
            flex h-9 w-9 items-center justify-center rounded-lg
            text-ash hover:text-cloud hover:bg-slate
            transition-colors duration-200 cursor-pointer
          "
          aria-label="Open chat panel"
        >
          <PanelRightOpen size={18} strokeWidth={1.5} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col border-l border-smoke bg-graphite">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-smoke px-4">
        <div className="flex items-center gap-2">
          <img src="/logos/pm-icon.svg" alt="AI" className="h-5 w-5" />
          <span className="text-sm font-semibold text-cloud">AI Strategist</span>
          {/* Project selector */}
          <div className="relative">
            <button
              onClick={() => { setShowProjectPicker(!showProjectPicker); setShowMemories(false); }}
              className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] text-ash hover:text-cloud border border-smoke/30 hover:border-smoke transition-colors cursor-pointer"
            >
              <FolderOpen size={10} />
              <span className="max-w-[80px] truncate">{projects.find((p) => p.id === activeProjectId)?.name ?? "Project"}</span>
              <ChevronDown size={8} />
            </button>

            {showProjectPicker && (
              <div className="absolute left-0 top-full z-30 mt-1 w-56 rounded-xl border border-smoke bg-graphite p-2 shadow-xl">
                <div className="text-[9px] uppercase tracking-wider text-ash/50 font-medium px-2 mb-1">Projects</div>
                {projects.map((p) => (
                  <div
                    key={p.id}
                    className={`group flex w-full items-center gap-2 rounded-lg pl-2 pr-1 py-1.5 text-[11px] transition-colors ${
                      p.id === activeProjectId ? "bg-royal/10 text-royal" : "text-ash hover:text-cloud hover:bg-slate"
                    }`}
                  >
                    <button
                      onClick={() => { setActiveProjectId(p.id); setShowProjectPicker(false); }}
                      className="flex flex-1 items-center gap-2 cursor-pointer truncate text-left"
                    >
                      <FolderOpen size={12} />
                      <span className="truncate">{p.name}</span>
                    </button>
                    {/* WHY: Delete button — only revealed on hover so it
                        doesn't clutter the picker. Refuses to delete the
                        last remaining project. */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteProject(p.id);
                      }}
                      title="Delete project"
                      className="flex h-5 w-5 items-center justify-center rounded text-ash/40 opacity-0 transition-opacity hover:bg-rose-500/20 hover:text-rose-300 group-hover:opacity-100"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
                <div className="border-t border-smoke/30 mt-1 pt-1">
                  <button
                    onClick={() => {
                      const name = prompt("New project name:");
                      if (name?.trim()) {
                        const newProject: Project = { id: crypto.randomUUID(), name: name.trim(), createdAt: new Date().toISOString() };
                        setProjects((prev) => [...prev, newProject]);
                        setActiveProjectId(newProject.id);
                        setShowProjectPicker(false);
                      }
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] text-royal hover:bg-royal/10 transition-colors cursor-pointer"
                  >
                    <Plus size={12} />
                    New Project
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="thinking-dots flex items-center gap-0.5">
            <span className="royal-dot royal-dot-animate h-1.5 w-1.5" />
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* Memory indicator */}
          <div className="relative">
            <button
              onClick={() => setShowMemories(!showMemories)}
              className={`
                flex items-center gap-1 rounded-lg px-2 py-1 text-[10px]
                transition-colors duration-200 cursor-pointer
                ${memories.length > 0
                  ? "text-royal hover:text-royal hover:bg-royal/10"
                  : "text-ash/40 hover:text-ash hover:bg-slate/50"
                }
              `}
              title={memories.length > 0 ? `${memories.length} memories saved` : "No memories yet"}
            >
              <Brain size={14} strokeWidth={1.5} />
              {memories.length > 0 && (
                <span className="font-medium tabular-nums">{memories.length}</span>
              )}
            </button>

            {/* Memories dropdown */}
            {showMemories && (
              <div className="absolute right-0 top-full z-30 mt-1 w-80 rounded-xl border border-smoke bg-graphite p-3 shadow-xl max-h-72 overflow-y-auto">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-cloud">Memories</h4>
                  {memories.length > 0 && (
                    <button
                      onClick={() => { setMemories([]); setShowMemories(false); }}
                      className="text-[9px] text-ash/50 hover:text-coral transition-colors cursor-pointer"
                    >
                      Clear all
                    </button>
                  )}
                </div>
                {memories.map((m) => (
                  <div key={m.id} className="flex items-start gap-2 mb-2 pb-2 border-b border-smoke/30 last:border-0">
                    <Badge
                      variant={
                        m.type === "brand" ? "royal"
                        : m.type === "feedback" ? "amber"
                        : m.type === "asset" ? "coral"
                        : "mint"
                      }
                      className="text-[8px] shrink-0 mt-0.5"
                    >
                      {m.type}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-medium text-cloud truncate">{m.title}</p>
                      <p className="text-[9px] text-ash line-clamp-2">{m.content}</p>
                    </div>
                    <button
                      onClick={() => setMemories((prev) => prev.filter((x) => x.id !== m.id))}
                      className="text-ash/40 hover:text-coral shrink-0 cursor-pointer"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                ))}
                {memories.length === 0 && (
                  <p className="text-[10px] text-ash/50 py-2">No memories yet. The AI will remember details about your brand, preferences, and past performance as you chat.</p>
                )}
              </div>
            )}
          </div>
          <button
            onClick={handleClearChat}
            className="
              flex h-8 w-8 items-center justify-center rounded-lg
              text-ash hover:text-coral hover:bg-coral/10
              transition-colors duration-200 cursor-pointer
            "
            aria-label="Clear chat history"
            title="Clear chat"
          >
            <Trash2 size={14} strokeWidth={1.5} />
          </button>
          <button
            onClick={onToggle}
            className="
              flex h-8 w-8 items-center justify-center rounded-lg
              text-ash hover:text-cloud hover:bg-slate
              transition-colors duration-200 cursor-pointer
            "
            aria-label="Close chat panel"
          >
            <PanelRightClose size={16} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Node references bar — hidden on mobile to save space */}
      {nodes.length > 0 && (
        <div className="hidden lg:flex items-center gap-2 border-b border-smoke/50 px-4 py-2.5 overflow-x-auto">
          <span className="shrink-0 text-[10px] uppercase tracking-widest text-ash/60 font-medium">Canvas</span>
          {nodes.slice(-5).map((node) => {
            const icons: Record<string, typeof ImageIcon> = { image: ImageIcon, video: Video, copy: FileText };
            const Icon = icons[node.type] ?? FileText;
            return (
              <button
                key={node.id}
                className="
                  flex shrink-0 items-center gap-1.5 rounded-md
                  border border-smoke/60 bg-slate/50
                  px-2.5 py-1 cursor-pointer
                  hover:border-royal/40 hover:bg-slate/80
                  transition-all duration-200
                "
              >
                <Icon size={10} className="text-royal" />
                <span className="text-[10px] text-ash hover:text-cloud truncate max-w-[80px] transition-colors">{node.title}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mx-3 mt-3 flex items-center gap-2 rounded-lg border border-coral/30 bg-coral/10 px-3 py-2 text-xs text-coral">
          <AlertCircle size={14} strokeWidth={1.5} />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-coral/60 hover:text-coral cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* WHY: Mode banner — explicit visual reminder of which mode the user is in.
          Plan Mode users were getting confused because the AI was claiming
          generation was happening when nothing was. */}
      {creationMode === "plan" && (
        <div className="mx-3 mt-3 flex items-center gap-2 rounded-lg border border-royal/30 bg-royal/5 px-3 py-2 text-[10px] text-royal">
          <ListChecks size={12} strokeWidth={1.8} />
          <span className="font-medium">Plan Mode</span>
          <span className="text-royal/70">— building the plan only, no generation. Switch to Step or Auto to start generating.</span>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5">
        <div className="flex flex-col gap-4">
          {messages.map((msg) => (
            <div key={msg.id}>
              <ChatMessage role={msg.role} content={msg.content} userName={userName} />

              {/* Action status indicators */}
              {msg.actionStatuses && msg.actionStatuses.length > 0 && (
                <div className="mt-2.5 ml-11 flex flex-col gap-2">
                  {msg.actionStatuses.map((as, i) => {
                    const actionMeta = ACTION_LABELS[as.action];
                    const Icon = actionMeta?.icon ?? FileText;
                    const hasProgress = as.status === "running" && as.progress != null && as.progress > 0;
                    return (
                      <div key={i} className="flex flex-col gap-1.5">
                        <div className={`
                          flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs
                          ${as.status === "running"
                            ? "bg-royal/10 border border-royal/20"
                            : as.status === "done"
                              ? "bg-emerald-500/10 border border-emerald-500/20"
                              : as.status === "error"
                                ? "bg-coral/10 border border-coral/20"
                                : "bg-slate/40 border border-transparent"
                          }
                        `}>
                          {as.status === "running" ? (
                            <Loader2 size={13} className="animate-spin text-royal" />
                          ) : as.status === "done" ? (
                            <Check size={13} className="text-emerald-400" />
                          ) : as.status === "error" ? (
                            <AlertCircle size={13} className="text-coral" />
                          ) : (
                            <Icon size={13} className="text-ash" />
                          )}
                          <Icon size={11} className={`
                            ${as.status === "running" ? "text-royal/60" : "text-ash/40"}
                          `} />
                          <span className={`flex-1 ${as.status === "done" ? "text-cloud" : as.status === "error" ? "text-coral" : "text-ash"}`}>
                            {as.status === "done" || as.status === "error"
                              ? as.detail ?? as.label
                              : as.stage
                                ? `${as.stage}...`
                                : `${as.label}...`}
                          </span>
                          {hasProgress && (
                            <span className="text-[10px] tabular-nums font-medium text-royal/80">{as.progress}%</span>
                          )}
                        </div>
                        {/* Progress bar for SSE-streamed actions */}
                        {hasProgress && (
                          <div className="mx-3 h-1.5 overflow-hidden rounded-full bg-slate/80">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-royal via-royal to-royal-hover transition-all duration-500 ease-out shadow-[0_0_8px_rgba(99,102,241,0.4)]"
                              style={{ width: `${as.progress}%` }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Node reference chips (non-video) */}
              {msg.nodeRefs && msg.nodeRefs.length > 0 && !msg.videoProjectId && (
                <div className="mt-2 ml-11 flex flex-wrap gap-1.5">
                  {msg.nodeRefs.map((ref) => {
                    const node = nodes.find((n) => n.id === ref);
                    if (!node) return null;
                    const icons: Record<string, typeof ImageIcon> = { image: ImageIcon, video: Video, copy: FileText };
                    const NodeIcon = icons[node.type] ?? FileText;
                    return (
                      <button
                        key={ref}
                        className="
                          flex items-center gap-1.5 rounded-md border border-royal/30 bg-royal/10
                          px-2.5 py-1 text-[10px] font-medium text-royal
                          hover:bg-royal/20 hover:border-royal/50 hover:shadow-sm
                          transition-all duration-200 cursor-pointer
                        "
                      >
                        <NodeIcon size={10} strokeWidth={2} />
                        <span className="truncate max-w-[100px]">{node.title}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* WHY: Inline product picker — renders the FIND_PRODUCT search
                  results as a tap-to-select grid. On select, auto-fires
                  ADD_REFERENCE_IMAGE so the chosen product becomes a usable
                  @-mention in subsequent video generations. */}
              {msg.productSearches?.map((productSearch, psIdx) => (
                <InlineProductPicker
                  key={`${productSearch.label}-${psIdx}`}
                  query={productSearch.query}
                  label={productSearch.label}
                  products={productSearch.products}
                  onSelect={async (product, label) => {
                    // Resolve the active video project — use the one attached
                    // to the search if known, otherwise fall back to the most
                    // recent video project in canvas state.
                    let targetProjectId = productSearch.videoProjectId;
                    if (!targetProjectId) {
                      const recentVideoNode = [...nodes]
                        .reverse()
                        .find((n) => n.type === "video" && n.videoProjectId);
                      targetProjectId = recentVideoNode?.videoProjectId;
                    }
                    if (!targetProjectId) {
                      return;
                    }
                    const category = (productSearch.category === "environment"
                      ? "scene"
                      : productSearch.category) as "character" | "prop" | "scene" | undefined;

                    // WHY: Persist the picked product to the user's asset
                    // library so they can @-mention it in future projects.
                    // We fetch the remote image server-side and re-upload it
                    // through the stable .ai pipeline, then use the new URL
                    // for the canvas reference. If persistence fails we fall
                    // back to the original URL so the user flow isn't blocked.
                    let finalUrl = product.imageUrl;
                    try {
                      const persistRes = await fetch("/api/upload/image-from-url", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          url: product.imageUrl,
                          label,
                          category,
                        }),
                      });
                      if (persistRes.ok) {
                        const persistData = await persistRes.json();
                        const stableUrl =
                          persistData?.url ??
                          persistData?.data?.url ??
                          persistData?.resultUrl;
                        if (stableUrl) finalUrl = stableUrl;
                        // Auto-tag the asset with a friendly name so the
                        // library UI shows @Label instead of a hash filename.
                        try {
                          const assetNames = JSON.parse(
                            localStorage.getItem("pm-asset-names") ?? "{}",
                          );
                          assetNames[finalUrl] = label;
                          localStorage.setItem(
                            "pm-asset-names",
                            JSON.stringify(assetNames),
                          );
                        } catch {
                          /* ignore */
                        }
                      }
                    } catch (err) {
                      console.warn("[ProductPicker] library persist failed:", err);
                    }

                    onCanvasAction({
                      type: "add-reference-image",
                      videoProjectId: targetProjectId,
                      url: finalUrl,
                      label,
                      category,
                    });
                  }}
                  onDeselect={async (product, label) => {
                    // Look up the reference in the active project by URL or
                    // label match, then dispatch remove-reference-image.
                    try {
                      const saved = localStorage.getItem("pm-video-projects");
                      if (!saved) return;
                      const all = JSON.parse(saved) as Array<{
                        id: string;
                        updatedAt?: string;
                        createdAt?: string;
                        referenceImages?: Array<{ id: string; url: string; label: string }>;
                      }>;
                      const targetProjectId =
                        productSearch.videoProjectId ??
                        [...all].sort((a, b) => {
                          const ta = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
                          const tb = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime();
                          return tb - ta;
                        })[0]?.id;
                      if (!targetProjectId) return;
                      const project = all.find((p) => p.id === targetProjectId);
                      const ref = project?.referenceImages?.find(
                        (r) => r.label === label || r.url === product.imageUrl,
                      );
                      if (!ref) return;
                      onCanvasAction({
                        type: "remove-reference-image",
                        videoProjectId: targetProjectId,
                        referenceId: ref.id,
                      });
                    } catch (err) {
                      console.warn("[ProductPicker] onDeselect failed:", err);
                    }
                  }}
                />
              ))}

              {/* WHY: Score-first picker. Renders Lyria track options and
                  fires select-score-track on pick, locking the timeline. */}
              {msg.scorePicker && (
                <InlineTrackPicker
                  videoProjectId={msg.scorePicker.videoProjectId}
                  tracks={msg.scorePicker.tracks}
                  onSelect={async (track) => {
                    // WHY: Before locking the track, fire the Gemini audio
                    // analyzer to extract real musical section boundaries.
                    // These markers become the timeline skeleton that the
                    // Director snaps scene cuts to. If analysis fails we
                    // still lock the track — the Director just falls back
                    // to sceneIndex heuristics for that project.
                    let markers: Array<{ time: number; label: string }> | undefined;
                    try {
                      const res = await fetch("/api/ai/analyze-score-markers", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          audioUrl: track.audioUrl,
                          genre: track.genre,
                          bpm: track.bpm,
                          expectedDuration: track.duration,
                        }),
                      });
                      if (res.ok) {
                        const data = await res.json();
                        const parsedMarkers =
                          data?.data?.markers ?? data?.markers;
                        if (Array.isArray(parsedMarkers) && parsedMarkers.length > 0) {
                          markers = parsedMarkers;
                        }
                      } else {
                        console.warn(
                          "[ScoreMarkers] Analysis failed:",
                          res.status,
                        );
                      }
                    } catch (err) {
                      console.warn("[ScoreMarkers] Analysis error:", err);
                    }

                    onCanvasAction({
                      type: "select-score-track",
                      videoProjectId: msg.scorePicker!.videoProjectId,
                      trackId: track.id,
                      markers,
                    });
                  }}
                />
              )}

              {/* WHY: Production Brain citations — shows which research
                  Claude consulted when answering. Trust-building transparency. */}
              {msg.brainCitations && msg.brainCitations.matches.length > 0 && (
                <div className="ml-11 mt-2 rounded-xl border border-royal/30 bg-royal/5 p-3">
                  <div className="mb-2 flex items-center gap-2 text-[11px] text-royal">
                    <span className="font-medium">Production Brain</span>
                    <span className="text-ash/60">
                      — {msg.brainCitations.matches.length} citation{msg.brainCitations.matches.length === 1 ? "" : "s"} for &ldquo;{msg.brainCitations.query}&rdquo;
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {msg.brainCitations.matches.map((match, idx) => (
                      <details
                        key={match.id || idx}
                        className="rounded-md border border-smoke bg-graphite/60 p-2 text-[11px] text-ash"
                      >
                        <summary className="cursor-pointer list-none">
                          <span className="font-medium text-cloud">
                            [{idx + 1}] {match.source}
                          </span>
                          {match.section && (
                            <span className="text-ash/60"> — {match.section}</span>
                          )}
                          <span className="ml-2 text-[10px] text-emerald-400">
                            {(match.score * 100).toFixed(0)}% relevance
                          </span>
                        </summary>
                        <div className="mt-2 whitespace-pre-wrap leading-relaxed text-ash/90">
                          {match.content}
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              )}

              {/* WHY: Voiceover fork — two-path picker (record yourself or
                  AI voice). Appears after OFFER_VOICEOVER. Karaoke branch
                  dispatches open-karaoke; AI branch fires GENERATE_VOICEOVER
                  and the result lands on the project via set-voiceover. */}
              {msg.voiceoverOffer && (
                <InlineVoiceoverPicker
                  videoProjectId={msg.voiceoverOffer.videoProjectId}
                  script={msg.voiceoverOffer.script}
                  recommendedVoiceId={msg.voiceoverOffer.recommendedVoiceId}
                  onRecordKaraoke={() => {
                    onCanvasAction({
                      type: "open-karaoke",
                      videoProjectId: msg.voiceoverOffer!.videoProjectId,
                      script: msg.voiceoverOffer!.script,
                    });
                  }}
                  onGenerateAiVoice={async (voiceId) => {
                    const res = await fetch("/api/generate/voiceover", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        videoProjectId: msg.voiceoverOffer!.videoProjectId,
                        voiceId,
                        script: msg.voiceoverOffer!.script,
                      }),
                    });
                    if (!res.ok) {
                      const data = await res.json().catch(() => ({}));
                      throw new Error(data?.error ?? "Voiceover failed");
                    }
                    const data = await res.json();
                    const audioUrl =
                      data?.data?.audioUrl ?? data?.audioUrl ?? data?.url;
                    if (!audioUrl) throw new Error("No audio URL returned");
                    onCanvasAction({
                      type: "set-voiceover",
                      videoProjectId: msg.voiceoverOffer!.videoProjectId,
                      url: audioUrl,
                      source: "ai",
                      voiceId,
                    });
                  }}
                />
              )}

              {/* WHY: Inline video cards — renders scene clips directly in the chat
                  stream so users can preview, trim, regenerate, and approve without
                  switching to the Video Editor. This is the chat-first production
                  interface that most users will use. */}
              {msg.videoProjectId && (() => {
                const videoNode = nodes.find((n) => n.videoProjectId === msg.videoProjectId);
                if (!videoNode) return null;
                // Get scenes from localStorage video projects
                const savedProjects = typeof window !== "undefined"
                  ? localStorage.getItem("pm-video-projects")
                  : null;
                let projectScenes: Array<{
                  id: string; prompt: string; videoUrl?: string; thumbnailUrl?: string;
                  status: "draft" | "generating" | "ready" | "regenerating";
                  duration: number; trimStart: number; trimEnd: number; score?: number;
                }> = [];
                if (savedProjects) {
                  try {
                    const entries: [string, { scenes: typeof projectScenes }][] = JSON.parse(savedProjects);
                    const proj = entries.find(([id]) => id === msg.videoProjectId);
                    if (proj) projectScenes = proj[1].scenes;
                  } catch { /* ignore */ }
                }
                if (projectScenes.length === 0) return null;

                const sceneCount = projectScenes.length;
                const attentionRoles = projectScenes.map((_, i) =>
                  i === 0 ? "stimulation"
                    : i === sceneCount - 1 ? "validation"
                    : i < sceneCount / 2 ? "captivation"
                    : "anticipation"
                );

                return (
                  <InlineVideoSet
                    scenes={projectScenes.map((s, i) => ({
                      ...s,
                      sceneIndex: i,
                      attentionRole: attentionRoles[i],
                    }))}
                    totalScenes={sceneCount}
                    projectTitle={videoNode.title}
                    stepMode={creationMode === "step"}
                    onRegenerateWithFeedback={async (sceneId, feedback) => {
                      // WHY: Step Mode reject + feedback flow. Take the scene's
                      // current prompt + the user's feedback, ask Claude to revise
                      // the prompt, then regenerate with the revised prompt.
                      const scene = projectScenes.find((s) => s.id === sceneId);
                      if (!scene || !msg.videoProjectId) return;
                      try {
                        const reviseRes = await fetch("/api/ai/revise-scene-prompt", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            originalPrompt: scene.prompt,
                            feedback,
                            sceneIndex: projectScenes.findIndex((s) => s.id === sceneId),
                            totalScenes: sceneCount,
                          }),
                        });
                        if (!reviseRes.ok) return;
                        const reviseData = await reviseRes.json();
                        const revisedPrompt = reviseData?.revisedPrompt ?? reviseData?.data?.revisedPrompt;
                        if (!revisedPrompt) return;

                        // Update the scene's prompt in localStorage so future regenerates use the revised version
                        try {
                          const saved = localStorage.getItem("pm-video-projects");
                          if (saved) {
                            const entries: [string, { scenes: typeof projectScenes }][] = JSON.parse(saved);
                            const updated = entries.map(([id, proj]) =>
                              id === msg.videoProjectId
                                ? [id, { ...proj, scenes: proj.scenes.map((s) => s.id === sceneId ? { ...s, prompt: revisedPrompt } : s) }] as const
                                : [id, proj] as const,
                            );
                            localStorage.setItem("pm-video-projects", JSON.stringify(updated));
                          }
                        } catch { /* ignore */ }

                        // Now regenerate with the revised prompt
                        const sceneIdx = projectScenes.findIndex((s) => s.id === sceneId);
                        onCanvasAction({ type: "generate-video-scene", videoProjectId: msg.videoProjectId, sceneIndex: sceneIdx });
                        const res = await fetch("/api/generate/video", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ prompt: revisedPrompt, duration: scene.duration, aspectRatio: "16:9", mode: "t2v" }),
                        });
                        if (!res.ok) return;
                        const data = await res.json();
                        if (data.generationId) {
                          const { streamGeneration } = await import("@/lib/api");
                          streamGeneration(data.generationId, { onCompleted: () => { /* state syncs via VideoEditor */ } });
                        }
                      } catch { /* fail silently */ }
                    }}
                    onApproveScene={(sceneId) => {
                      // WHY: In Step Mode, approving a scene releases the
                      // pending approval lock in the CREATE_VIDEO loop, which
                      // then resumes generation of the NEXT scene. The loop
                      // is paused via waitForApproval(sceneIdx) and resumes
                      // when releaseApproval(sceneIdx) is called here.
                      if (creationMode !== "step") return;
                      const sceneIdx = projectScenes.findIndex((s) => s.id === sceneId);
                      if (sceneIdx < 0) return;
                      releaseApproval(sceneIdx);
                    }}
                    onRegenerate={async (sceneId) => {
                      // WHY: Inline regenerate — directly call the video API
                      // for this specific scene rather than opening the editor.
                      const scene = projectScenes.find((s) => s.id === sceneId);
                      if (!scene || !msg.videoProjectId) return;
                      // Mark as regenerating in the project state
                      onCanvasAction({ type: "generate-video-scene", videoProjectId: msg.videoProjectId, sceneIndex: projectScenes.findIndex((s) => s.id === sceneId) });
                      try {
                        const res = await fetch("/api/generate/video", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ prompt: scene.prompt, duration: scene.duration, aspectRatio: "16:9", mode: "t2v" }),
                        });
                        if (!res.ok) return;
                        const data = await res.json();
                        if (!data.generationId) return;
                        const { streamGeneration } = await import("@/lib/api");
                        streamGeneration(data.generationId, {
                          onCompleted: () => { /* VideoEditor watches the project state */ },
                        });
                      } catch { /* fail silently */ }
                    }}
                    onTrimChange={(sceneId, start, end) => {
                      // WHY: Trim updates persist via the project state which
                      // syncs to localStorage; the VideoEditor reads the same state.
                      const scenes = projectScenes.map((s) =>
                        s.id === sceneId ? { ...s, trimStart: start, trimEnd: end } : s,
                      );
                      // Update localStorage directly so both UIs stay in sync
                      try {
                        const saved = localStorage.getItem("pm-video-projects");
                        if (saved) {
                          const entries: [string, { scenes: typeof scenes }][] = JSON.parse(saved);
                          const updated = entries.map(([id, proj]) =>
                            id === msg.videoProjectId ? [id, { ...proj, scenes }] as const : [id, proj] as const,
                          );
                          localStorage.setItem("pm-video-projects", JSON.stringify(updated));
                        }
                      } catch { /* ignore */ }
                    }}
                    onStitch={() => {
                      onCanvasAction({ type: "stitch-video", videoProjectId: msg.videoProjectId! });
                      onCanvasAction({ type: "open-video-editor", videoProjectId: msg.videoProjectId! });
                    }}
                    onGenerateScore={async () => {
                      // WHY: Inline Sound Director trigger — fetches current
                      // stitched URL from project state and runs the pipeline.
                      const saved = localStorage.getItem("pm-video-projects");
                      if (!saved) return;
                      try {
                        const entries: [string, { audioUrl?: string; scenes: typeof projectScenes }][] = JSON.parse(saved);
                        const proj = entries.find(([id]) => id === msg.videoProjectId);
                        if (!proj) return;
                        // Build scene timing
                        let currentTime = 0;
                        const sceneTiming = proj[1].scenes
                          .filter((s) => s.videoUrl && s.status === "ready")
                          .map((s, i, arr) => {
                            const duration = s.trimEnd - s.trimStart;
                            const startTime = currentTime;
                            currentTime += duration;
                            const role = i === 0 ? "stimulation"
                              : i === arr.length - 1 ? "validation"
                              : i < arr.length / 2 ? "captivation" : "anticipation";
                            return { prompt: s.prompt, startTime, endTime: currentTime, attentionRole: role };
                          });
                        // Call Sound Director
                        const directRes = await fetch("/api/proxy/direct-sound", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ scenes: sceneTiming, totalDuration: currentTime, targetEmotion: "engagement" }),
                        });
                        if (!directRes.ok) return;
                        const directData = await directRes.json();
                        const lyriaPrompt = directData?.data?.lyriaPrompt ?? directData?.lyriaPrompt;
                        if (!lyriaPrompt) return;
                        // Generate via Lyria 3
                        const musicRes = await fetch("/api/generate/music/lyria", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ prompt: lyriaPrompt, duration: Math.ceil(currentTime), model: "pro" }),
                        });
                        if (musicRes.ok) {
                          const musicData = await musicRes.json();
                          const audioUrl = musicData?.data?.audioUrl ?? musicData?.audioUrl;
                          if (audioUrl) {
                            // Update project audioUrl
                            const updated = entries.map(([id, p]) =>
                              id === msg.videoProjectId ? [id, { ...p, audioUrl }] as const : [id, p] as const,
                            );
                            localStorage.setItem("pm-video-projects", JSON.stringify(updated));
                          }
                        }
                      } catch { /* ignore */ }
                    }}
                  />
                );
              })()}
            </div>
          ))}

          {isThinking && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-royal-muted shadow-sm shadow-royal/20">
                <img src="/logos/pm-icon.svg" alt="AI" className="h-5 w-5" />
              </div>
              <div className="rounded-2xl rounded-tl-md bg-slate/80 backdrop-blur-sm px-4 py-3 shadow-sm">
                <ThinkingDots />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mode toggle — 3-way picker: Plan / Step / Auto */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-smoke/30 gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-smoke/30 bg-slate/30 p-0.5">
          <button
            onClick={() => setCreationMode("plan")}
            title="Plan Mode — AI builds the plan, no generation until you say execute"
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-all cursor-pointer ${
              creationMode === "plan"
                ? "bg-royal/15 text-royal"
                : "text-ash/60 hover:text-cloud"
            }`}
          >
            <ListChecks size={12} strokeWidth={1.5} />
            Plan
          </button>
          <button
            onClick={() => setCreationMode("step")}
            title="Step Mode — AI generates one scene at a time, you approve or reject with feedback"
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-all cursor-pointer ${
              creationMode === "step"
                ? "bg-amber-500/15 text-amber-400"
                : "text-ash/60 hover:text-cloud"
            }`}
          >
            <Check size={12} strokeWidth={1.5} />
            Step
          </button>
          <button
            onClick={() => setCreationMode("auto")}
            title="Auto Mode — AI generates everything hands-off, no stops"
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-all cursor-pointer ${
              creationMode === "auto"
                ? "bg-emerald-500/15 text-emerald-400"
                : "text-ash/60 hover:text-cloud"
            }`}
          >
            <Rocket size={12} strokeWidth={1.5} />
            Auto
          </button>
        </div>
        <span className="hidden lg:inline text-[9px] text-ash/30 font-mono">
          Shift+Tab
        </span>
      </div>

      {/* Input — assets prop powers the @ mention popup */}
      <ChatInput
        onSend={handleSend}
        disabled={isThinking}
        placeholder="Tell me what to do... (@ to tag assets)"
        assets={mentionAssets}
      />
    </div>
  );
}
