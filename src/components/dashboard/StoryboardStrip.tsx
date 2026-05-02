"use client";

import { useState, useCallback } from "react";
import {
  Check,
  RefreshCw,
  Loader2,
  AlertCircle,
  Image as ImageIcon,
  ArrowRight,
  Sparkles,
  Trash2,
} from "lucide-react";

// WHY: Storyboard strip sits between scene-write and video-generate. User reviews
// cheap keyframes (~$0.04 each) before committing to expensive Seedance i2v calls
// (~$1/scene). Approved keyframes become firstFrameUrl on the downstream video.
//
// This is the "client approval" surface for the agency play — send a brand a
// 6-frame storyboard for sign-off, then generate. Industry-standard flow.

export type StoryboardScene = {
  sceneIndex: number;
  prompt: string;
  status: "pending" | "generating" | "ready" | "approved" | "failed";
  imageUrl: string | null;
  error?: string;
  aspectRatio?: "16:9" | "9:16" | "1:1";
};

type StoryboardStripProps = {
  scenes: StoryboardScene[];
  videoProjectId: string;
  onApprove: (sceneIndex: number) => void;
  onUnapprove: (sceneIndex: number) => void;
  onRegenerate: (sceneIndex: number) => void;
  onRemove: (sceneIndex: number) => void;
  onAllApproved: () => void;
  // WHY: Disabled while parent is firing the API call so the user can't double-tap
  isGenerating?: boolean;
  className?: string;
};

const ASPECT_CLASS: Record<string, string> = {
  "16:9": "aspect-video",
  "9:16": "aspect-[9/16]",
  "1:1": "aspect-square",
};

export function StoryboardStrip({
  scenes,
  videoProjectId,
  onApprove,
  onUnapprove,
  onRegenerate,
  onRemove,
  onAllApproved,
  isGenerating = false,
  className = "",
}: StoryboardStripProps) {
  const approvedCount = scenes.filter((s) => s.status === "approved").length;
  const allApproved = approvedCount === scenes.length && scenes.length > 0;
  const anyReady = scenes.some(
    (s) => s.status === "ready" || s.status === "approved",
  );

  return (
    <div
      className={`
        rounded-xl border border-smoke bg-graphite/60 p-4
        ${className}
      `}
      data-testid="storyboard-strip"
      data-video-project-id={videoProjectId}
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-royal" strokeWidth={1.5} />
          <h3 className="text-sm font-semibold text-cloud">
            Storyboard
          </h3>
          <span className="text-xs text-ash">
            {approvedCount} / {scenes.length} approved
          </span>
        </div>

        {anyReady && (
          <button
            onClick={onAllApproved}
            disabled={!allApproved || isGenerating}
            className={`
              flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium
              transition-colors duration-[var(--transition-micro)]
              ${
                allApproved && !isGenerating
                  ? "bg-royal text-white hover:bg-royal/90 cursor-pointer"
                  : "bg-slate text-ash cursor-not-allowed opacity-60"
              }
            `}
            aria-label="Generate videos from approved storyboard"
          >
            {isGenerating ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <ArrowRight size={12} strokeWidth={2} />
            )}
            Generate videos
          </button>
        )}
      </div>

      {/* Strip */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {scenes.map((scene) => (
          <SceneFrame
            key={scene.sceneIndex}
            scene={scene}
            onApprove={() => onApprove(scene.sceneIndex)}
            onUnapprove={() => onUnapprove(scene.sceneIndex)}
            onRegenerate={() => onRegenerate(scene.sceneIndex)}
            onRemove={() => onRemove(scene.sceneIndex)}
            disabled={isGenerating}
          />
        ))}
      </div>

      {/* Empty state */}
      {scenes.length === 0 && (
        <div className="flex h-32 items-center justify-center text-xs text-ash">
          <ImageIcon size={14} className="mr-2" strokeWidth={1.5} />
          No scenes yet. Describe what you want to make in chat.
        </div>
      )}
    </div>
  );
}

/* ─── Scene frame card ────────────────────────────────────────────────── */

