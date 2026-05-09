"use client";

// WHY: Temporary unauthenticated preview of the storyboard sheet UI for visual
// review during design iteration. Mounts the StoryboardStrip with seeded mock
// scenes so the layout, comments, edit-prompt, and add-scene flows can be
// exercised without auth, image-gen credits, or the chat-driven handoff.
// Delete this route once the design lands.

import { useState, useCallback, useRef } from "react";
import {
  StoryboardStrip,
  type StoryboardScene,
  type SceneComment,
} from "@/components/dashboard/StoryboardStrip";

const SEED_SCENES: StoryboardScene[] = [
  {
    sceneIndex: 0,
    prompt:
      "Wide establishing shot. Solitary performer steps into a vast brutalist hall, wet floor reflections, a single shaft of light cutting diagonally across the frame.",
    status: "approved",
    imageUrl:
      "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=900&q=70",
    aspectRatio: "16:9",
    comments: [
      {
        id: "c1",
        text: "Light beam should be harder — feels too soft.",
        role: "user",
        createdAt: new Date().toISOString(),
      },
    ],
  },
  {
    sceneIndex: 1,
    prompt:
      "Aggressive close-up on the hands — trembling, knuckles white, fabric crumpled in fists. Audio cue: held breath about to break.",
    status: "ready",
    imageUrl:
      "https://images.unsplash.com/photo-1499415479124-43c32433a620?w=900&q=70",
    aspectRatio: "16:9",
    comments: [],
  },
  {
    sceneIndex: 2,
    prompt:
      "Whip-pan to overhead shot. Performer mid-collapse on the floor, hair fanned out, one arm reaching up toward the light.",
    status: "ready",
    imageUrl:
      "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=900&q=70",
    aspectRatio: "16:9",
    comments: [
      {
        id: "c2",
        text: "Reframe — head should be lower-left, more negative space top-right.",
        role: "user",
        createdAt: new Date().toISOString(),
      },
      {
        id: "c3",
        text: "AI: agreed — current framing crowds the subject. Try lens 35mm, low-angle, performer offset to lower third.",
        role: "ai",
        createdAt: new Date().toISOString(),
      },
    ],
  },
  {
    sceneIndex: 3,
    prompt:
      "Slow orbit around a sculptural pose — back arched, mouth open mid-vocal phrase, smoke drifting through the light beam.",
    status: "generating",
    imageUrl: null,
    aspectRatio: "16:9",
    comments: [],
  },
  {
    sceneIndex: 4,
    prompt:
      "Side silhouette, full-body lunge. Wet floor mirrors the body. The vocal hits its highest note here — facial tension peaks.",
    status: "failed",
    imageUrl: null,
    error: "Reference image quota exceeded",
    aspectRatio: "16:9",
    comments: [],
  },
  {
    sceneIndex: 5,
    prompt:
      "Final beat. Standing under one harsh isolated spotlight, head tilted up, eyes closed, exhausted but unbroken.",
    status: "ready",
    imageUrl:
      "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=900&q=70",
    aspectRatio: "16:9",
    comments: [],
  },
];

