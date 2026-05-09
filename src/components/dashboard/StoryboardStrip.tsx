"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Check,
  RefreshCw,
  Loader2,
  AlertCircle,
  Image as ImageIcon,
  ArrowRight,
  Sparkles,
  Trash2,
  Plus,
  MessageSquare,
  Send,
  Pencil,
} from "lucide-react";

// WHY: Storyboard sits between scene-write and video-generate. User reviews cheap
// keyframes (~$0.04/each) before committing to expensive video calls (~$1/scene).
// Approved frames become firstFrameUrl on the downstream video.
//
// Layout draws from the @aimikoda 12-panel sheet pattern: a grid of cells the user
// can review *together*, with editable prompts, per-panel comment threads, an
// add-scene affordance, and a color-key legend that mirrors the annotation system
// the underlying prompt template uses (red=body, blue=camera, green=framing,
// orange=lighting, purple=vocal/emotion).

export type SceneComment = {
  id: string;
  text: string;
  role: "user" | "ai";
  createdAt: string;
};

// WHY: Structured annotation channels for per-panel direction. Mirrors the
// @aimikoda color system: each channel is an axis the model is asked to honor
// separately so the still-image / downstream-video gen doesn't blur them.
// IPA + FACS only meaningfully affect singing/face shots — they're optional
// and pass through to the video model verbatim when present.
export type SceneAnnotations = {
  body?: string;     // physical movement / choreography
  camera?: string;   // camera motion / lens
  framing?: string;  // composition notes
  lighting?: string; // light direction / quality
  vocal?: string;    // emotional / vocal register
  ipa?: string;      // International Phonetic Alphabet for sung lyrics
  facs?: string;     // Facial Action Coding System units (e.g. AU1+AU4 tension)
};

export type StoryboardScene = {
  sceneIndex: number;
  prompt: string;
  status: "pending" | "generating" | "ready" | "approved" | "failed";
  imageUrl: string | null;
  error?: string;
  aspectRatio?: "16:9" | "9:16" | "1:1";
  comments?: SceneComment[];
  annotations?: SceneAnnotations;
};

type StoryboardStripProps = {
  scenes: StoryboardScene[];
  videoProjectId: string;
  onApprove: (sceneIndex: number) => void;
  onUnapprove: (sceneIndex: number) => void;
  onRegenerate: (sceneIndex: number) => void;
  onRemove: (sceneIndex: number) => void;
  onAllApproved: () => void;
  // WHY: Optional handlers — when omitted, the matching UI affordance is hidden so
  // the component stays compatible with older parents that haven't wired comments
  // or scene insertion yet.
  onAddScene?: () => void;
  onGenerateAll?: () => void;
  // WHY: @aimikoda-style single-call sheet generation. One gpt-image-2 call
  // draws all panels in one composite image — cheap initial pass, then iterate
  // weak panels with per-panel Redo.
  onGenerateSheet?: () => void;
  onPromptChange?: (sceneIndex: number, prompt: string) => void;
  onAddComment?: (sceneIndex: number, text: string) => void;
  onAnnotationsChange?: (
    sceneIndex: number,
    annotations: SceneAnnotations,
  ) => void;
  // WHY: Disabled while parent is firing the API call so the user can't double-tap
  isGenerating?: boolean;
  className?: string;
};

const ASPECT_CLASS: Record<string, string> = {
  "16:9": "aspect-video",
  "9:16": "aspect-[9/16]",
  "1:1": "aspect-square",
};

// WHY: The annotation channels mirror the @aimikoda color system the storyboard
// prompt template encodes. Surfacing them in the UI legend reminds the reviewer
// what each axis of feedback is for, and keeps the visual grammar consistent
// with what the model is being asked to draw.
const ANNOTATION_KEY: Array<{ color: string; label: string }> = [
  { color: "bg-red-500", label: "body" },
  { color: "bg-blue-500", label: "camera" },
  { color: "bg-green-500", label: "framing" },
  { color: "bg-orange-500", label: "lighting" },
  { color: "bg-purple-500", label: "vocal / emotion" },
];

