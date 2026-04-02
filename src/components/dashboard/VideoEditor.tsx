"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  RefreshCw,
  Undo2,
  Scissors,
  Plus,
  Play,
  Film,
  Loader2,
  ChevronDown,
  ArrowRight,
  X,
  Music,
  Upload,
  Wand2,
  ImageIcon,
  Camera,
  Clock,
  Trash2,
  GripVertical,
  Sparkles,
  ChevronRight,
  FolderOpen,
  Download,
} from "lucide-react";
import type {
  VideoScene,
  VideoProject,
  VideoSceneMode,
  ReferenceImage,
} from "@/types/canvas";

/* ─── Props ─────────────────────────────────────────────────────────── */

type VideoEditorProps = {
  project: VideoProject;
  onUpdateProject: (project: VideoProject) => void;
  onClose?: () => void;
  initialDrawerOpen?: boolean;
};

/* ─── Constants ─────────────────────────────────────────────────────── */

const MODE_OPTIONS: { value: VideoSceneMode; label: string; icon: typeof Film }[] = [
  { value: "t2v", label: "Text → Video", icon: Film },
  { value: "i2v", label: "Image → Video", icon: Camera },
  { value: "character", label: "Character", icon: Sparkles },
  { value: "extend", label: "Extend", icon: ChevronRight },
];

const DURATION_OPTIONS = [5, 10, 15] as const;

/* ─── Scene Card ────────────────────────────────────────────────────── */

