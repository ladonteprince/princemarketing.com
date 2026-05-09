"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Sparkles,
  Loader2,
  AlertCircle,
  MessageSquare,
  Users,
} from "lucide-react";
import {
  StoryboardStrip,
  generateStoryboard,
  generateStoryboardSheet,
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

type CastHandle = {
  id: string;
  handle: string | null;
  category: "character" | "prop" | "environment";
  label: string | null;
  sheetImageUrl: string;
};

export default function StoryboardPage() {
  const [scenes, setScenes] = useState<StoryboardScene[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string>("");
  const [model, setModel] = useState<
    "nano-banana-pro-preview" | "nano-banana-pro" | "gpt-image-2"
  >("gpt-image-2");
  // WHY: Single composite-sheet image (one gpt-image-2 call drawing all panels
  // in @aimikoda style). Coexists with per-panel imageUrls so users can ideate
  // on the cheap sheet then iterate weak panels with per-panel Redo.
  const [sheetImageUrl, setSheetImageUrl] = useState<string | null>(null);
  const [sheetStatus, setSheetStatus] = useState<
    "idle" | "generating" | "ready" | "failed"
  >("idle");
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [sheetStyle, setSheetStyle] = useState<"rough-pencil" | "photoreal">(
    "rough-pencil",
  );
  // WHY: Cast/props/environments roster — fetched once on mount, displayed
  // as a hint bar so the user knows which @handles resolve. Backend
  // resolveCast() does the real substitution per request.
  const [cast, setCast] = useState<CastHandle[]>([]);
  // WHY: Guard against double-fire on React strict-mode mount and HMR.
  const hasMountedRef = useRef(false);
  // WHY: Dedupe in-flight regen requests by sceneIndex so a single click
  // can't double-charge the OpenAI / .ai pipeline. Survives re-renders.
  const inFlightRef = useRef<Set<number>>(new Set());
  const sheetInFlightRef = useRef(false);

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

  // ─── Cast hint bar — fetch once on mount ────────────────────────────

  useEffect(() => {
    void fetch("/api/cast")
      .then(async (r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.cast) setCast(j.cast as CastHandle[]);
      })
      .catch(() => {});
  }, []);

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
      if (inFlightRef.current.has(sceneIndex)) return;

      // WHY: Read current scene + projectId via functional setScenes so a stale
      // closure (Fast Refresh, double-render) can't capture old data. The
      // outer projectId is still needed to gate the request.
      let prompt = "";
      let aspectRatio: "16:9" | "9:16" | "1:1" = "16:9";
      let annotations: StoryboardScene["annotations"];
      setScenes((current) => {
        const scene = current.find((s) => s.sceneIndex === sceneIndex);
        if (!scene) return current;
        prompt = scene.prompt;
        aspectRatio = scene.aspectRatio ?? "16:9";
        annotations = scene.annotations;
        return current.map((s) =>
          s.sceneIndex === sceneIndex
            ? { ...s, status: "generating", error: undefined, imageUrl: null }
            : s,
        );
      });
      if (!prompt || !projectId) return;
      inFlightRef.current.add(sceneIndex);

      try {
        const result = await generateStoryboard({
          videoProjectId: projectId,
          model,
          scenes: [{ sceneIndex, prompt, aspectRatio, annotations }],
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
      } finally {
        inFlightRef.current.delete(sceneIndex);
      }
    },
    [model, projectId],
  );

  const handleRemove = useCallback((sceneIndex: number) => {
    setScenes((current) => current.filter((s) => s.sceneIndex !== sceneIndex));
  }, []);

  const handleAddScene = useCallback(() => {
    setScenes((current) => {
      const nextIndex =
        current.length === 0
          ? 0
          : Math.max(...current.map((s) => s.sceneIndex)) + 1;
      // WHY: New panels start empty — the user types a prompt and hits Redo to
      // generate. Aspect ratio inherits from the most recent scene so the sheet
      // stays visually consistent.
      const aspectRatio = current[current.length - 1]?.aspectRatio ?? "16:9";
      return [
        ...current,
        {
          sceneIndex: nextIndex,
          prompt: "",
          status: "pending",
          imageUrl: null,
          aspectRatio,
          comments: [],
        },
      ];
    });
  }, []);

  const handlePromptChange = useCallback(
    (sceneIndex: number, prompt: string) => {
      // WHY: Editing the prompt drops the panel back to "ready" state if it was
      // approved — the image no longer matches the spec, so the user has to
      // either regenerate or re-approve consciously.
      setScenes((current) =>
        current.map((s) =>
          s.sceneIndex === sceneIndex
            ? {
                ...s,
                prompt,
                status:
                  s.status === "approved" || s.status === "ready"
                    ? "ready"
                    : s.status,
              }
            : s,
        ),
      );
    },
    [],
  );

  const handleAddComment = useCallback(
    (sceneIndex: number, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const comment = {
        id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        text: trimmed,
        role: "user" as const,
        createdAt: new Date().toISOString(),
      };
      setScenes((current) =>
        current.map((s) =>
          s.sceneIndex === sceneIndex
            ? { ...s, comments: [...(s.comments ?? []), comment] }
            : s,
        ),
      );
    },
    [],
  );

  const handleAnnotationsChange = useCallback(
    (sceneIndex: number, annotations: StoryboardScene["annotations"]) => {
      // WHY: Annotations don't affect approval status — they're directorial
      // hints attached to the scene. Edits don't drop a panel from approved
      // because the hints only matter on the next regen or downstream video
      // gen.
      setScenes((current) =>
        current.map((s) =>
          s.sceneIndex === sceneIndex ? { ...s, annotations } : s,
        ),
      );
    },
    [],
  );

  const handleGenerateSheet = useCallback(async () => {
    // WHY: Snapshot scenes via functional setScenes so the request carries the
    // freshest prompts/annotations even if the user just edited inline.
    let payloadScenes: Array<{
      sceneIndex: number;
      prompt: string;
      annotations: StoryboardScene["annotations"];
    }> = [];
    setScenes((current) => {
      payloadScenes = current
        .filter((s) => s.prompt.trim().length > 0)
        .map((s) => ({
          sceneIndex: s.sceneIndex,
          prompt: s.prompt.trim(),
          annotations: s.annotations,
        }));
      return current;
    });
    if (payloadScenes.length < 2) {
      setSheetError("Need at least 2 panels with prompts to generate a sheet");
      setSheetStatus("failed");
      return;
    }
    if (sheetInFlightRef.current) return;
    sheetInFlightRef.current = true;
    setSheetStatus("generating");
    setSheetError(null);

    try {
      const result = await generateStoryboardSheet({
        videoProjectId: projectId || undefined,
        scenes: payloadScenes,
        aspectRatio: "16:9",
        style: sheetStyle,
      });
      setSheetImageUrl(result.imageUrl);
      setSheetStatus("ready");
    } catch (err) {
      setSheetError(
        err instanceof Error ? err.message : "Sheet generation failed",
      );
      setSheetStatus("failed");
    } finally {
      sheetInFlightRef.current = false;
    }
  }, [projectId, sheetStyle]);

  const handleGenerateAll = useCallback(async () => {
    // WHY: Bulk-fire all panels needing generation in one POST. Server runs
    // them in parallel via Promise.all. Per-panel statuses arrive in the
    // response and get merged into state.
    type Pending = {
      sceneIndex: number;
      prompt: string;
      aspectRatio: "16:9" | "9:16" | "1:1";
      annotations: StoryboardScene["annotations"];
    };
    const pending: Pending[] = [];
    setScenes((current) => {
      current.forEach((s) => {
        const needsGen =
          (s.status === "pending" ||
            s.status === "failed" ||
            (s.status !== "generating" && !s.imageUrl)) &&
          s.prompt.trim().length > 0 &&
          !inFlightRef.current.has(s.sceneIndex);
        if (needsGen) {
          pending.push({
            sceneIndex: s.sceneIndex,
            prompt: s.prompt.trim(),
            aspectRatio: s.aspectRatio ?? "16:9",
            annotations: s.annotations,
          });
        }
      });
      const pendingIdx = new Set(pending.map((p) => p.sceneIndex));
      return current.map((s) =>
        pendingIdx.has(s.sceneIndex)
          ? { ...s, status: "generating", error: undefined, imageUrl: null }
          : s,
      );
    });
    if (pending.length === 0 || !projectId) return;
    pending.forEach((p) => inFlightRef.current.add(p.sceneIndex));

    try {
      const result = await generateStoryboard({
        videoProjectId: projectId,
        model,
        scenes: pending,
      });
      const byIdx = new Map(result.scenes.map((r) => [r.sceneIndex, r]));
      setScenes((current) =>
        current.map((s) => {
          const r = byIdx.get(s.sceneIndex);
          if (!r) return s;
          return {
            ...s,
            status: r.status === "ready" ? "ready" : "failed",
            imageUrl: r.imageUrl,
            error: r.error,
          };
        }),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Generate-all failed";
      const pendingIdx = new Set(pending.map((p) => p.sceneIndex));
      setScenes((current) =>
        current.map((s) =>
          pendingIdx.has(s.sceneIndex)
            ? { ...s, status: "failed", error: msg }
            : s,
        ),
      );
    } finally {
      pending.forEach((p) => inFlightRef.current.delete(p.sceneIndex));
    }
  }, [model, projectId]);

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
            Review, critique, and lock the visual direction before video
            credits get spent. Edit prompts inline, drop notes on individual
            panels, add or remove scenes, then ship the approved sheet to
            generation.
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

        {/* Cast hint — available @handles resolve to sheet refs at request time */}
        {cast.length > 0 && (
          <div className="mb-4 flex items-center gap-3 flex-wrap rounded-lg border border-smoke/50 bg-graphite/30 px-4 py-2.5">
            <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-ash">
              <Users size={12} strokeWidth={1.5} />
              Cast available
            </span>
            {cast.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  if (c.handle && navigator.clipboard) {
                    void navigator.clipboard.writeText(`@${c.handle}`);
                  }
                }}
                title={`Click to copy @${c.handle ?? ""}`}
                className="
                  flex items-center gap-1.5 rounded-full bg-void/60
                  border border-smoke px-2 py-1 cursor-pointer
                  hover:border-royal/50 hover:bg-graphite
                  transition-colors duration-[var(--transition-micro)]
                "
              >
                {c.sheetImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.sheetImageUrl}
                    alt=""
                    className="h-4 w-4 rounded-full object-cover"
                  />
                )}
                <code className="text-[10px] text-royal">@{c.handle}</code>
                <span className="text-[10px] text-ash">{c.label ?? ""}</span>
              </button>
            ))}
            <a
              href="/dashboard/cast"
              className="
                ml-auto text-[10px] text-ash hover:text-royal
                transition-colors duration-[var(--transition-micro)]
              "
            >
              Manage →
            </a>
          </div>
        )}

        {/* Composite sheet — single gpt-image-2 call drawing all panels */}
        {scenes.length >= 2 && (
          <section className="mb-6 rounded-xl border border-smoke bg-graphite/60 p-4">
            <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-cloud">
                  Composite sheet
                </h3>
                <span className="text-xs text-ash">
                  {sheetStatus === "ready"
                    ? "ready"
                    : sheetStatus === "generating"
                      ? "generating…"
                      : sheetStatus === "failed"
                        ? "failed"
                        : "not yet generated"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg border border-smoke overflow-hidden">
                  {(["rough-pencil", "photoreal"] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setSheetStyle(v)}
                      className={`
                        px-2 py-1 text-[10px] font-medium cursor-pointer
                        transition-colors duration-[var(--transition-micro)]
                        ${
                          sheetStyle === v
                            ? "bg-royal text-white"
                            : "bg-graphite/40 text-ash hover:text-cloud"
                        }
                      `}
                      aria-label={`Sheet style: ${v}`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="aspect-video w-full overflow-hidden rounded-lg bg-void border border-smoke flex items-center justify-center">
              {sheetStatus === "generating" ? (
                <span className="text-xs text-ash">
                  gpt-image-2 drawing the whole sheet… ~50s
                </span>
              ) : sheetStatus === "failed" ? (
                <span className="text-xs text-red-400 px-4 text-center">
                  {sheetError ?? "Sheet generation failed"}
                </span>
              ) : sheetImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={sheetImageUrl}
                  alt="Composite storyboard sheet"
                  className="w-full h-full object-contain"
                />
              ) : (
                <span className="text-xs text-ash px-4 text-center">
                  Click &quot;Generate sheet&quot; to draw all{" "}
                  {scenes.length} panels in one image (one gpt-image-2 call)
                </span>
              )}
            </div>
          </section>
        )}

        <StoryboardStrip
          scenes={scenes}
          videoProjectId={projectId}
          onApprove={handleApprove}
          onUnapprove={handleUnapprove}
          onRegenerate={handleRegenerate}
          onRemove={handleRemove}
          onAllApproved={handleAllApproved}
          onAddScene={handleAddScene}
          onPromptChange={handlePromptChange}
          onAddComment={handleAddComment}
          onAnnotationsChange={handleAnnotationsChange}
          onGenerateAll={handleGenerateAll}
          onGenerateSheet={handleGenerateSheet}
          isGenerating={isGenerating}
        />

        {/* Hint — chat is the primary path, but you can also seed panels manually */}
        {scenes.length === 0 && !isGenerating && (
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-smoke/50 bg-graphite/20 px-4 py-3 text-xs text-ash">
            <MessageSquare
              size={14}
              className="text-royal mt-0.5 shrink-0"
              strokeWidth={1.5}
            />
            <p>
              Click <span className="text-cloud">Add scene</span> above to seed
              a panel, or{" "}
              <a href="/dashboard" className="text-royal hover:underline">
                brief the strategist in the Workspace
              </a>{" "}
              and they&apos;ll send a full sheet over for review.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