export function StoryboardStrip({
  scenes,
  videoProjectId,
  onApprove,
  onUnapprove,
  onRegenerate,
  onRemove,
  onAllApproved,
  onAddScene,
  onGenerateAll,
  onGenerateSheet,
  onPromptChange,
  onAddComment,
  onAnnotationsChange,
  isGenerating = false,
  className = "",
}: StoryboardStripProps) {
  const approvedCount = scenes.filter((s) => s.status === "approved").length;
  const allApproved = approvedCount === scenes.length && scenes.length > 0;
  const anyReady = scenes.some(
    (s) => s.status === "ready" || s.status === "approved",
  );
  // WHY: "Generate all" only meaningful when at least one panel needs work —
  // pending/failed/no-image. Hide the button otherwise.
  const pendingCount = scenes.filter(
    (s) =>
      s.status === "pending" ||
      s.status === "failed" ||
      (s.status !== "generating" && !s.imageUrl),
  ).length;

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
      <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-royal" strokeWidth={1.5} />
          <h3 className="text-sm font-semibold text-cloud">Storyboard</h3>
          <span className="text-xs text-ash">
            {approvedCount} / {scenes.length} approved
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onGenerateSheet && scenes.length >= 2 && (
            <button
              onClick={onGenerateSheet}
              disabled={isGenerating}
              className="
                flex items-center gap-2 rounded-lg border border-smoke
                bg-graphite/40 px-3 py-1.5 text-xs font-medium text-cloud
                hover:border-royal/50 hover:bg-graphite
                disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer
                transition-colors duration-[var(--transition-micro)]
              "
              aria-label="Generate one composite sheet image of all panels"
              title="One gpt-image-2 call for the whole sheet — @aimikoda-style"
            >
              <Sparkles size={12} strokeWidth={1.5} />
              Generate sheet
            </button>
          )}

          {onGenerateAll && pendingCount > 0 && (
            <button
              onClick={onGenerateAll}
              disabled={isGenerating}
              className="
                flex items-center gap-2 rounded-lg border border-smoke
                bg-graphite/40 px-3 py-1.5 text-xs font-medium text-cloud
                hover:border-royal/50 hover:bg-graphite
                disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer
                transition-colors duration-[var(--transition-micro)]
              "
              aria-label="Generate all pending panels (one call per panel)"
              title="N gpt-image-2 calls — one per panel, full resolution each"
            >
              <Sparkles size={12} strokeWidth={1.5} />
              Generate all ({pendingCount})
            </button>
          )}

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
      </div>

      {/* Annotation key legend */}
      <div className="mb-4 flex items-center gap-3 flex-wrap text-[10px] text-ash">
        <span className="uppercase tracking-wide font-medium text-ash/80">
          annotation key
        </span>
        {ANNOTATION_KEY.map((k) => (
          <span key={k.label} className="flex items-center gap-1.5">
            <span className={`inline-block h-2 w-2 rounded-full ${k.color}`} />
            <span>{k.label}</span>
          </span>
        ))}
      </div>

      {/* Sheet grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {scenes.map((scene) => (
          <SceneFrame
            key={scene.sceneIndex}
            scene={scene}
            onApprove={() => onApprove(scene.sceneIndex)}
            onUnapprove={() => onUnapprove(scene.sceneIndex)}
            onRegenerate={() => onRegenerate(scene.sceneIndex)}
            onRemove={() => onRemove(scene.sceneIndex)}
            onPromptChange={
              onPromptChange
                ? (next) => onPromptChange(scene.sceneIndex, next)
                : undefined
            }
            onAddComment={
              onAddComment
                ? (text) => onAddComment(scene.sceneIndex, text)
                : undefined
            }
            onAnnotationsChange={
              onAnnotationsChange
                ? (next) => onAnnotationsChange(scene.sceneIndex, next)
                : undefined
            }
            disabled={isGenerating}
          />
        ))}

        {/* Add-scene tile (only when handler provided) */}
        {onAddScene && (
          <button
            onClick={onAddScene}
            disabled={isGenerating}
            className="
              group flex flex-col items-center justify-center gap-2
              rounded-lg border-2 border-dashed border-smoke
              bg-void/40 hover:bg-graphite/60 hover:border-royal/50
              text-ash hover:text-royal
              transition-colors duration-[var(--transition-micro)]
              disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer
              min-h-[260px]
            "
            aria-label="Add scene"
          >
            <Plus size={24} strokeWidth={1.5} />
            <span className="text-xs font-medium">Add scene</span>
          </button>
        )}
      </div>

      {/* Empty state — when no scenes and no add handler */}
      {scenes.length === 0 && !onAddScene && (
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
  onPromptChange,
  onAddComment,
  onAnnotationsChange,
  disabled,
}: {
  scene: StoryboardScene;
  onApprove: () => void;
  onUnapprove: () => void;
  onRegenerate: () => void;
  onRemove: () => void;
  onPromptChange?: (next: string) => void;
  onAddComment?: (text: string) => void;
  onAnnotationsChange?: (next: SceneAnnotations) => void;
  disabled: boolean;
}) {
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState(scene.prompt);
  const [showComments, setShowComments] = useState(false);
  const [showDirector, setShowDirector] = useState(false);
  const [draftComment, setDraftComment] = useState("");
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const annotations = scene.annotations ?? {};
  const annotationCount = (
    [
      "body",
      "camera",
      "framing",
      "lighting",
      "vocal",
      "ipa",
      "facs",
    ] as const
  ).filter((k) => annotations[k] && annotations[k]!.trim().length > 0).length;

  const aspectClass = ASPECT_CLASS[scene.aspectRatio ?? "16:9"];
  const isApproved = scene.status === "approved";
  const isGenerating = scene.status === "generating";
  const isFailed = scene.status === "failed";
  const isReady = scene.status === "ready" || scene.status === "approved";
  const comments = scene.comments ?? [];

  // WHY: Sync local draft when the parent updates the prompt (e.g. on regen) so
  // we don't show stale text after an external edit.
  useEffect(() => {
    if (!isEditingPrompt) setDraftPrompt(scene.prompt);
  }, [scene.prompt, isEditingPrompt]);

  useEffect(() => {
    if (isEditingPrompt && promptRef.current) {
      promptRef.current.focus();
      promptRef.current.select();
    }
  }, [isEditingPrompt]);

  const commitPrompt = useCallback(() => {
    setIsEditingPrompt(false);
    const next = draftPrompt.trim();
    if (!next || next === scene.prompt) return;
    onPromptChange?.(next);
  }, [draftPrompt, scene.prompt, onPromptChange]);

  const submitComment = useCallback(() => {
    const text = draftComment.trim();
    if (!text) return;
    onAddComment?.(text);
    setDraftComment("");
  }, [draftComment, onAddComment]);

  return (
    <div
      className={`
        relative flex flex-col overflow-hidden rounded-lg
        border-2 transition-colors duration-[var(--transition-micro)]
        ${isApproved ? "border-royal" : "border-smoke"}
      `}
      data-scene-index={scene.sceneIndex}
      data-status={scene.status}
    >
      {/* Image / Placeholder */}
      <div
        className={`relative ${aspectClass} bg-void overflow-hidden border-b border-smoke`}
      >
        {isReady && scene.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={scene.imageUrl}
            alt={`Scene ${scene.sceneIndex + 1} keyframe`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : isGenerating ? (
          <div className="flex h-full w-full items-center justify-center bg-graphite/40">
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
          <div className="flex h-full w-full items-center justify-center bg-graphite/30">
            <ImageIcon size={20} className="text-ash" strokeWidth={1.5} />
          </div>
        )}

        {/* Scene number badge */}
        <div className="absolute top-1.5 left-1.5 rounded-md bg-void/80 px-1.5 py-0.5 text-[10px] font-mono font-medium text-cloud backdrop-blur-sm">
          panel {scene.sceneIndex + 1}
        </div>

        {/* Approved checkmark overlay */}
        {isApproved && (
          <div className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-royal text-white">
            <Check size={12} strokeWidth={2.5} />
          </div>
        )}

        {/* Comment count badge */}
        {comments.length > 0 && (
          <button
            onClick={() => setShowComments((v) => !v)}
            className="
              absolute bottom-1.5 right-1.5
              flex items-center gap-1 rounded-full bg-void/80 backdrop-blur-sm
              px-2 py-0.5 text-[10px] text-cloud
              hover:bg-graphite cursor-pointer
              transition-colors duration-[var(--transition-micro)]
            "
            aria-label={`${comments.length} comments`}
          >
            <MessageSquare size={10} strokeWidth={1.5} />
            {comments.length}
          </button>
        )}
      </div>

      {/* Editable prompt */}
      <div className="px-2 py-2 border-b border-smoke">
        {isEditingPrompt ? (
          <textarea
            ref={promptRef}
            value={draftPrompt}
            onChange={(e) => setDraftPrompt(e.target.value)}
            onBlur={commitPrompt}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setDraftPrompt(scene.prompt);
                setIsEditingPrompt(false);
              }
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                commitPrompt();
              }
            }}
            rows={3}
            className="
              w-full resize-none bg-void/50 border border-smoke rounded
              px-2 py-1 text-[11px] leading-snug text-cloud
              focus:outline-none focus:border-royal
            "
          />
        ) : (
          <button
            onClick={() => onPromptChange && setIsEditingPrompt(true)}
            disabled={!onPromptChange}
            className="
              group flex items-start gap-1.5 w-full text-left
              text-[11px] leading-snug text-ash hover:text-cloud
              transition-colors duration-[var(--transition-micro)]
              disabled:cursor-default disabled:hover:text-ash
            "
            aria-label="Edit scene prompt"
          >
            <span className="flex-1 line-clamp-3">{scene.prompt}</span>
            {onPromptChange && (
              <Pencil
                size={10}
                strokeWidth={1.5}
                className="mt-0.5 shrink-0 opacity-0 group-hover:opacity-60"
              />
            )}
          </button>
        )}
      </div>

      {/* Comments thread (collapsible) */}
      {onAddComment && (
        <div className="border-b border-smoke">
          <button
            onClick={() => setShowComments((v) => !v)}
            className="
              flex w-full items-center justify-between px-2 py-1.5
              text-[10px] text-ash hover:text-cloud
              transition-colors duration-[var(--transition-micro)]
              cursor-pointer
            "
            aria-label={showComments ? "Hide comments" : "Show comments"}
          >
            <span className="flex items-center gap-1.5">
              <MessageSquare size={10} strokeWidth={1.5} />
              Notes {comments.length > 0 && `(${comments.length})`}
            </span>
            <span className="text-ash/60">{showComments ? "−" : "+"}</span>
          </button>

          {showComments && (
            <div className="px-2 pb-2 space-y-1.5">
              {comments.length === 0 && (
                <p className="text-[10px] text-ash/60 italic">
                  No notes yet. Critique this panel below.
                </p>
              )}
              {comments.map((c) => (
                <div
                  key={c.id}
                  className={`
                    rounded px-2 py-1 text-[10px] leading-snug
                    ${
                      c.role === "ai"
                        ? "bg-royal/10 text-cloud border-l-2 border-royal"
                        : "bg-void/60 text-cloud"
                    }
                  `}
                >
                  {c.text}
                </div>
              ))}

              <div className="flex items-stretch gap-1 pt-1">
                <input
                  type="text"
                  value={draftComment}
                  onChange={(e) => setDraftComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitComment();
                  }}
                  placeholder="Add a note…"
                  className="
                    flex-1 min-w-0 bg-void/50 border border-smoke rounded
                    px-2 py-1 text-[10px] text-cloud
                    placeholder:text-ash/50
                    focus:outline-none focus:border-royal
                  "
                />
                <button
                  onClick={submitComment}
                  disabled={!draftComment.trim()}
                  className="
                    flex items-center justify-center rounded
                    bg-royal/80 text-white px-2
                    text-[10px]
                    hover:bg-royal disabled:opacity-40 disabled:cursor-not-allowed
                    cursor-pointer
                    transition-colors duration-[var(--transition-micro)]
                  "
                  aria-label="Post note"
                >
                  <Send size={10} strokeWidth={2} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Director notes (annotation channels) — drives prompt structure */}
      {onAnnotationsChange && (
        <div className="border-b border-smoke">
          <button
            onClick={() => setShowDirector((v) => !v)}
            className="
              flex w-full items-center justify-between px-2 py-1.5
              text-[10px] text-ash hover:text-cloud
              transition-colors duration-[var(--transition-micro)]
              cursor-pointer
            "
            aria-label={showDirector ? "Hide director notes" : "Show director notes"}
          >
            <span className="flex items-center gap-1.5">
              <Pencil size={10} strokeWidth={1.5} />
              Director notes {annotationCount > 0 && `(${annotationCount})`}
            </span>
            <span className="text-ash/60">{showDirector ? "−" : "+"}</span>
          </button>

          {showDirector && (
            <div className="px-2 pb-2 space-y-1.5">
              {(
                [
                  ["body", "Body / movement"],
                  ["camera", "Camera"],
                  ["framing", "Framing"],
                  ["lighting", "Lighting"],
                  ["vocal", "Vocal / emotion"],
                  ["facs", "FACS (e.g. AU1+AU4 tension)"],
                  ["ipa", "Lyrics IPA (passes to video)"],
                ] as Array<[keyof SceneAnnotations, string]>
              ).map(([key, label]) => (
                <input
                  key={key}
                  type="text"
                  value={annotations[key] ?? ""}
                  onChange={(e) =>
                    onAnnotationsChange({
                      ...annotations,
                      [key]: e.target.value,
                    })
                  }
                  placeholder={label}
                  className="
                    w-full bg-void/50 border border-smoke rounded
                    px-2 py-1 text-[10px] text-cloud placeholder:text-ash/50
                    focus:outline-none focus:border-royal
                  "
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action row */}
      <div className="flex">
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
    annotations?: SceneAnnotations;
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

/* ─── Helper: single-call composite sheet ─────────────────────────────── */

export type StoryboardSheetRequest = {
  videoProjectId?: string;
  scenes: Array<{
    sceneIndex: number;
    prompt: string;
    annotations?: SceneAnnotations;
  }>;
  aspectRatio?: "16:9" | "9:16" | "1:1";
  style?: "rough-pencil" | "photoreal";
  globalContext?: string;
};

export type StoryboardSheetResponse = {
  model: string;
  panelCount: number;
  aspectRatio: "16:9" | "9:16" | "1:1";
  style: "rough-pencil" | "photoreal";
  videoProjectId: string | null;
  imageUrl: string;
};

export async function generateStoryboardSheet(
  req: StoryboardSheetRequest,
): Promise<StoryboardSheetResponse> {
  const res = await fetch("/api/generate/storyboard-sheet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `Sheet request failed (${res.status})`);
  }

  return res.json();
}