export default function StoryboardPreview() {
  const [scenes, setScenes] = useState<StoryboardScene[]>(SEED_SCENES);
  // WHY: Single composite image from a one-call @aimikoda-style sheet. Lives
  // alongside the per-panel imageUrls — both modes coexist so you can use the
  // sheet for cheap ideation and per-panel Redo for refinement.
  const [sheetImageUrl, setSheetImageUrl] = useState<string | null>(null);
  const [sheetStatus, setSheetStatus] = useState<
    "idle" | "generating" | "ready" | "failed"
  >("idle");
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [sheetStyle, setSheetStyle] = useState<"rough-pencil" | "photoreal">(
    "rough-pencil",
  );
  // WHY: Dedupe in-flight regen requests by sceneIndex. React 19 + Next 15 dev
  // double-invokes some handlers in strict mode, which doubles OpenAI cost.
  // The Set survives re-renders (ref) and any duplicate trigger no-ops.
  const inFlightRef = useRef<Set<number>>(new Set());
  const sheetInFlightRef = useRef(false);

  const handleApprove = useCallback((sceneIndex: number) => {
    setScenes((c) =>
      c.map((s) =>
        s.sceneIndex === sceneIndex ? { ...s, status: "approved" } : s,
      ),
    );
  }, []);

  const handleUnapprove = useCallback((sceneIndex: number) => {
    setScenes((c) =>
      c.map((s) =>
        s.sceneIndex === sceneIndex ? { ...s, status: "ready" } : s,
      ),
    );
  }, []);

  const handleRegenerate = useCallback(async (sceneIndex: number) => {
    // WHY: Hit the dev-only preview endpoint that calls OpenAI gpt-image-1
    // (a.k.a. GPT Image 2) directly and inlines the result as a data URL.
    // No auth, no GCS, no .ai pipeline — real model output for sheet review.
    //
    // Stable callback (empty deps) — we read latest scene via functional
    // setScenes so the in-flight fetch's setter reads the freshest state when
    // it resolves, even if React Fast Refresh re-renders during the wait.
    if (inFlightRef.current.has(sceneIndex)) return;
    inFlightRef.current.add(sceneIndex);

    let prompt = "";
    let aspect: "16:9" | "9:16" | "1:1" = "16:9";
    let annotations: StoryboardScene["annotations"];
    setScenes((c) => {
      const scene = c.find((s) => s.sceneIndex === sceneIndex);
      if (!scene) return c;
      prompt = scene.prompt.trim();
      aspect = scene.aspectRatio ?? "16:9";
      annotations = scene.annotations;
      if (!prompt) {
        return c.map((s) =>
          s.sceneIndex === sceneIndex
            ? { ...s, status: "failed", error: "Prompt is empty" }
            : s,
        );
      }
      return c.map((s) =>
        s.sceneIndex === sceneIndex
          ? { ...s, status: "generating", imageUrl: null, error: undefined }
          : s,
      );
    });
    if (!prompt) {
      inFlightRef.current.delete(sceneIndex);
      return;
    }

    try {
      const res = await fetch("/api/preview/storyboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenes: [{ sceneIndex, prompt, aspectRatio: aspect, annotations }],
        }),
      });
      const json = (await res.json()) as {
        scenes?: Array<{
          sceneIndex: number;
          status: "ready" | "failed";
          imageUrl: string | null;
          error?: string;
        }>;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(json.error ?? `Preview API ${res.status}`);
      }
      const r = json.scenes?.find((x) => x.sceneIndex === sceneIndex);
      setScenes((c) =>
        c.map((s) =>
          s.sceneIndex === sceneIndex
            ? {
                ...s,
                status: r?.status === "ready" ? "ready" : "failed",
                imageUrl: r?.imageUrl ?? null,
                error: r?.error,
              }
            : s,
        ),
      );
    } catch (err) {
      setScenes((c) =>
        c.map((s) =>
          s.sceneIndex === sceneIndex
            ? {
                ...s,
                status: "failed",
                error: err instanceof Error ? err.message : "Generate failed",
              }
            : s,
        ),
      );
    } finally {
      inFlightRef.current.delete(sceneIndex);
    }
  }, []);

  const handleRemove = useCallback((sceneIndex: number) => {
    setScenes((c) => c.filter((s) => s.sceneIndex !== sceneIndex));
  }, []);

  const handleAddScene = useCallback(() => {
    setScenes((c) => {
      const nextIndex =
        c.length === 0 ? 0 : Math.max(...c.map((s) => s.sceneIndex)) + 1;
      return [
        ...c,
        {
          sceneIndex: nextIndex,
          prompt: "",
          status: "pending",
          imageUrl: null,
          aspectRatio: "16:9",
          comments: [],
        },
      ];
    });
  }, []);

  const handlePromptChange = useCallback((sceneIndex: number, prompt: string) => {
    setScenes((c) =>
      c.map((s) =>
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
  }, []);

  const handleAddComment = useCallback(
    (sceneIndex: number, text: string) => {
      const comment: SceneComment = {
        id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        text,
        role: "user",
        createdAt: new Date().toISOString(),
      };
      setScenes((c) =>
        c.map((s) =>
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
      setScenes((c) =>
        c.map((s) =>
          s.sceneIndex === sceneIndex ? { ...s, annotations } : s,
        ),
      );
    },
    [],
  );

  const handleGenerateSheet = useCallback(async () => {
    // WHY: Snapshot scenes via functional setScenes so we send the latest
    // prompts/annotations even if the user just edited something.
    let payloadScenes: Array<{
      sceneIndex: number;
      prompt: string;
      annotations: StoryboardScene["annotations"];
    }> = [];
    setScenes((c) => {
      payloadScenes = c
        .filter((s) => s.prompt.trim().length > 0)
        .map((s) => ({
          sceneIndex: s.sceneIndex,
          prompt: s.prompt.trim(),
          annotations: s.annotations,
        }));
      return c;
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
      const res = await fetch("/api/preview/storyboard-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenes: payloadScenes,
          aspectRatio: "16:9",
          style: sheetStyle,
        }),
      });
      const json = (await res.json()) as {
        imageUrl?: string;
        error?: string;
      };
      if (!res.ok || !json.imageUrl) {
        throw new Error(json.error ?? `Sheet API ${res.status}`);
      }
      setSheetImageUrl(json.imageUrl);
      setSheetStatus("ready");
    } catch (err) {
      setSheetError(err instanceof Error ? err.message : "Sheet generation failed");
      setSheetStatus("failed");
    } finally {
      sheetInFlightRef.current = false;
    }
  }, [sheetStyle]);

  const handleGenerateAll = useCallback(async () => {
    // WHY: Snapshot panels needing work, mark them all "generating" in one
    // setState, then fire one POST with all of them — server runs them in
    // parallel via Promise.all. Skips panels already in flight or approved.
    type Pending = {
      sceneIndex: number;
      prompt: string;
      aspectRatio: "16:9" | "9:16" | "1:1";
      annotations: StoryboardScene["annotations"];
    };
    const pending: Pending[] = [];
    setScenes((c) => {
      c.forEach((s) => {
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
      return c.map((s) =>
        pendingIdx.has(s.sceneIndex)
          ? { ...s, status: "generating", error: undefined, imageUrl: null }
          : s,
      );
    });
    if (pending.length === 0) return;
    pending.forEach((p) => inFlightRef.current.add(p.sceneIndex));

    try {
      const res = await fetch("/api/preview/storyboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenes: pending }),
      });
      const json = (await res.json()) as {
        scenes?: Array<{
          sceneIndex: number;
          status: "ready" | "failed";
          imageUrl: string | null;
          error?: string;
        }>;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(json.error ?? `Preview API ${res.status}`);
      }
      const byIdx = new Map(json.scenes?.map((r) => [r.sceneIndex, r]) ?? []);
      setScenes((c) =>
        c.map((s) => {
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Generate-all failed";
      const pendingIdx = new Set(pending.map((p) => p.sceneIndex));
      setScenes((c) =>
        c.map((s) =>
          pendingIdx.has(s.sceneIndex)
            ? { ...s, status: "failed", error: msg }
            : s,
        ),
      );
    } finally {
      pending.forEach((p) => inFlightRef.current.delete(p.sceneIndex));
    }
  }, []);

  return (
    <div className="min-h-screen bg-void px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-cloud mb-2">
            Storyboard preview
          </h1>
          <p className="text-sm text-ash max-w-2xl">
            Two ways to generate.{" "}
            <span className="text-cloud">Generate sheet</span> = one{" "}
            <code className="text-cloud bg-slate px-1 rounded">gpt-image-2</code>{" "}
            call for the whole grid (@aimikoda-style — cheap and visually
            unified).{" "}
            <span className="text-cloud">Generate all</span> /{" "}
            <span className="text-cloud">Redo</span> = one call per panel
            (slower, full resolution per panel). Dev-only, no auth.
          </p>
        </header>

        {/* Sheet image card — @aimikoda-style single-call composite */}
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
                {scenes.length} panels in one image
              </span>
            )}
          </div>
        </section>

        <StoryboardStrip
          scenes={scenes}
          videoProjectId="preview"
          onApprove={handleApprove}
          onUnapprove={handleUnapprove}
          onRegenerate={handleRegenerate}
          onRemove={handleRemove}
          onAllApproved={() => alert("would generate videos here")}
          onAddScene={handleAddScene}
          onPromptChange={handlePromptChange}
          onAddComment={handleAddComment}
          onAnnotationsChange={handleAnnotationsChange}
          onGenerateAll={handleGenerateAll}
          onGenerateSheet={handleGenerateSheet}
        />
      </div>
    </div>
  );
}
