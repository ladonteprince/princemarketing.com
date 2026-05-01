"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Sparkles, Loader2, AlertCircle, MessageSquare } from "lucide-react";
import {
  StoryboardStrip,
  generateStoryboard,
  type StoryboardScene,
  type StoryboardResponse,
} from "@/components/dashboard/StoryboardStrip";

// WHY: The Storyboard tab is purely a chat-driven destination — the user does
// NOT navigate here manually. The Workspace strategist emits a
// GENERATE_STORYBOARD action which the ChatPanel handler stashes in
// localStorage as `pm-storyboard-pending`, then redirects here. On mount we
// read that payload, auto-fire the API, and present the keyframes for
// approve / regenerate / remove. After approval we hand the approved frames
// back via `pm-storyboard-approved` and route the user back to /dashboard
// (Workspace) where the strategist picks up the next step (CREATE_VIDEO with
// i2v + firstFrameUrl per scene).

type PendingScenePayload = {
  sceneIndex: number;
  prompt: string;
  aspectRatio?: "16:9" | "9:16" | "1:1";
  referenceImages?: string[];
};

type PendingStoryboard = {
  videoProjectId: string;
  model: "nano-banana-pro" | "gpt-image-2";
  scenes: PendingScenePayload[];
  requestedAt: string;
};

const PENDING_KEY = "pm-storyboard-pending";
const APPROVED_KEY = "pm-storyboard-approved";

