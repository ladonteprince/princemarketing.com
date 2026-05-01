"use client";

import { useState, useCallback } from "react";
import { Sparkles, Loader2, ArrowRight, AlertCircle } from "lucide-react";
import {
  StoryboardStrip,
  generateStoryboard,
  type StoryboardScene,
  type StoryboardResponse,
} from "@/components/dashboard/StoryboardStrip";

// WHY: The Storyboard tab is the cheap-keyframe approval gate before any
// expensive video generation. User briefs scenes here (or has the Workspace
// strategist push them in via GENERATE_STORYBOARD), reviews each keyframe,
// approves or regenerates, then ships the approved set to the Video Editor
// for Seedance i2v generation. This is the surface that powers the agency's
// "send the client a storyboard for sign-off" workflow.

const DEMO_SCENES: Array<{
  prompt: string;
  aspectRatio?: "16:9" | "9:16" | "1:1";
}> = [
  {
    prompt:
      "Wide establishing shot of a modern penthouse at golden hour, floor-to-ceiling windows facing a city skyline, warm cinematic lighting, dramatic atmosphere",
    aspectRatio: "16:9",
  },
  {
    prompt:
      "Close-up of @LaDonte adjusting cufflinks, intense focus, sharp directional light, shallow depth of field, luxury commercial aesthetic",
    aspectRatio: "16:9",
  },
  {
    prompt:
      "Medium shot of @LaDonte walking through penthouse interior with subtle confidence, motion blur in background, hard side lighting",
    aspectRatio: "16:9",
  },
  {
    prompt:
      "Direct-to-camera shot of @LaDonte delivering a line, low angle, dramatic chiaroscuro lighting, brand-grade portrait composition",
    aspectRatio: "16:9",
  },
];

export default function StoryboardPage() {
  const [scenes, setScenes] = useState<StoryboardScene[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<"nano-banana-pro" | "gpt-image-2">(
    "nano-banana-pro",
  );
  const projectId = "demo-storyboard";

  const handleGenerate = useCallback(async () => {
    setError(null);
    setIsGenerating(true);

    // Seed scenes in "generating" state
    const seeded: StoryboardScene[] = DEMO_SCENES.map((s, i) => ({
      sceneIndex: i,
      prompt: s.prompt,
      status: "generating",
      imageUrl: null,
      aspectRatio: s.aspectRatio ?? "16:9",
    }));
    setScenes(seeded);

    try {
      const result: StoryboardResponse = await generateStoryboard({
        videoProjectId: projectId,
        model,
        scenes: DEMO_SCENES.map((s, i) => ({
          sceneIndex: i,
          prompt: s.prompt,
          aspectRatio: s.aspectRatio ?? "16:9",
        })),
      });

      // Merge results back into scene state
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
          `Requested ${result.modelRequested} but server fell back to ${result.model} — check OPENAI_API_KEY on the server.`,
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Storyboard generation failed");
      setScenes((current) =>
        current.map((s) => ({
          ...s,
          status: "failed",
          error: "Request failed",
        })),
      );
    } finally {
      setIsGenerating(false);
    }
  }, [model, projectId]);

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
      if (!scene) return;

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

  const handleAllApproved = useCallback(() => {
    // WHY: When all keyframes are approved, ship them to the Video Editor
    // for Seedance i2v generation. The approved imageUrls become firstFrameUrl
    // on each scene's video generation call. Wired through localStorage so
    // the editor picks them up on mount — same pattern as Assets → Editor.
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
      "pm-storyboard-import",
      JSON.stringify({
        projectId,
        scenes: approved,
        importedAt: new Date().toISOString(),
      }),
    );
    window.location.href = "/dashboard/video/new";
  }, [scenes, projectId]);

  return (
    <div className="min-h-screen bg-void px-6 py-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <header className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Sparkles size={24} className="text-royal" strokeWidth={1.5} />
            <h1 className="text-2xl font-bold text-cloud">Storyboard</h1>
          </div>
          <p className="text-sm text-ash max-w-2xl">
            Cheap-keyframe approval gate. Generate scene thumbnails before
            burning Seedance video credits. Approved keyframes become the first
            frame of the downstream video generation. Send the strip to a
            client for sign-off, then ship.
          </p>
        </header>

        {/* Controls */}
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-smoke bg-graphite/40 p-4">
          <label className="flex items-center gap-2 text-sm text-ash">
            <span>Model:</span>
            <select
              value={model}
              onChange={(e) =>
                setModel(e.target.value as "nano-banana-pro" | "gpt-image-2")
              }
              disabled={isGenerating}
              className="
                rounded-md bg-slate border border-smoke
                px-2 py-1 text-sm text-cloud
                focus:outline-none focus:border-royal
                disabled:opacity-50 cursor-pointer
              "
            >
              <option value="nano-banana-pro">Nano Banana Pro</option>
              <option value="gpt-image-2">GPT Image 2</option>
            </select>
          </label>

          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="
              flex items-center gap-2 rounded-lg bg-royal px-4 py-2
              text-sm font-medium text-white
              hover:bg-royal/90 disabled:opacity-60 disabled:cursor-not-allowed
              transition-colors duration-[var(--transition-micro)]
              cursor-pointer
            "
          >
            {isGenerating ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} strokeWidth={2} />
            )}
            {scenes.length > 0 ? "Regenerate all" : "Generate sample storyboard"}
          </button>

          {scenes.length > 0 && (
            <span className="text-xs text-ash">
              {scenes.filter((s) => s.status === "ready" || s.status === "approved").length}
              {" / "}
              {scenes.length} ready
            </span>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-300">
            <AlertCircle size={14} strokeWidth={1.5} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Strip */}
        <StoryboardStrip
          scenes={scenes}
          videoProjectId={projectId}
          onApprove={handleApprove}
          onUnapprove={handleUnapprove}
          onRegenerate={handleRegenerate}
          onAllApproved={handleAllApproved}
          isGenerating={isGenerating}
        />

        {/* Empty state guidance */}
        {scenes.length === 0 && !isGenerating && (
          <div className="mt-8 rounded-xl border border-smoke/50 bg-graphite/20 p-6 text-sm text-ash">
            <p className="mb-3 text-cloud font-medium">
              How this fits into the production SOP
            </p>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>
                <strong className="text-cloud">Workspace</strong> — brief the
                strategist on what you want to make
              </li>
              <li>
                <strong className="text-royal">Storyboard</strong> ← you are here
                — generate cheap keyframes, approve or regenerate
              </li>
              <li>
                <strong className="text-cloud">Video Editor</strong> — approved
                keyframes feed Seedance i2v generation
              </li>
              <li>
                <strong className="text-cloud">Assets</strong> — reference
                library managed alongside scenes
              </li>
              <li>
                <strong className="text-cloud">Calendar / Campaigns</strong> —
                schedule and publish
              </li>
              <li>
                <strong className="text-cloud">Analytics</strong> — measure
                what worked
              </li>
            </ol>
            <p className="mt-4 flex items-center gap-1 text-xs text-ash">
              Click <strong className="text-cloud mx-1">Generate sample storyboard</strong>
              to see the flow with demo scenes
              <ArrowRight size={12} strokeWidth={1.5} />
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