function SceneFrame({
  scene,
  onApprove,
  onUnapprove,
  onRegenerate,
  onRemove,
  disabled,
}: {
  scene: StoryboardScene;
  onApprove: () => void;
  onUnapprove: () => void;
  onRegenerate: () => void;
  onRemove: () => void;
  disabled: boolean;
}) {
  const [showFullPrompt, setShowFullPrompt] = useState(false);
  const aspectClass = ASPECT_CLASS[scene.aspectRatio ?? "16:9"];
  const isApproved = scene.status === "approved";
  const isGenerating = scene.status === "generating";
  const isFailed = scene.status === "failed";
  const isReady = scene.status === "ready" || scene.status === "approved";

  return (
    <div
      className={`
        relative shrink-0 w-44 overflow-hidden rounded-lg
        border-2 transition-colors duration-[var(--transition-micro)]
        ${isApproved ? "border-royal" : "border-smoke"}
      `}
      data-scene-index={scene.sceneIndex}
      data-status={scene.status}
    >
      {/* Image / Placeholder */}
      <div className={`relative ${aspectClass} bg-void overflow-hidden`}>
        {isReady && scene.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={scene.imageUrl}
            alt={`Scene ${scene.sceneIndex + 1} keyframe`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : isGenerating ? (
          <div className="flex h-full w-full items-center justify-center">
            <Loader2
              size={20}
              className="animate-spin text-royal"
              strokeWidth={1.5}
            />
          </div>
        ) : isFailed ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-2 text-center">
            <AlertCircle size={16} className="text-red-400" strokeWidth={1.5} />
            <span className="text-[10px] text-red-400">
              {scene.error ?? "Failed"}
            </span>
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon size={20} className="text-ash" strokeWidth={1.5} />
          </div>
        )}

        {/* Scene number badge */}
        <div className="absolute top-1.5 left-1.5 rounded-md bg-void/80 px-1.5 py-0.5 text-[10px] font-medium text-cloud backdrop-blur-sm">
          {scene.sceneIndex + 1}
        </div>

        {/* Approved checkmark overlay */}
        {isApproved && (
          <div className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-royal text-white">
            <Check size={12} strokeWidth={2.5} />
          </div>
        )}
      </div>

      {/* Prompt preview */}
      <button
        onClick={() => setShowFullPrompt((v) => !v)}
        className="
          block w-full px-2 py-1.5 text-left
          text-[10px] text-ash hover:text-cloud
          transition-colors duration-[var(--transition-micro)]
        "
        aria-label={showFullPrompt ? "Collapse prompt" : "Expand prompt"}
      >
        <span className={showFullPrompt ? "" : "line-clamp-2"}>
          {scene.prompt}
        </span>
      </button>

      {/* Action row */}
      <div className="flex border-t border-smoke">
        <button
          onClick={onRegenerate}
          disabled={disabled || isGenerating}
          className="
            flex flex-1 items-center justify-center gap-1 py-1.5
            text-[10px] font-medium text-ash
            hover:text-cloud hover:bg-slate disabled:opacity-50
            transition-colors duration-[var(--transition-micro)]
            cursor-pointer disabled:cursor-not-allowed
          "
          aria-label={`Regenerate scene ${scene.sceneIndex + 1}`}
        >
          <RefreshCw size={10} strokeWidth={1.5} />
          Redo
        </button>

        <div className="w-px bg-smoke" />

        <button
          onClick={onRemove}
          disabled={disabled}
          className="
            flex flex-1 items-center justify-center gap-1 py-1.5
            text-[10px] font-medium text-ash
            hover:text-red-400 hover:bg-red-500/10 disabled:opacity-50
            transition-colors duration-[var(--transition-micro)]
            cursor-pointer disabled:cursor-not-allowed
          "
          aria-label={`Remove scene ${scene.sceneIndex + 1}`}
        >
          <Trash2 size={10} strokeWidth={1.5} />
          Remove
        </button>

        <div className="w-px bg-smoke" />

        <button
          onClick={isApproved ? onUnapprove : onApprove}
          disabled={disabled || !isReady}
          className={`
            flex flex-1 items-center justify-center gap-1 py-1.5
            text-[10px] font-medium
            transition-colors duration-[var(--transition-micro)]
            disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer
            ${
              isApproved
                ? "text-royal hover:bg-royal/10"
                : "text-ash hover:text-cloud hover:bg-slate"
            }
          `}
          aria-label={
            isApproved
              ? `Unapprove scene ${scene.sceneIndex + 1}`
              : `Approve scene ${scene.sceneIndex + 1}`
          }
        >
          <Check size={10} strokeWidth={2} />
          {isApproved ? "Approved" : "Approve"}
        </button>
      </div>
    </div>
  );
}

/* ─── Helper: fetch storyboard from API ───────────────────────────────── */

export type StoryboardRequest = {
  videoProjectId: string;
  scenes: Array<{
    sceneIndex: number;
    prompt: string;
    aspectRatio?: "16:9" | "9:16" | "1:1";
    referenceImages?: string[];
  }>;
  model?: "nano-banana-pro-preview" | "nano-banana-pro" | "gpt-image-2";
};

export type StoryboardResponse = {
  videoProjectId: string | null;
  model: string;
  modelRequested: string;
  sceneCount: number;
  readyCount: number;
  processingCount: number;
  failedCount: number;
  scenes: Array<{
    sceneIndex: number;
    status: "processing" | "ready" | "failed";
    imageUrl: string | null;
    generationId: string | null;
    streamUrl: string | null;
    error?: string;
  }>;
};

export async function generateStoryboard(
  req: StoryboardRequest,
): Promise<StoryboardResponse> {
  const res = await fetch("/api/generate/storyboard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `Storyboard request failed (${res.status})`);
  }

  return res.json();
}