export default function StoryboardPage() {
  const [scenes, setScenes] = useState<StoryboardScene[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string>("");
  const [model, setModel] = useState<"nano-banana-pro" | "gpt-image-2">(
    "nano-banana-pro",
  );
  // WHY: Guard against double-fire on React strict-mode mount and HMR.
  const hasMountedRef = useRef(false);

  // ─── Pipeline ──────────────────────────────────────────────────────

  const fireGenerate = useCallback(
    async (payload: PendingStoryboard, replaceState: boolean) => {
      setError(null);
      setIsGenerating(true);
      setProjectId(payload.videoProjectId);
      setModel(payload.model);

      // Seed local state so the strip renders skeletons while the API runs
      const seeded: StoryboardScene[] = payload.scenes.map((s) => ({
        sceneIndex: s.sceneIndex,
        prompt: s.prompt,
        status: "generating",
        imageUrl: null,
        aspectRatio: s.aspectRatio ?? "16:9",
      }));
      if (replaceState) setScenes(seeded);

      try {
        const result: StoryboardResponse = await generateStoryboard({
          videoProjectId: payload.videoProjectId,
          model: payload.model,
          scenes: payload.scenes.map((s) => ({
            sceneIndex: s.sceneIndex,
            prompt: s.prompt,
            aspectRatio: s.aspectRatio ?? "16:9",
            referenceImages: s.referenceImages,
          })),
        });

        setScenes((current) =>
          current.map((s) => {
            const r = result.scenes.find((x) => x.sceneIndex === s.sceneIndex);
            if (!r) return s;
            return {
              ...s,
              status:
                r.status === "ready"
                  ? "ready"
                  : r.status === "failed"
                    ? "failed"
                    : "generating",
              imageUrl: r.imageUrl,
              error: r.error,
            };
          }),
        );

        if (result.modelRequested !== result.model) {
          setError(
            `Requested ${result.modelRequested} but server fell back to ${result.model} — verify OPENAI_API_KEY on the server.`,
          );
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Storyboard generation failed");
        setScenes((current) =>
          current.map((s) => ({ ...s, status: "failed", error: "Request failed" })),
        );
      } finally {
        setIsGenerating(false);
      }
    },
    [],
  );

  // ─── Auto-load on mount from localStorage ──────────────────────────

  useEffect(() => {
    if (hasMountedRef.current) return;
    hasMountedRef.current = true;
    if (typeof window === "undefined") return;

    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return;

    try {
      const payload = JSON.parse(raw) as PendingStoryboard;
      if (!payload || !Array.isArray(payload.scenes) || payload.scenes.length === 0) {
        return;
      }
      // WHY: Clear the pending payload immediately so a refresh doesn't refire.
      // The local React state holds the live results from here on.
      localStorage.removeItem(PENDING_KEY);
      void fireGenerate(payload, true);
    } catch (e) {
      console.warn("[Storyboard] Failed to parse pending payload:", e);
      localStorage.removeItem(PENDING_KEY);
    }
  }, [fireGenerate]);

  // ─── Per-scene handlers ─────────────────────────────────────────────

  const handleApprove = useCallback((sceneIndex: number) => {
    setScenes((current) =>
      current.map((s) =>
        s.sceneIndex === sceneIndex ? { ...s, status: "approved" } : s,
      ),
    );
  }, []);

  const handleUnapprove = useCallback((sceneIndex: number) => {
    setScenes((current) =>
      current.map((s) =>
        s.sceneIndex === sceneIndex ? { ...s, status: "ready" } : s,
      ),
    );
  }, []);

  const handleRegenerate = useCallback(
    async (sceneIndex: number) => {
      const scene = scenes.find((s) => s.sceneIndex === sceneIndex);
      if (!scene || !projectId) return;

      setScenes((current) =>
        current.map((s) =>
          s.sceneIndex === sceneIndex
            ? { ...s, status: "generating", error: undefined, imageUrl: null }
            : s,
        ),
      );

      try {
        const result = await generateStoryboard({
          videoProjectId: projectId,
          model,
          scenes: [
            {
              sceneIndex,
              prompt: scene.prompt,
              aspectRatio: scene.aspectRatio,
            },
          ],
        });
        const r = result.scenes[0];
        setScenes((current) =>
          current.map((s) =>
            s.sceneIndex === sceneIndex
              ? {
                  ...s,
                  status: r.status === "ready" ? "ready" : "failed",
                  imageUrl: r.imageUrl,
                  error: r.error,
                }
              : s,
          ),
        );
      } catch (e) {
        setScenes((current) =>
          current.map((s) =>
            s.sceneIndex === sceneIndex
              ? {
                  ...s,
                  status: "failed",
                  error: e instanceof Error ? e.message : "Regenerate failed",
                }
              : s,
          ),
        );
      }
    },
    [scenes, model, projectId],
  );

  const handleRemove = useCallback((sceneIndex: number) => {
    setScenes((current) => current.filter((s) => s.sceneIndex !== sceneIndex));
  }, []);

  const handleAllApproved = useCallback(() => {
    // WHY: Hand the approved keyframes back to the chat-driven Workspace.
    // ChatPanel reads pm-storyboard-approved on mount and surfaces them to
    // the strategist so the next CREATE_VIDEO emission can carry firstFrameUrl
    // per scene (i2v mode). Then redirect the user back to chat — they never
    // navigate the dashboard manually.
    if (typeof window === "undefined") return;
    const approved = scenes
      .filter((s) => s.status === "approved" && s.imageUrl)
      .map((s) => ({
        sceneIndex: s.sceneIndex,
        prompt: s.prompt,
        sourceImage: s.imageUrl,
        aspectRatio: s.aspectRatio,
      }));
    if (approved.length === 0) return;
    localStorage.setItem(
      APPROVED_KEY,
      JSON.stringify({
        videoProjectId: projectId,
        scenes: approved,
        approvedAt: new Date().toISOString(),
      }),
    );
    window.location.href = "/dashboard";
  }, [scenes, projectId]);

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-void px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Sparkles size={24} className="text-royal" strokeWidth={1.5} />
            <h1 className="text-2xl font-bold text-cloud">Storyboard</h1>
            {projectId && (
              <span className="text-xs text-ash font-mono">
                {projectId.slice(0, 8)}…
              </span>
            )}
          </div>
          <p className="text-sm text-ash max-w-2xl">
            Cheap-keyframe approval gate. Approved frames flow back to the
            strategist as <code className="text-cloud bg-slate px-1 rounded">firstFrameUrl</code> on
            each scene before video generation runs.
          </p>
        </header>

        {/* Status row (when we have scenes) */}
        {scenes.length > 0 && (
          <div className="mb-6 flex items-center justify-between rounded-xl border border-smoke bg-graphite/40 px-4 py-3">
            <span className="text-xs text-ash">
              Model: <code className="text-cloud">{model}</code> ·{" "}
              {scenes.filter((s) => s.status === "ready" || s.status === "approved").length}
              {" / "}
              {scenes.length} ready ·{" "}
              {scenes.filter((s) => s.status === "approved").length}
              {" / "}
              {scenes.length} approved
            </span>
            {isGenerating && (
              <span className="flex items-center gap-2 text-xs text-royal">
                <Loader2 size={12} className="animate-spin" />
                generating…
              </span>
            )}
          </div>
        )}

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-300">
            <AlertCircle size={14} strokeWidth={1.5} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <StoryboardStrip
          scenes={scenes}
          videoProjectId={projectId}
          onApprove={handleApprove}
          onUnapprove={handleUnapprove}
          onRegenerate={handleRegenerate}
          onRemove={handleRemove}
          onAllApproved={handleAllApproved}
          isGenerating={isGenerating}
        />

        {/* Empty state — directs user back to chat */}
        {scenes.length === 0 && !isGenerating && (
          <div className="mt-8 rounded-xl border border-smoke/50 bg-graphite/20 p-6">
            <div className="flex items-start gap-3">
              <MessageSquare size={18} className="text-royal mt-0.5 shrink-0" strokeWidth={1.5} />
              <div className="text-sm text-ash">
                <p className="text-cloud font-medium mb-2">
                  Nothing pending
                </p>
                <p className="mb-3">
                  This view is chat-driven. To get a storyboard, head back to
                  the Workspace and brief the strategist on the video you want.
                  When it&apos;s ready to plan visuals, it&apos;ll send you here
                  with keyframes to approve.
                </p>
                <a
                  href="/dashboard"
                  className="
                    inline-flex items-center gap-1.5 rounded-lg bg-royal px-3 py-1.5
                    text-xs font-medium text-white hover:bg-royal/90
                    transition-colors duration-[var(--transition-micro)]
                  "
                >
                  <MessageSquare size={12} strokeWidth={2} />
                  Back to Workspace
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