function SceneCard({
  scene,
  index,
  selected,
  onSelect,
  onRegenerate,
  onRevert,
  onTrimChange,
  onUpdate,
  onDelete,
  onSourceImageUpload,
  projectRefs,
}: {
  scene: VideoScene;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onRegenerate: () => void;
  onRevert: (versionIndex: number) => void;
  onTrimChange: (trimStart: number, trimEnd: number) => void;
  onUpdate: (updates: Partial<VideoScene>) => void;
  onDelete: () => void;
  onSourceImageUpload: () => void;
  projectRefs: ReferenceImage[];
}) {
  const [showTrim, setShowTrim] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [editPrompt, setEditPrompt] = useState(scene.prompt);
  const isLoading = scene.status === "generating" || scene.status === "regenerating";

  const currentMode = MODE_OPTIONS.find((m) => m.value === scene.mode) ?? MODE_OPTIONS[0];

  return (
    <div
      className={`
        group relative flex w-[280px] max-w-[320px] shrink-0 flex-col
        rounded-2xl border p-4 transition-all duration-200
        ${
          selected
            ? "border-royal/60 bg-royal/[0.04] shadow-[0_0_24px_-6px_rgba(99,102,241,0.15)]"
            : "border-smoke/60 bg-graphite hover:border-smoke hover:shadow-lg hover:shadow-void/40"
        }
      `}
      onClick={onSelect}
    >
      {/* Top row: scene number + mode + duration + delete */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GripVertical
            size={14}
            className="text-ash/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab"
          />
          <span className="text-[10px] font-mono uppercase tracking-wider text-ash">
            Scene {index + 1}
          </span>
          <Badge
            variant={scene.status === "ready" ? "mint" : "amber"}
            className="text-[9px]"
          >
            {scene.status}
          </Badge>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="flex h-6 w-6 items-center justify-center rounded-md text-ash/0 group-hover:text-ash hover:text-coral hover:bg-coral/10 transition-all cursor-pointer"
          title="Remove scene"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Mode + Duration selectors */}
      <div className="mb-3 flex items-center gap-2">
        {/* Mode selector */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowModeMenu(!showModeMenu);
            }}
            className="flex h-7 items-center gap-1.5 rounded-lg bg-slate/80 px-2.5 text-[11px] text-ash hover:text-cloud hover:bg-smoke transition-colors cursor-pointer"
          >
            <currentMode.icon size={11} />
            <span>{currentMode.label}</span>
            <ChevronDown size={9} />
          </button>

          {showModeMenu && (
            <div className="absolute top-full left-0 z-20 mt-1 w-40 rounded-xl border border-smoke bg-graphite py-1 shadow-xl shadow-void/60">
              {MODE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdate({ mode: opt.value });
                    setShowModeMenu(false);
                  }}
                  className={`
                    flex w-full items-center gap-2 px-3 py-1.5
                    text-[11px] transition-colors cursor-pointer
                    ${opt.value === scene.mode ? "text-royal bg-royal/10" : "text-ash hover:text-cloud hover:bg-slate"}
                  `}
                >
                  <opt.icon size={12} />
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Duration selector */}
        <div className="flex items-center gap-1 rounded-lg bg-slate/80 px-1">
          <Clock size={11} className="text-ash ml-1.5" />
          {DURATION_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={(e) => {
                e.stopPropagation();
                onUpdate({ duration: d, trimEnd: d });
              }}
              className={`
                h-7 w-8 rounded-md text-[11px] font-mono transition-colors cursor-pointer
                ${scene.duration === d ? "bg-royal/20 text-royal" : "text-ash hover:text-cloud"}
              `}
            >
              {d}s
            </button>
          ))}
        </div>
      </div>

      {/* Preview card */}
      <div className="relative h-44 w-full overflow-hidden rounded-xl border border-smoke/40 bg-void/60">
        {isLoading ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2">
            <Loader2
              size={28}
              strokeWidth={1.5}
              className="animate-spin text-royal"
            />
            <span className="text-xs text-ash">
              {scene.status === "regenerating"
                ? "Regenerating..."
                : "Generating..."}
            </span>
          </div>
        ) : scene.thumbnailUrl || scene.videoUrl ? (
          <div className="relative h-full w-full">
            {scene.videoUrl ? (
              <video
                ref={(el) => {
                  if (!el) return;
                  // Seek to trimStart so preview shows the trim point
                  if (el.readyState >= 1 && Math.abs(el.currentTime - scene.trimStart) > 0.2 && el.paused) {
                    el.currentTime = scene.trimStart;
                  }
                  el.onloadedmetadata = () => { el.currentTime = scene.trimStart; };
                  const overlay = el.nextElementSibling as HTMLElement;
                  const show = () => { if (overlay) overlay.style.display = ""; el.controls = false; };
                  el.onpause = show;
                  el.onended = () => { el.currentTime = scene.trimStart; show(); };
                  // Stop playback at trimEnd
                  el.ontimeupdate = () => {
                    if (el.currentTime >= scene.trimEnd) {
                      el.pause();
                      el.currentTime = scene.trimStart;
                    }
                  };
                }}
                src={scene.videoUrl}
                className="h-full w-full object-cover"
                muted
                playsInline
                preload="auto"
              />
            ) : (
              <img
                src={scene.thumbnailUrl}
                alt={`Scene ${index + 1}`}
                className="h-full w-full object-cover"
              />
            )}
            {/* Click-to-play overlay — no native controls until playing */}
            {scene.videoUrl && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const btn = e.currentTarget as HTMLElement;
                  const video = btn.previousElementSibling as HTMLVideoElement;
                  if (video) {
                    video.controls = true;
                    btn.style.display = "none";
                    video.play().catch(() => { btn.style.display = ""; video.controls = false; });
                  }
                }}
                className="absolute inset-0 flex items-center justify-center bg-void/30 transition-opacity cursor-pointer hover:bg-void/20"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-royal/90 shadow-lg shadow-royal/30 transition-transform hover:scale-110">
                  <Play size={18} strokeWidth={2} className="text-white ml-0.5" />
                </div>
              </button>
            )}
          </div>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2">
            <Film size={32} strokeWidth={1} className="text-ash/20" />
            <span className="text-[11px] text-ash/40">No preview yet</span>
          </div>
        )}

        {/* Duration badge */}
        <div className="absolute bottom-2 right-2">
          <Badge
            variant="default"
            className="bg-void/80 text-[10px] font-mono text-cloud backdrop-blur-md border border-white/10"
          >
            {(scene.trimEnd - scene.trimStart).toFixed(1)}s
          </Badge>
        </div>

        {/* Source image indicator (i2v mode) */}
        {scene.mode === "i2v" && (
          <div className="absolute top-2 left-2">
            {scene.sourceImageUrl ? (
              <div className="relative h-10 w-10 rounded-lg overflow-hidden border border-royal/40 shadow-sm">
                <img
                  src={scene.sourceImageUrl}
                  alt="Starting frame"
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSourceImageUpload();
                }}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-royal/40 bg-void/60 backdrop-blur-sm text-royal/60 hover:text-royal hover:border-royal transition-colors cursor-pointer"
                title="Upload starting frame"
              >
                <Camera size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Prompt (editable) */}
      {isEditingPrompt ? (
        <textarea
          value={editPrompt}
          onChange={(e) => setEditPrompt(e.target.value)}
          onBlur={() => {
            onUpdate({ prompt: editPrompt });
            setIsEditingPrompt(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onUpdate({ prompt: editPrompt });
              setIsEditingPrompt(false);
            }
          }}
          rows={2}
          className="mt-3 w-full resize-none rounded-lg border border-royal/30 bg-void/60 px-2.5 py-1.5 text-xs text-cloud placeholder:text-ash/50 focus:border-royal focus:outline-none"
          autoFocus
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <p
          className="mt-3 w-full text-xs text-ash leading-relaxed line-clamp-2 cursor-text hover:text-cloud transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            setEditPrompt(scene.prompt);
            setIsEditingPrompt(true);
          }}
        >
          {scene.prompt || "Click to add a description..."}
        </p>
      )}

      {/* Reference image tags — click name to insert into prompt */}
      {scene.referenceImageIds.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {scene.referenceImageIds.map((refId) => {
            const ref = projectRefs.find((r) => r.id === refId);
            const refIndex = projectRefs.findIndex((r) => r.id === refId);
            return ref ? (
              <button
                key={refId}
                onClick={(e) => {
                  e.stopPropagation();
                  if (ref.label) {
                    // Insert ref name into prompt
                    onUpdate({ prompt: (scene.prompt ? scene.prompt + " " : "") + ref.label });
                  }
                }}
                className="inline-flex items-center gap-1 rounded-md bg-royal/15 px-1.5 py-0.5 text-[9px] font-medium text-royal hover:bg-royal/25 transition-colors cursor-pointer"
                title={ref.label ? `Click to insert "${ref.label}" into prompt` : `@image${refIndex + 1}`}
              >
                {ref.label || `@image${refIndex + 1}`}
              </button>
            ) : null;
          })}
          <span className="text-[8px] text-ash/40 self-center ml-1">tap to insert</span>
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-3 flex items-center gap-1.5">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRegenerate();
          }}
          disabled={isLoading}
          className="
            flex h-7 items-center gap-1 rounded-lg bg-slate/80 px-2.5
            text-[11px] text-ash hover:text-cloud hover:bg-smoke
            transition-colors duration-150 cursor-pointer
            disabled:opacity-40 disabled:cursor-not-allowed
          "
          title="Regenerate scene"
        >
          <RefreshCw size={11} strokeWidth={1.5} />
          <span>Redo</span>
        </button>

        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowVersions(!showVersions);
            }}
            disabled={scene.versions.length < 2}
            className="
              flex h-7 items-center gap-1 rounded-lg bg-slate/80 px-2.5
              text-[11px] text-ash hover:text-cloud hover:bg-smoke
              transition-colors duration-150 cursor-pointer
              disabled:opacity-40 disabled:cursor-not-allowed
            "
            title="Revert to previous version"
          >
            <Undo2 size={11} strokeWidth={1.5} />
            <span>Revert</span>
            <ChevronDown size={9} />
          </button>

          {showVersions && scene.versions.length >= 2 && (
            <div className="absolute top-full left-0 z-20 mt-1 w-48 rounded-xl border border-smoke bg-graphite py-1 shadow-xl shadow-void/60">
              {scene.versions.map((v, vi) => (
                <button
                  key={vi}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRevert(vi);
                    setShowVersions(false);
                  }}
                  className="
                    flex w-full items-center gap-2 px-3 py-1.5
                    text-xs text-ash hover:text-cloud hover:bg-slate
                    transition-colors cursor-pointer
                  "
                >
                  <span className="font-mono text-[11px]">v{vi + 1}</span>
                  <span className="text-ash/50 text-[10px]">
                    {new Date(v.createdAt).toLocaleTimeString()}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowTrim(!showTrim);
          }}
          className={`
            flex h-7 items-center gap-1 rounded-lg px-2.5
            text-[11px] transition-colors duration-150 cursor-pointer
            ${showTrim ? "bg-royal/20 text-royal" : "bg-slate/80 text-ash hover:text-cloud hover:bg-smoke"}
          `}
          title="Trim scene"
        >
          <Scissors size={11} strokeWidth={1.5} />
          <span>Trim</span>
        </button>
      </div>

      {/* Trim controls */}
      {showTrim && (
        <div className="mt-3 w-full rounded-xl border border-smoke/60 bg-void/40 p-3">
          <div className="flex items-center justify-between text-[10px] text-ash mb-2">
            <span>
              In: <span className="font-mono text-cloud">{scene.trimStart.toFixed(1)}s</span>
            </span>
            <span>
              Out: <span className="font-mono text-cloud">{scene.trimEnd.toFixed(1)}s</span>
            </span>
          </div>
          <p className="text-[10px] text-ash/50 mb-2">
            Duration: {(scene.trimEnd - scene.trimStart).toFixed(1)}s of {scene.duration}s
          </p>
          <div className="flex flex-col gap-2">
            <label className="text-[9px] text-ash/60 uppercase tracking-wider">Start</label>
            <input
              type="range"
              min={0}
              max={scene.duration}
              step={0.1}
              value={scene.trimStart}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                onTrimChange(val, scene.trimEnd);
                // Seek video preview to the new trim start
                const video = (e.target as HTMLElement).closest('.group')?.querySelector('video') as HTMLVideoElement;
                if (video) video.currentTime = val;
              }}
              className="h-1 w-full accent-royal"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            />
            <label className="text-[9px] text-ash/60 uppercase tracking-wider">End</label>
            <input
              type="range"
              min={0}
              max={scene.duration}
              step={0.1}
              value={scene.trimEnd}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                onTrimChange(scene.trimStart, val);
                // Seek video preview to near the trim end
                const video = (e.target as HTMLElement).closest('.group')?.querySelector('video') as HTMLVideoElement;
                if (video) video.currentTime = Math.max(val - 0.5, scene.trimStart);
              }}
              className="h-1 w-full accent-royal"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Add-Scene Connector ───────────────────────────────────────────── */

function SceneConnector({ onInsert }: { onInsert: () => void }) {
  return (
    <div className="flex h-44 shrink-0 items-center">
      <div className="relative flex items-center">
        <div className="h-px w-4 bg-smoke/60" />
        <button
          onClick={onInsert}
          className="
            flex h-7 w-7 items-center justify-center rounded-full
            border border-smoke/60 bg-graphite text-ash/60
            hover:border-royal/40 hover:text-royal hover:bg-royal/5
            transition-all duration-200 cursor-pointer
          "
          title="Insert scene here"
        >
          <Plus size={12} />
        </button>
        <div className="h-px w-4 bg-smoke/60" />
      </div>
    </div>
  );
}

/* ─── Asset Drawer (inline) ────────────────────────────────────────── */

type AssetFromAPI = {
  id: string;
  type: string;
  status: string;
  url: string;
  prompt: string;
  createdAt: string;
};

function AssetDrawer({
  open,
  onClose,
  onImport,
}: {
  open: boolean;
  onClose: () => void;
  onImport: (asset: AssetFromAPI) => void;
}) {
  const [assets, setAssets] = useState<AssetFromAPI[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/user/assets?limit=50")
      .then((r) => r.json())
      .then((data) => {
        const visual = (data.assets ?? []).filter(
          (a: AssetFromAPI) => a.type === "image" || a.type === "video"
        );
        setAssets(visual);
      })
      .catch(() => setAssets([]))
      .finally(() => setLoading(false));
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-void/40 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={`
          fixed top-0 right-0 z-50 flex h-full w-80 flex-col
          border-l border-smoke bg-graphite
          transition-transform duration-300 ease-in-out
          ${open ? "translate-x-0" : "translate-x-full"}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-smoke/60 px-4 py-3">
          <div className="flex items-center gap-2">
            <FolderOpen size={16} className="text-royal" />
            <h3 className="text-sm font-semibold text-cloud">Your Assets</h3>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-ash hover:text-cloud hover:bg-slate/50 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-2 pt-20 text-ash">
              <Loader2 size={24} className="animate-spin text-royal" />
              <span className="text-xs">Loading assets...</span>
            </div>
          ) : assets.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 pt-20 text-ash">
              <FolderOpen size={32} strokeWidth={1} className="text-ash/40" />
              <span className="text-xs">No image or video assets found</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {assets.map((asset) => (
                <div
                  key={asset.id}
                  className="group/asset flex flex-col overflow-hidden rounded-xl border border-smoke/60 bg-slate/30 transition-all hover:border-royal/40 hover:shadow-lg hover:shadow-void/30"
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video w-full overflow-hidden bg-void/40">
                    {asset.type === "video" ? (
                      <video
                        src={asset.url}
                        muted
                        className="h-full w-full object-cover"
                        onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
                        onMouseLeave={(e) => {
                          const v = e.target as HTMLVideoElement;
                          v.pause();
                          v.currentTime = 0;
                        }}
                      />
                    ) : (
                      <img
                        src={asset.url}
                        alt={asset.prompt}
                        className="h-full w-full object-cover"
                      />
                    )}
                    <Badge
                      variant="default"
                      className="absolute top-1.5 left-1.5 text-[9px] px-1.5 py-0.5 bg-void/70 backdrop-blur-sm text-cloud border-0"
                    >
                      {asset.type === "video" ? "Video" : "Image"}
                    </Badge>
                  </div>

                  {/* Info */}
                  <div className="flex flex-1 flex-col gap-2 p-2.5">
                    <p className="line-clamp-2 text-[10px] leading-tight text-ash">
                      {asset.prompt || "Untitled asset"}
                    </p>
                    <button
                      onClick={() => onImport(asset)}
                      className="
                        mt-auto flex items-center justify-center gap-1 rounded-lg
                        bg-royal/10 px-2 py-1.5 text-[10px] font-semibold text-royal
                        hover:bg-royal hover:text-white transition-all duration-200 cursor-pointer
                      "
                    >
                      <Plus size={12} />
                      Import
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ─── Main Editor ───────────────────────────────────────────────────── */

export function VideoEditor({
  project,
  onUpdateProject,
  onClose,
  initialDrawerOpen,
}: VideoEditorProps) {
  const [newPrompt, setNewPrompt] = useState("");
  const [showAddScene, setShowAddScene] = useState(false);
  const [insertIndex, setInsertIndex] = useState<number | null>(null);
  const [stitching, setStitching] = useState(false);
  const [stitchedUrl, setStitchedUrl] = useState<string | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [showRefSection, setShowRefSection] = useState(true);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const sourceImageInputRef = useRef<HTMLInputElement>(null);
  const refImageInputRef = useRef<HTMLInputElement>(null);
  const [pendingSourceSceneId, setPendingSourceSceneId] = useState<string | null>(null);
  const [showAssetDrawer, setShowAssetDrawer] = useState(initialDrawerOpen ?? false);
  const [deletedScene, setDeletedScene] = useState<{scene: VideoScene; index: number} | null>(null);
  const [includeAudio, setIncludeAudio] = useState(true);

  /* ─ Helpers ─ */

  const updateScene = useCallback(
    (sceneId: string, updates: Partial<VideoScene>) => {
      onUpdateProject({
        ...project,
        scenes: project.scenes.map((s) =>
          s.id === sceneId ? { ...s, ...updates } : s
        ),
      });
    },
    [project, onUpdateProject]
  );

  function updateProject(updates: Partial<VideoProject>) {
    onUpdateProject({ ...project, ...updates });
  }

  /* ─ Scene API calls ─ */

  async function callGenerateVideo(
    scene: VideoScene,
    refs: ReferenceImage[]
  ): Promise<{
    videoUrl?: string;
    thumbnailUrl?: string;
    duration?: number;
  }> {
    // Auto-replace reference names in prompt with @imageN tags
    // e.g., "Jerry walks in" → "@image1 walks in" if ref labeled "Jerry" is tagged
    let processedPrompt = scene.prompt;
    const taggedRefs = scene.referenceImageIds
      .map((id) => refs.find((r) => r.id === id))
      .filter(Boolean) as ReferenceImage[];

    taggedRefs.forEach((ref, i) => {
      if (ref.label && ref.label.trim()) {
        // Replace the label name with @imageN (case-insensitive, whole word)
        const escaped = ref.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
        processedPrompt = processedPrompt.replace(regex, `@image${i + 1}`);
      }
    });

    const body: Record<string, unknown> = {
      prompt: processedPrompt,
      mode: scene.mode,
      duration: scene.duration,
    };

    body.includeAudio = includeAudio;

    if (scene.sourceImageUrl) {
      body.sourceImage = scene.sourceImageUrl;
    }

    // Extend mode: pass the current video as sourceVideo
    if (scene.mode === "extend" && scene.videoUrl) {
      body.sourceVideo = scene.videoUrl;
    }

    if (taggedRefs.length > 0) {
      body.referenceImages = taggedRefs.map((r) => ({ url: r.url, label: r.label }));
    }

    const res = await fetch("/api/generate/video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error("Generation failed");
    const data = await res.json();

    // If we got a generationId (202 async), poll/stream for completion
    const generationId = data.generationId;
    if (generationId && !data.videoUrl) {
      return new Promise((resolve) => {
        const { streamGeneration } = require("@/lib/api");
        const cancel = streamGeneration(generationId, {
          onCompleted: (event: { data: { resultUrl?: string; score?: number } }) => {
            const videoUrl = event.data.resultUrl;
            resolve({
              videoUrl: videoUrl ? `/api/proxy/image?url=${encodeURIComponent(videoUrl)}` : undefined,
              duration: scene.duration,
            });
          },
          onFailed: () => {
            resolve({ duration: scene.duration });
          },
          onError: () => {
            resolve({ duration: scene.duration });
          },
        });

        // Safety timeout: 10 minutes
        setTimeout(() => {
          cancel();
          resolve({ duration: scene.duration });
        }, 10 * 60 * 1000);
      });
    }

    return {
      videoUrl: data.videoUrl || data.resultUrl,
      thumbnailUrl: data.thumbnailUrl,
      duration: data.duration ?? scene.duration,
    };
  }

  async function handleRegenerate(scene: VideoScene) {
    const currentVersion = scene.videoUrl
      ? { url: scene.videoUrl, createdAt: new Date().toISOString() }
      : null;

    updateScene(scene.id, {
      status: "regenerating",
      versions: currentVersion
        ? [...scene.versions, currentVersion]
        : scene.versions,
    });

    try {
      const data = await callGenerateVideo(scene, project.referenceImages);
      updateScene(scene.id, {
        status: "ready",
        videoUrl: data.videoUrl,
        thumbnailUrl: data.thumbnailUrl,
        duration: data.duration ?? scene.duration,
        trimEnd: data.duration ?? scene.trimEnd,
      });
    } catch {
      updateScene(scene.id, { status: "ready" });
    }
  }

  function handleRevert(scene: VideoScene, versionIndex: number) {
    const version = scene.versions[versionIndex];
    if (!version) return;
    updateScene(scene.id, { videoUrl: version.url, thumbnailUrl: undefined });
  }

  function handleTrimChange(
    sceneId: string,
    trimStart: number,
    trimEnd: number
  ) {
    if (trimStart >= trimEnd) return;
    updateScene(sceneId, { trimStart, trimEnd });
  }

  function handleDeleteScene(sceneId: string) {
    const idx = project.scenes.findIndex((s) => s.id === sceneId);
    const scene = project.scenes[idx];
    if (scene) setDeletedScene({ scene, index: idx });
    updateProject({
      scenes: project.scenes.filter((s) => s.id !== sceneId),
    });
  }

  function handleUndoDelete() {
    if (!deletedScene) return;
    const scenes = [...project.scenes];
    scenes.splice(deletedScene.index, 0, deletedScene.scene);
    updateProject({ scenes });
    setDeletedScene(null);
  }

  // Auto-clear undo state after 5 seconds
  useEffect(() => {
    if (!deletedScene) return;
    const timer = setTimeout(() => setDeletedScene(null), 5000);
    return () => clearTimeout(timer);
  }, [deletedScene]);

  // Keyboard shortcut: Delete/Backspace removes selected scene
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Delete" || e.key === "Backspace") {
        // Don't intercept when typing in an input/textarea
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        if (selectedSceneId) {
          e.preventDefault();
          handleDeleteScene(selectedSceneId);
          setSelectedSceneId(null);
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  async function handleAddScene(atIndex?: number) {
    if (!newPrompt.trim()) return;

    const newScene: VideoScene = {
      id: crypto.randomUUID(),
      prompt: newPrompt.trim(),
      duration: 5,
      trimStart: 0,
      trimEnd: 5,
      status: "generating",
      mode: "t2v",
      referenceImageIds: [],
      versions: [],
    };

    const scenes = [...project.scenes];
    if (atIndex !== undefined && atIndex !== null) {
      scenes.splice(atIndex, 0, newScene);
    } else {
      scenes.push(newScene);
    }

    updateProject({ scenes });
    setNewPrompt("");
    setShowAddScene(false);
    setInsertIndex(null);

    try {
      const data = await callGenerateVideo(newScene, project.referenceImages);
      updateScene(newScene.id, {
        status: "ready",
        videoUrl: data.videoUrl,
        thumbnailUrl: data.thumbnailUrl,
        duration: data.duration ?? 5,
        trimEnd: data.duration ?? 5,
      });
    } catch {
      updateScene(newScene.id, { status: "ready" });
    }
  }

  async function handleStitch() {
    setStitching(true);
    try {
      const res = await fetch("/api/video/stitch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          audioUrl: project.audioUrl,
          scenes: project.scenes
            .filter((s) => s.videoUrl && s.status === "ready")
            .map((s) => ({
              videoUrl: s.videoUrl,
              trimStart: s.trimStart,
              trimEnd: s.trimEnd,
            })),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const url = data.videoUrl || data.directUrl;
        if (url) setStitchedUrl(url);
      }
    } catch {
      // Stitch failed
    } finally {
      setStitching(false);
    }
  }

  /* ─ Audio handlers ─ */

  function handleUploadAudio() {
    audioInputRef.current?.click();
  }

  function handleAudioFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    updateProject({ audioUrl: url });
    // In production: upload to storage, get permanent URL
  }

  function handleRemoveAudio() {
    updateProject({ audioUrl: undefined });
  }

  async function handleGenerateMusic() {
    // Placeholder: call music generation API
    try {
      const res = await fetch("/api/generate/music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          scenes: project.scenes.map((s) => s.prompt),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.audioUrl) updateProject({ audioUrl: data.audioUrl });
      }
    } catch {
      // Would show toast
    }
  }

  /* ─ Source image handler ─ */

  function handleSourceImageUpload(sceneId: string) {
    setPendingSourceSceneId(sceneId);
    sourceImageInputRef.current?.click();
  }

  function handleSourceImageFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !pendingSourceSceneId) return;
    const url = URL.createObjectURL(file);
    updateScene(pendingSourceSceneId, { sourceImageUrl: url });
    setPendingSourceSceneId(null);
  }

  /* ─ Reference image handlers ─ */

  function handleAddRefImage() {
    refImageInputRef.current?.click();
  }

  function handleRefImageFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const newRef: ReferenceImage = {
      id: crypto.randomUUID(),
      url,
      label: "",
    };
    updateProject({
      referenceImages: [...(project.referenceImages ?? []), newRef],
    });
  }

  function handleRemoveRefImage(refId: string) {
    updateProject({
      referenceImages: (project.referenceImages ?? []).filter(
        (r) => r.id !== refId
      ),
      scenes: project.scenes.map((s) => ({
        ...s,
        referenceImageIds: s.referenceImageIds.filter((id) => id !== refId),
      })),
    });
  }

  function handleUpdateRefLabel(refId: string, label: string) {
    updateProject({
      referenceImages: (project.referenceImages ?? []).map((r) =>
        r.id === refId ? { ...r, label } : r
      ),
    });
  }

  /* ─ Derived ─ */

  const totalDuration = project.scenes.reduce(
    (sum, s) => sum + (s.trimEnd - s.trimStart),
    0
  );
  const readyScenes = project.scenes.filter(
    (s) => s.status === "ready" && s.videoUrl
  );
  const refs = project.referenceImages ?? [];

  /* ─ Render ─ */

  return (
    <div className="flex flex-col rounded-2xl border border-smoke/60 bg-graphite shadow-xl shadow-void/30">
      {/* Hidden file inputs */}
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={handleAudioFileChange}
      />
      <input
        ref={sourceImageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleSourceImageFileChange}
      />
      <input
        ref={refImageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleRefImageFileChange}
      />

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-smoke/60 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-royal/10">
            <Film size={18} strokeWidth={1.5} className="text-royal" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-cloud">
              {project.title}
            </h3>
            <p className="text-[11px] text-ash">
              {project.scenes.length} scene{project.scenes.length !== 1 && "s"}{" "}
              &middot;{" "}
              <span className="font-mono">{totalDuration.toFixed(1)}s</span>{" "}
              total
              {refs.length > 0 && (
                <>
                  {" "}
                  &middot; {refs.length} ref{refs.length !== 1 && "s"}
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            loading={stitching}
            disabled={readyScenes.length < 1}
            onClick={handleStitch}
            icon={<Play size={12} strokeWidth={1.5} />}
          >
            Stitch &amp; Export
          </Button>
          {onClose && (
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-ash hover:text-cloud hover:bg-slate transition-colors cursor-pointer"
            >
              <X size={16} strokeWidth={1.5} />
            </button>
          )}
        </div>
      </div>

      {/* ── Timeline ───────────────────────────────────────────── */}
      <div className="flex items-start gap-0 overflow-x-auto px-5 py-5 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-smoke/40">
        {project.scenes.length === 0 ? (
          /* Empty state */
          <div className="flex w-full flex-col items-center justify-center py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-royal/5 mb-4">
              <Film size={28} strokeWidth={1} className="text-royal/40" />
            </div>
            <h4 className="text-sm font-medium text-cloud mb-1">
              No scenes yet
            </h4>
            <p className="text-xs text-ash mb-4 text-center max-w-xs">
              Add your first scene to start building your video. Describe what
              you want to see and the AI will generate it.
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowAddScene(true)}
              icon={<Plus size={12} />}
            >
              Add First Scene
            </Button>
          </div>
        ) : (
          <>
            {project.scenes.map((scene, i) => (
              <div key={scene.id} className="flex items-start">
                <SceneCard
                  scene={scene}
                  index={i}
                  selected={selectedSceneId === scene.id}
                  onSelect={() => setSelectedSceneId(scene.id)}
                  onRegenerate={() => handleRegenerate(scene)}
                  onRevert={(vi) => handleRevert(scene, vi)}
                  onTrimChange={(start, end) =>
                    handleTrimChange(scene.id, start, end)
                  }
                  onUpdate={(updates) => updateScene(scene.id, updates)}
                  onDelete={() => handleDeleteScene(scene.id)}
                  onSourceImageUpload={() =>
                    handleSourceImageUpload(scene.id)
                  }
                  projectRefs={refs}
                />

                {/* Connector with insert button between scenes */}
                {i < project.scenes.length - 1 && (
                  <SceneConnector
                    onInsert={() => {
                      setInsertIndex(i + 1);
                      setShowAddScene(true);
                    }}
                  />
                )}
              </div>
            ))}

            {/* Add scene at end */}
            <div className="flex items-start pl-3">
              {showAddScene ? (
                <div className="flex w-72 shrink-0 flex-col gap-3 rounded-2xl border border-royal/30 bg-royal/[0.03] p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles size={14} className="text-royal" />
                    <span className="text-xs font-medium text-cloud">
                      New Scene
                    </span>
                    {insertIndex !== null && (
                      <Badge variant="royal" className="text-[9px]">
                        Insert at position {insertIndex + 1}
                      </Badge>
                    )}
                  </div>
                  <textarea
                    value={newPrompt}
                    onChange={(e) => setNewPrompt(e.target.value)}
                    placeholder="Describe what happens in this scene..."
                    rows={3}
                    className="
                      w-full resize-none rounded-xl border border-smoke/60 bg-void/60 px-3 py-2.5
                      text-sm text-cloud placeholder:text-ash/40
                      focus:border-royal focus:outline-none transition-colors
                    "
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() =>
                        handleAddScene(insertIndex ?? undefined)
                      }
                      disabled={!newPrompt.trim()}
                    >
                      Generate
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowAddScene(false);
                        setNewPrompt("");
                        setInsertIndex(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setInsertIndex(null);
                      setShowAddScene(true);
                    }}
                    className="
                      flex h-44 w-24 shrink-0 flex-col items-center justify-center
                      rounded-2xl border border-dashed border-smoke/60
                      text-ash/40 hover:text-royal hover:border-royal/40 hover:bg-royal/[0.02]
                      transition-all duration-200 cursor-pointer
                    "
                  >
                    <Plus size={22} strokeWidth={1.5} />
                    <span className="mt-1.5 text-[10px] font-medium">
                      Add Scene
                    </span>
                  </button>
                  <button
                    onClick={() => setShowAssetDrawer(true)}
                    className="
                      flex h-44 w-24 shrink-0 flex-col items-center justify-center
                      rounded-2xl border border-dashed border-smoke/60
                      text-ash/40 hover:text-royal hover:border-royal/40 hover:bg-royal/[0.02]
                      transition-all duration-200 cursor-pointer
                    "
                  >
                    <FolderOpen size={22} strokeWidth={1.5} />
                    <span className="mt-1.5 text-[10px] font-medium text-center leading-tight">
                      Browse Assets
                    </span>
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Audio Track ────────────────────────────────────────── */}
      <div className="border-t border-smoke/60 px-5 py-4">
        <div className="flex items-center gap-2 mb-3">
          <Music size={16} className="text-royal" />
          <h4 className="text-xs font-semibold text-cloud">Audio Track</h4>
        </div>

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-ash">Native Audio</span>
          </div>
          <button
            onClick={() => setIncludeAudio(!includeAudio)}
            className={`relative h-5 w-9 rounded-full transition-colors ${includeAudio ? 'bg-royal' : 'bg-smoke'}`}
          >
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${includeAudio ? 'left-[18px]' : 'left-0.5'}`} />
          </button>
        </div>
        <p className="text-[10px] text-ash/60 mt-1 mb-3">Video generation will {includeAudio ? 'include' : 'exclude'} ambient sound</p>

        {project.audioUrl ? (
          <div className="flex items-center gap-3 rounded-xl bg-slate/40 px-3 py-2.5 border border-smoke/40">
            <audio
              controls
              src={project.audioUrl}
              className="h-8 flex-1 [&::-webkit-media-controls-panel]:bg-transparent"
            />
            <button
              onClick={handleRemoveAudio}
              className="flex h-6 w-6 items-center justify-center rounded-md text-ash hover:text-coral hover:bg-coral/10 transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleGenerateMusic}
              className="flex items-center gap-1.5 rounded-xl bg-royal/10 px-3.5 py-2.5 text-xs font-medium text-royal hover:bg-royal/20 transition-colors cursor-pointer"
            >
              <Wand2 size={12} /> Generate Music
            </button>
            <button
              onClick={handleUploadAudio}
              className="flex items-center gap-1.5 rounded-xl bg-slate/80 px-3.5 py-2.5 text-xs text-ash hover:text-cloud hover:bg-smoke transition-colors cursor-pointer"
            >
              <Upload size={12} /> Upload Audio
            </button>
          </div>
        )}
      </div>

      {/* ── Reference Images ───────────────────────────────────── */}
      <div className="border-t border-smoke/60 px-5 py-4">
        <button
          onClick={() => setShowRefSection(!showRefSection)}
          className="flex items-center gap-2 mb-3 cursor-pointer group"
        >
          <ImageIcon size={16} className="text-royal" />
          <h4 className="text-xs font-semibold text-cloud">
            Reference Images
          </h4>
          <span className="text-[10px] text-ash">
            @image tags for character/product consistency {selectedSceneId ? "· click to tag to selected scene" : "· select a scene first"}
          </span>
          <ChevronDown
            size={12}
            className={`text-ash ml-auto transition-transform ${showRefSection ? "rotate-0" : "-rotate-90"}`}
          />
        </button>

        {showRefSection && (
          <div className="flex gap-2.5 flex-wrap">
            {refs.map((img, i) => {
              const selectedScene = project.scenes.find((s) => s.id === selectedSceneId);
              const isTaggedToSelected = selectedScene?.referenceImageIds.includes(img.id) ?? false;
              return (
              <div
                key={img.id}
                onClick={() => {
                  if (!selectedSceneId) return;
                  const scene = project.scenes.find((s) => s.id === selectedSceneId);
                  if (!scene) return;
                  const has = scene.referenceImageIds.includes(img.id);
                  updateScene(selectedSceneId, {
                    referenceImageIds: has
                      ? scene.referenceImageIds.filter((id) => id !== img.id)
                      : [...scene.referenceImageIds, img.id],
                  });
                }}
                className={`relative w-20 h-20 rounded-xl overflow-hidden border group/ref transition-colors cursor-pointer ${
                  isTaggedToSelected
                    ? "border-royal ring-2 ring-royal/40"
                    : "border-smoke/60 hover:border-royal/40"
                }`}
              >
                <img
                  src={img.url}
                  alt={img.label || `Reference ${i + 1}`}
                  className="w-full h-full object-cover"
                />

                {/* Tag badge */}
                <div className="absolute top-1 left-1">
                  <Badge
                    variant="default"
                    className="text-[8px] bg-void/80 backdrop-blur-sm text-cloud border border-white/10 px-1 py-0"
                  >
                    @image{i + 1}
                  </Badge>
                </div>

                {/* Remove button */}
                <button
                  onClick={() => handleRemoveRefImage(img.id)}
                  className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-void/70 text-ash opacity-0 group-hover/ref:opacity-100 hover:text-coral transition-all cursor-pointer"
                >
                  <X size={8} />
                </button>

                {/* Label input */}
                <input
                  placeholder="Label..."
                  value={img.label}
                  onChange={(e) =>
                    handleUpdateRefLabel(img.id, e.target.value)
                  }
                  className="absolute bottom-0 w-full bg-void/80 backdrop-blur-sm text-[9px] text-center py-0.5 text-cloud placeholder:text-ash/50 border-0 outline-none"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            );})}

            {/* Add reference image button */}
            {refs.length < 9 && (
              <button
                onClick={handleAddRefImage}
                className="
                  w-20 h-20 rounded-xl border border-dashed border-smoke/60
                  flex flex-col items-center justify-center
                  text-ash/40 hover:text-royal hover:border-royal/40 hover:bg-royal/[0.02]
                  transition-all duration-200 cursor-pointer
                "
              >
                <Plus size={16} />
                <span className="text-[9px] mt-1 font-medium">Add Ref</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Asset Drawer ───────────────────────────────────────── */}
      <AssetDrawer
        open={showAssetDrawer}
        onClose={() => setShowAssetDrawer(false)}
        onImport={(asset: { id: string; type: string; url: string; prompt: string }) => {
          const newScene: VideoScene = {
            id: crypto.randomUUID(),
            prompt: asset.prompt || "Imported asset",
            duration: 5,
            trimStart: 0,
            trimEnd: 5,
            status: "ready",
            mode: asset.type === "video" ? "t2v" : "i2v",
            referenceImageIds: [],
            versions: [],
            ...(asset.type === "video"
              ? { videoUrl: asset.url }
              : { sourceImageUrl: asset.url }),
          };
          // Replace empty Scene 1 instead of appending after it
          const firstScene = project.scenes[0];
          const isFirstEmpty = firstScene && !firstScene.prompt && !firstScene.videoUrl && !firstScene.sourceImageUrl;
          if (isFirstEmpty && project.scenes.length === 1) {
            updateProject({ scenes: [newScene] });
          } else {
            updateProject({ scenes: [...project.scenes, newScene] });
          }
        }}
      />

      {/* ── Undo Delete Bar ────────────────────────────────────── */}
      {deletedScene && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg border border-smoke bg-graphite px-4 py-2.5 shadow-xl">
          <Undo2 size={14} strokeWidth={1.5} className="text-ash" />
          <span className="text-sm text-cloud">Scene deleted</span>
          <button
            onClick={handleUndoDelete}
            className="text-royal font-semibold cursor-pointer hover:text-royal/80 transition-colors text-sm"
          >
            Undo
          </button>
        </div>
      )}

      {/* ── Stitched Preview Modal ─────────────────────────────── */}
      {stitchedUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/80 backdrop-blur-sm">
          <div className="w-full max-w-3xl mx-4 rounded-2xl border border-smoke bg-graphite overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-smoke/60">
              <h3 className="text-sm font-semibold text-cloud">Preview — Stitched Export</h3>
              <div className="flex items-center gap-2">
                <a href={stitchedUrl} download className="flex items-center gap-1.5 rounded-lg bg-royal px-3 py-1.5 text-xs font-medium text-white hover:bg-royal/80 transition-colors">
                  <Download size={12} /> Download
                </a>
                <button onClick={() => window.open(stitchedUrl, "_blank")} className="flex items-center gap-1.5 rounded-lg bg-slate px-3 py-1.5 text-xs font-medium text-cloud hover:bg-smoke transition-colors cursor-pointer">
                  Open in Tab
                </button>
                <button onClick={() => setStitchedUrl(null)} className="flex h-7 w-7 items-center justify-center rounded-lg text-ash hover:text-cloud hover:bg-slate transition-colors cursor-pointer">
                  <X size={14} />
                </button>
              </div>
            </div>
            <div className="p-4">
              <video src={stitchedUrl} controls autoPlay className="w-full rounded-xl" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
