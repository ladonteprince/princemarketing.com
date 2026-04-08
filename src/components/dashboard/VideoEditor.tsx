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
  FolderOpen,
  Download,
  Mic,
  Ruler,
} from "lucide-react";
import type {
  VideoScene,
  VideoProject,
  VideoSceneMode,
  ReferenceImage,
} from "@/types/canvas";
import { TimelineView } from "./TimelineView";
import { KaraokeRecorder } from "./KaraokeRecorder";
import LockEndpointsPanel from "./LockEndpointsPanel";
import { streamGeneration } from "@/lib/api";

/* ─── Props ─────────────────────────────────────────────────────────── */

type VideoEditorProps = {
  project: VideoProject;
  onUpdateProject: (project: VideoProject | ((prev: VideoProject) => VideoProject)) => void;
  onClose?: () => void;
  initialDrawerOpen?: boolean;
  // WHY: External karaoke session control — when set, the VideoEditor opens
  // the KaraokeRecorder. Triggered by the OPEN_KARAOKE chat action.
  karaokeSession?: {
    videoProjectId: string;
    script: Array<{ startTime: number; endTime: number; text: string }>;
  } | null;
  onCloseKaraoke?: () => void;
};

/* ─── Constants ─────────────────────────────────────────────────────── */

/* MODE_OPTIONS removed — mode is now auto-detected from scene content */

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
  previousScene,
  userAssetsForLock,
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
  previousScene?: VideoScene;
  userAssetsForLock: Array<{ id: string; url: string; name: string; type: string }>;
}) {
  const [showTrim, setShowTrim] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [editPrompt, setEditPrompt] = useState(scene.prompt);
  const [showLockEndpoints, setShowLockEndpoints] = useState(false);
  const isLoading = scene.status === "generating" || scene.status === "regenerating";
  const isDraft = scene.status === "draft";
  const hasLockedEndpoints = !!(scene.firstFrameUrl && scene.lastFrameUrl);

  // Sync editPrompt when scene.prompt changes externally (e.g. ref tag insertion)
  useEffect(() => {
    if (!isEditingPrompt) {
      setEditPrompt(scene.prompt);
    }
  }, [scene.prompt, isEditingPrompt]);

  // Auto-detect mode label from scene content
  const autoModeLabel = scene.sourceImageUrl
    ? "Image → Video"
    : scene.referenceImageIds.length > 0
      ? "Character"
      : scene.videoUrl && scene.versions.length === 0
        ? "Imported"
        : "Text → Video";

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
            variant={scene.status === "ready" ? "mint" : scene.status === "draft" ? "default" : "amber"}
            className="text-[9px]"
          >
            {scene.status === "draft" ? "queued" : scene.status}
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

      {/* Mode badge + Duration selector */}
      <div className="mb-3 flex items-center gap-2">
        {/* Auto-detected mode badge (read-only) */}
        <Badge variant="default" className="text-[9px] bg-slate/60">
          {autoModeLabel}
        </Badge>

        {/* Duration selector */}
        <div className="flex items-center gap-1 rounded-lg bg-slate/80 px-1">
          <Clock size={11} className="text-ash ml-1.5" />
          {DURATION_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={(e) => {
                e.stopPropagation();
                onUpdate({ duration: d, trimStart: Math.min(scene.trimStart, d - 0.1), trimEnd: d });
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

      {/* Critic score */}
      {scene.score && (
        <div className="mt-2 flex items-center gap-1.5">
          <div className={`h-1.5 w-1.5 rounded-full ${scene.score >= 8 ? 'bg-emerald-400' : scene.score >= 6 ? 'bg-amber-400' : 'bg-red-400'}`} />
          <span className="text-[10px] text-ash">{scene.score.toFixed(1)}/10</span>
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-3 flex items-center gap-1.5 flex-wrap">
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
          <span>Regenerate</span>
        </button>

        {/* Lock Endpoints — opens the precision interpolation panel */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowLockEndpoints(true);
          }}
          className={`
            flex h-7 items-center gap-1 rounded-lg px-2.5 text-[11px]
            transition-colors duration-150 cursor-pointer
            ${hasLockedEndpoints
              ? "bg-royal/15 text-royal hover:bg-royal/25"
              : "bg-slate/80 text-ash hover:text-cloud hover:bg-smoke"
            }
          `}
          title={hasLockedEndpoints ? "Endpoints locked — click to edit" : "Lock first/last frame for precision control (+50% cost)"}
        >
          <span className="font-mono text-[10px]">[ ]</span>
          <span>{hasLockedEndpoints ? "Locked" : "Lock Endpoints"}</span>
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
              max={Math.max(0, scene.trimEnd - 0.1)}
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
              min={Math.min(scene.duration, scene.trimStart + 0.1)}
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

      {/* Lock Endpoints panel — opens when user clicks the Lock Endpoints button */}
      {showLockEndpoints && (
        <LockEndpointsPanel
          scene={scene}
          previousScene={previousScene}
          userAssets={userAssetsForLock}
          onUpdateScene={(updates) => {
            onUpdate(updates);
            setShowLockEndpoints(false);
          }}
          onClose={() => setShowLockEndpoints(false)}
        />
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
  project,
}: {
  open: boolean;
  onClose: () => void;
  onImport: (asset: AssetFromAPI) => void;
  project?: VideoProject;
}) {
  const [assets, setAssets] = useState<AssetFromAPI[]>([]);
  const [loading, setLoading] = useState(false);
  const [drawerFilter, setDrawerFilter] = useState<"all" | "image" | "video">("all");

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

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 px-4 pb-2 pt-2">
          {(["all", "image", "video"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setDrawerFilter(f)}
              className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors cursor-pointer ${
                drawerFilter === f ? "bg-royal/20 text-royal" : "text-ash hover:text-cloud"
              }`}
            >
              {f === "all" ? "All" : f === "image" ? "Images" : "Videos"}
            </button>
          ))}
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
              {(drawerFilter === "all" ? assets : assets.filter((a) => a.type === drawerFilter)).map((asset) => (
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
                    {project?.referenceImages?.some(
                      (r) => r.url === asset.url || r.url.includes(encodeURIComponent(asset.url))
                    ) ? (
                      <span className="mt-auto flex items-center justify-center gap-1 rounded-lg bg-emerald-500/10 px-2 py-1.5 text-[10px] font-semibold text-emerald-400">
                        ✓ Reference
                      </span>
                    ) : (
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
                    )}
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
  karaokeSession,
  onCloseKaraoke,
}: VideoEditorProps) {
  const [newPrompt, setNewPrompt] = useState("");
  const [showAddScene, setShowAddScene] = useState(false);
  const [insertIndex, setInsertIndex] = useState<number | null>(null);
  const [stitching, setStitching] = useState(false);
  const [stitchedUrl, setStitchedUrl] = useState<string | null>(null);
  // WHY: Audio re-mix state. After the initial stitch lands, the user can
  // iterate on ducking intensity without regenerating any clips. We track
  // which preset is currently applied so the button group shows an active
  // state, plus an in-flight indicator during the re-mix ffmpeg run.
  const [activeDuckingDb, setActiveDuckingDb] = useState<number>(-12);
  const [remixing, setRemixing] = useState<"subtle" | "standard" | "aggressive" | null>(null);
  // WHY: Final critic state. Fires Gemini 3.1 Pro against the stitched
  // MP4 and returns structured per-scene scores + fix suggestions. The
  // UI shows scores inline and exposes one-click regeneration for each
  // weak scene. A 6-minute-long run means we show a clear loading state.
  const [criticLoading, setCriticLoading] = useState(false);
  const [criticReview, setCriticReview] = useState<{
    scenes: Array<{
      sceneIndex: number;
      score: number;
      strengths: string;
      weaknesses: string;
      fixSuggestion?: string;
    }>;
    overallScore: number;
    overallVerdict: string;
  } | null>(null);
  const [showKaraoke, setShowKaraoke] = useState(false);
  const [generatingScore, setGeneratingScore] = useState(false);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const sourceImageInputRef = useRef<HTMLInputElement>(null);
  const refImageInputRef = useRef<HTMLInputElement>(null);
  const [pendingSourceSceneId, setPendingSourceSceneId] = useState<string | null>(null);
  const [showAssetDrawer, setShowAssetDrawer] = useState(initialDrawerOpen ?? false);
  const [deletedScene, setDeletedScene] = useState<{scene: VideoScene; index: number} | null>(null);
  const [includeAudio, setIncludeAudio] = useState(true);
  const [generatingMusic, setGeneratingMusic] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);

  /* ─ Helpers ─ */

  const updateScene = useCallback(
    (sceneId: string, updates: Partial<VideoScene>) => {
      onUpdateProject((prev: VideoProject) => ({
        ...prev,
        scenes: prev.scenes.map((s) =>
          s.id === sceneId ? { ...s, ...updates } : s
        ),
      }));
    },
    [onUpdateProject]
  );

  function updateProject(updates: Partial<VideoProject>) {
    onUpdateProject((prev: VideoProject) => ({ ...prev, ...updates }));
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

    taggedRefs.forEach((ref) => {
      if (ref.label && ref.label.trim()) {
        // Use global index matching the UI (characters 1-3, props 4-6, scenes 7-9)
        const globalIdx = refs.findIndex(r => r.id === ref.id) + 1;
        const escaped = ref.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
        processedPrompt = processedPrompt.replace(regex, `@image${globalIdx}`);
      }
    });

    // WHY: Inject dimension metadata from tagged references into the prompt.
    // This gives the AI proportional accuracy: "sneaker is 12 inches long,
    // model is 6'1" — so the sneaker should be about hand-length when held."
    const dimensionHints = taggedRefs
      .filter((ref) => ref.dimensions && (ref.dimensions.height || ref.dimensions.width || ref.dimensions.notes))
      .map((ref) => {
        const parts: string[] = [];
        if (ref.dimensions?.height) parts.push(`height: ${ref.dimensions.height}`);
        if (ref.dimensions?.width) parts.push(`width: ${ref.dimensions.width}`);
        if (ref.dimensions?.length) parts.push(`length: ${ref.dimensions.length}`);
        if (ref.dimensions?.notes) parts.push(ref.dimensions.notes);
        const globalIdx = refs.findIndex(r => r.id === ref.id) + 1;
        return `@image${globalIdx} (${ref.label || "ref"}): ${parts.join(", ")}`;
      });

    if (dimensionHints.length > 0) {
      processedPrompt += `. Scale reference: ${dimensionHints.join("; ")}. Maintain proportionally accurate sizing between all subjects.`;
    }

    // Auto-detect mode from scene content
    // WHY: interpolate takes priority — if both first and last frames are
    // locked, the user explicitly opted in for the precision two-keyframe path.
    let autoMode: VideoSceneMode = "t2v";
    if (scene.sourceImageUrl) autoMode = "i2v";
    if (scene.videoUrl && scene.mode === "extend") autoMode = "extend";
    if (taggedRefs.length > 0) autoMode = "character";
    if (scene.firstFrameUrl && scene.lastFrameUrl) autoMode = "interpolate";

    // WHY: Before sending to Seedance, enrich the prompt through the Gemini Director.
    // Gemini reads our cinematography + music/sound design frameworks and returns a
    // production-ready prompt with specific camera, lighting, composition, and sound
    // direction. This is invisible to the user — they see better video, not the framework.
    let finalPrompt = processedPrompt;
    try {
      const sceneCount = project.scenes.length;
      const sceneIdx = project.scenes.findIndex(s => s.id === scene.id);
      // Map scene position to Attention Architecture role
      const attentionRole = sceneIdx === 0
        ? "stimulation"
        : sceneIdx === sceneCount - 1
          ? "validation"
          : sceneIdx < sceneCount / 2
            ? "captivation"
            : "anticipation";

      // WHY: Score-first — if the project has a locked track with markers,
      // pass them to the Director along with this scene's start time so
      // Gemini can snap camera moves and cut points to real musical beats
      // instead of guessing with sceneIndex.
      const sceneStartTime = sceneIdx > 0
        ? project.scenes
            .slice(0, sceneIdx)
            .reduce((sum, s) => sum + s.duration, 0)
        : 0;

      const directRes = await fetch("/api/proxy/direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenePrompt: processedPrompt,
          attentionRole,
          emotion: "engagement",
          format: scene.duration <= 10 ? "short-form" : "commercial",
          sceneIndex: sceneIdx >= 0 ? sceneIdx : 0,
          totalScenes: sceneCount,
          duration: scene.duration,
          ...(project.scoreMarkers && project.scoreMarkers.length > 0
            ? { scoreMarkers: project.scoreMarkers, sceneStartTime }
            : {}),
        }),
      });

      if (directRes.ok) {
        const directData = await directRes.json();
        const enriched = directData?.data?.enrichedPrompt ?? directData?.enrichedPrompt;
        if (enriched && typeof enriched === "string") {
          finalPrompt = enriched;
        }
      }
    } catch {
      // Gemini Director unavailable — fall back to raw prompt (no degradation)
    }

    const body: Record<string, unknown> = {
      prompt: finalPrompt,
      mode: autoMode,
      duration: scene.duration,
    };

    body.includeAudio = includeAudio;

    if (scene.sourceImageUrl) {
      body.sourceImage = scene.sourceImageUrl;
    }

    // Extend mode: pass the current video as sourceVideo
    if (autoMode === "extend" && scene.videoUrl) {
      body.sourceVideo = scene.videoUrl;
    }

    if (taggedRefs.length > 0) {
      body.referenceImages = taggedRefs.map((r) => ({ url: r.url, label: r.label }));
    }

    // WHY: interpolate mode routes to a different endpoint that calls Seedance 2's
    // first-last-frame model. Different request shape: only firstFrameUrl + lastFrameUrl
    // + prompt + duration. No referenceImages, no sourceImage, no extend.
    const isInterpolate = autoMode === "interpolate" && scene.firstFrameUrl && scene.lastFrameUrl;
    const endpoint = isInterpolate ? "/api/generate/video/interpolate" : "/api/generate/video";
    const requestBody = isInterpolate
      ? {
          prompt: finalPrompt,
          firstFrameUrl: scene.firstFrameUrl,
          lastFrameUrl: scene.lastFrameUrl,
          duration: scene.duration,
          aspectRatio: "16:9",
          fast: true, // Default to fast variant for cost; user can override later
        }
      : body;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) throw new Error("Generation failed");
    const data = await res.json();

    // If we got a generationId (202 async), poll/stream for completion
    const generationId = data.generationId;
    if (generationId && !data.videoUrl) {
      return new Promise((resolve) => {
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
    onUpdateProject((prev: VideoProject) => {
      const scenes = [...prev.scenes];
      scenes.splice(deletedScene.index, 0, deletedScene.scene);
      return { ...prev, scenes };
    });
    setDeletedScene(null);
  }

  // Auto-select first scene when none is selected
  useEffect(() => {
    if (!selectedSceneId && project.scenes.length > 0) {
      setSelectedSceneId(project.scenes[0].id);
    }
  }, [project.scenes.length, selectedSceneId]);

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
        // Don't intercept when typing in an input/textarea/contentEditable
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
        if (selectedSceneId) {
          e.preventDefault();
          handleDeleteScene(selectedSceneId);
          setSelectedSceneId(null);
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedSceneId]);

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
          // WHY: Voiceover fork — whichever branch the user picked
          // (karaoke or AI voice) lands on project.voiceoverUrl. The
          // stitch pipeline sidechains music under it automatically.
          voiceoverUrl: project.voiceoverUrl,
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
        if (url) {
          setStitchedUrl(url);
          // WHY: Auto-trigger Sound Director → Lyria 3 pipeline as soon as
          // stitch completes, unless the project already has audio. The user
          // can override or regenerate via the Generate Score button.
          if (!project.audioUrl) {
            void autoGenerateScore(url);
          }
        }
      }
    } catch {
      // Stitch failed
    } finally {
      setStitching(false);
    }
  }

  // WHY: Runs Sound Director → Lyria 3 in the background after stitch.
  // Sets project.audioUrl when complete. Doesn't block the UI.
  async function autoGenerateScore(stitchedVideoUrl: string) {
    setGeneratingScore(true);
    try {
      let currentTime = 0;
      const sceneTiming = project.scenes
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

      const directRes = await fetch("/api/proxy/direct-sound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrl: stitchedVideoUrl,
          scenes: sceneTiming,
          totalDuration: currentTime,
          targetEmotion: "engagement",
        }),
      });
      if (!directRes.ok) return;
      const directData = await directRes.json();
      const lyriaPrompt = directData?.data?.lyriaPrompt ?? directData?.lyriaPrompt;
      if (!lyriaPrompt) return;

      // Call Lyria 3 instead of Suno — uses same Gemini API key, native timestamps
      const musicRes = await fetch("/api/generate/music/lyria", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: lyriaPrompt,
          duration: Math.ceil(currentTime),
          model: "pro",
        }),
      });
      if (!musicRes.ok) return;
      const musicData = await musicRes.json();
      const audioUrl = musicData?.data?.audioUrl ?? musicData?.audioUrl;
      if (audioUrl) {
        updateProject({ audioUrl });
      }
    } catch {
      // Score generation failed silently — user can retry via button
    } finally {
      setGeneratingScore(false);
    }
  }

  /* ─ Audio handlers ─ */

  function handleUploadAudio() {
    audioInputRef.current?.click();
  }

  async function handleAudioFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    // Set blob URL for immediate local preview
    const blobUrl = URL.createObjectURL(file);
    updateProject({ audioUrl: blobUrl });

    // Upload to .ai for permanent URL (needed by stitch backend)
    setUploadingAudio(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload/audio", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.audioUrl) {
          // Replace blob URL with permanent server URL
          URL.revokeObjectURL(blobUrl);
          updateProject({ audioUrl: data.audioUrl });
        }
      }
    } catch {
      // Blob URL still works for local preview; stitch will fail without server URL
    } finally {
      setUploadingAudio(false);
    }
  }

  function handleRemoveAudio() {
    updateProject({ audioUrl: undefined });
  }

  async function handleGenerateMusic() {
    setGeneratingMusic(true);
    try {
      // Build a music prompt from scene descriptions
      const res = await fetch("/api/generate/music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          scenes: project.scenes.map((s) => s.prompt),
          duration: Math.max(
            15,
            Math.round(
              project.scenes.reduce((sum, s) => sum + (s.trimEnd - s.trimStart), 0),
            ),
          ),
        }),
      });

      if (!res.ok) return;

      const data = await res.json();
      const generationId = data.generationId;

      if (!generationId) return;

      // Poll for completion (audio generation is async on .ai)
      const pollUrl = data.pollUrl ?? `/api/stream/${generationId}`;
      let attempts = 0;
      const maxAttempts = 120; // 2 minutes at 1s intervals

      const poll = async (): Promise<string | null> => {
        while (attempts < maxAttempts) {
          attempts++;
          await new Promise((r) => setTimeout(r, 1000));

          try {
            const pollRes = await fetch(pollUrl);
            if (!pollRes.ok) continue;

            const pollData = await pollRes.json();
            const status = pollData.status ?? pollData.data?.status;
            const resultUrl = pollData.resultUrl ?? pollData.data?.resultUrl;

            if (status === "passed" || status === "completed") {
              return resultUrl ?? null;
            }
            if (status === "failed") {
              return null;
            }
          } catch {
            // Retry on network error
          }
        }
        return null;
      };

      const audioUrl = await poll();
      if (audioUrl) {
        updateProject({ audioUrl });
      }
    } catch {
      // Generation failed silently
    } finally {
      setGeneratingMusic(false);
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
    e.target.value = "";
    const url = URL.createObjectURL(file);
    updateScene(pendingSourceSceneId, { sourceImageUrl: url });
    setPendingSourceSceneId(null);
  }

  /* ─ Reference image handlers ─ */

  const [pendingRefCategory, setPendingRefCategory] = useState<"character" | "prop" | "scene">("character");
  const [showRefPicker, setShowRefPicker] = useState<{ category: "character" | "prop" | "scene"; show: boolean; assetsLoaded: boolean }>({ category: "character", show: false, assetsLoaded: false });
  const [refPickerAssets, setRefPickerAssets] = useState<Array<{ id: string; type: string; url: string; prompt: string }>>([]);

  // Fetch assets when ref picker opens with "From Assets"
  useEffect(() => {
    if (showRefPicker.show && showRefPicker.assetsLoaded && refPickerAssets.length === 0) {
      fetch("/api/user/assets?limit=20")
        .then((r) => r.json())
        .then((data) => setRefPickerAssets(data.assets ?? []))
        .catch(() => {});
    }
  }, [showRefPicker.show, showRefPicker.assetsLoaded]);

  function handleAddRefImage(category: "character" | "prop" | "scene") {
    setPendingRefCategory(category);
    refImageInputRef.current?.click();
  }

  function handleAddFromAssets(category: "character" | "prop" | "scene") {
    setShowRefPicker({ category, show: true, assetsLoaded: true });
    if (refPickerAssets.length === 0) {
      fetch("/api/user/assets?limit=20")
        .then((r) => r.json())
        .then((data) => setRefPickerAssets(data.assets ?? []))
        .catch(() => {});
    }
  }

  function handlePickAsset(asset: { id: string; type: string; url: string; prompt: string }, category: "character" | "prop" | "scene") {
    const proxyUrl = asset.url.startsWith("https://princemarketing.ai/")
      ? `/api/proxy/image?url=${encodeURIComponent(asset.url)}`
      : asset.url;
    const newRef: ReferenceImage = {
      id: crypto.randomUUID(),
      url: proxyUrl,
      label: "",
      category,
    };
    updateProject({
      referenceImages: [...(project.referenceImages ?? []), newRef],
    });
    setShowRefPicker({ category, show: false, assetsLoaded: false });
  }

  function handleRefImageFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const url = URL.createObjectURL(file);
    const newRef: ReferenceImage = {
      id: crypto.randomUUID(),
      url,
      label: "",
      category: pendingRefCategory,
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

  // WHY: Optional dimensions metadata for proportional accuracy.
  // Users can add height/width/length/notes to any reference image.
  // These get injected into scene prompts so the AI maintains scale.
  const [editingDimensions, setEditingDimensions] = useState<string | null>(null);

  function handleUpdateRefDimensions(refId: string, field: string, value: string) {
    updateProject({
      referenceImages: (project.referenceImages ?? []).map((r) =>
        r.id === refId
          ? { ...r, dimensions: { ...(r.dimensions ?? {}), [field]: value } }
          : r
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
                  previousScene={i > 0 ? project.scenes[i - 1] : undefined}
                  userAssetsForLock={refs.map((r) => ({
                    id: r.id,
                    url: r.url,
                    name: r.label || "Reference",
                    type: r.category ?? "image",
                  }))}
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

      {/* ── Filmstrip Timeline View ──────────────────────────── */}
      {project.scenes.length > 0 && project.scenes.some((s) => s.videoUrl) && (
        <TimelineView
          project={project}
          selectedSceneId={selectedSceneId}
          onSelectScene={setSelectedSceneId}
        />
      )}

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
              disabled={generatingMusic}
              className="flex items-center gap-1.5 rounded-xl bg-royal/10 px-3.5 py-2.5 text-xs font-medium text-royal hover:bg-royal/20 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generatingMusic ? (
                <><Loader2 size={12} className="animate-spin" /> Generating...</>
              ) : (
                <><Wand2 size={12} /> Generate Music</>
              )}
            </button>
            <button
              onClick={handleUploadAudio}
              disabled={uploadingAudio}
              className="flex items-center gap-1.5 rounded-xl bg-slate/80 px-3.5 py-2.5 text-xs text-ash hover:text-cloud hover:bg-smoke transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploadingAudio ? (
                <><Loader2 size={12} className="animate-spin" /> Uploading...</>
              ) : (
                <><Upload size={12} /> Upload Audio</>
              )}
            </button>
          </div>
        )}
      </div>

      {/* ── Reference Images — Three Categories ─────────────── */}
      <div className="border-t border-smoke/60 px-5 py-4">
        <div className="flex items-center gap-2 mb-4">
          <ImageIcon size={16} className="text-royal" />
          <h4 className="text-xs font-semibold text-cloud">Reference Library</h4>
          <span className="text-[10px] text-ash">
            {selectedSceneId ? "· click to tag to selected scene" : "· select a scene first"}
          </span>
        </div>

        {/* Characters */}
        <div className="mb-3">
          <span className="text-[10px] uppercase tracking-wider text-ash/60 font-medium">Characters</span>
          <div className="flex gap-2 mt-1.5 flex-wrap">
            {(() => {
              // Global index: characters first (offset 0)
              const charRefs = refs.filter((r) => r.category === "character");
              const charOffset = 0;
              return charRefs.map((img, i) => {
                const globalIdx = charOffset + i + 1;
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
                    <img src={img.url} alt={img.label || `Character ${i + 1}`} className="w-full h-full object-cover" />
                    <div className="absolute top-1 left-1">
                      <Badge variant="default" className="text-[8px] bg-void/80 backdrop-blur-sm text-cloud border border-white/10 px-1 py-0">
                        @image{globalIdx}
                      </Badge>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRemoveRefImage(img.id); }}
                      className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-void/70 text-ash opacity-0 group-hover/ref:opacity-100 hover:text-coral transition-all cursor-pointer"
                    >
                      <X size={8} />
                    </button>
                    <input
                      placeholder="Label..."
                      value={img.label}
                      onChange={(e) => handleUpdateRefLabel(img.id, e.target.value)}
                      className="absolute bottom-0 w-full bg-void/80 backdrop-blur-sm text-[9px] text-center py-0.5 text-cloud placeholder:text-ash/50 border-0 outline-none"
                      onClick={(e) => e.stopPropagation()}
                    />
                    {/* Ruler icon — toggle dimensions popover */}
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingDimensions(editingDimensions === img.id ? null : img.id); }}
                      className={`absolute bottom-5 right-1 flex h-4 w-4 items-center justify-center rounded-full transition-all cursor-pointer ${
                        img.dimensions && (img.dimensions.height || img.dimensions.width) ? "bg-royal/60 text-white opacity-100" : "bg-void/70 text-ash opacity-0 group-hover/ref:opacity-100 hover:text-royal"
                      }`}
                      title="Add dimensions (optional)"
                    >
                      <Ruler size={8} />
                    </button>
                    {editingDimensions === img.id && (
                      <div className="absolute top-full left-0 z-30 mt-1 w-44 rounded-lg border border-smoke bg-graphite p-2 shadow-xl" onClick={(e) => e.stopPropagation()}>
                        <div className="text-[8px] uppercase tracking-wider text-ash/50 font-medium mb-1">Dimensions (optional)</div>
                        <input placeholder="Height (e.g. 6'1&quot;)" value={img.dimensions?.height ?? ""} onChange={(e) => handleUpdateRefDimensions(img.id, "height", e.target.value)} className="w-full rounded bg-slate/50 px-1.5 py-1 text-[10px] text-cloud placeholder:text-ash/40 mb-1 border-0 outline-none" />
                        <input placeholder="Width (e.g. 4 in)" value={img.dimensions?.width ?? ""} onChange={(e) => handleUpdateRefDimensions(img.id, "width", e.target.value)} className="w-full rounded bg-slate/50 px-1.5 py-1 text-[10px] text-cloud placeholder:text-ash/40 mb-1 border-0 outline-none" />
                        <input placeholder="Notes (e.g. slim build)" value={img.dimensions?.notes ?? ""} onChange={(e) => handleUpdateRefDimensions(img.id, "notes", e.target.value)} className="w-full rounded bg-slate/50 px-1.5 py-1 text-[10px] text-cloud placeholder:text-ash/40 border-0 outline-none" />
                      </div>
                    )}
                  </div>
                );
              });
            })()}
            {refs.filter((r) => r.category === "character").length < 3 && (
              <div className="relative">
                <button
                  onClick={() => setShowRefPicker({ category: "character", show: !showRefPicker.show || showRefPicker.category !== "character", assetsLoaded: false })}
                  className="w-20 h-20 rounded-xl border border-dashed border-smoke/60 flex flex-col items-center justify-center text-ash/40 hover:text-royal hover:border-royal/40 hover:bg-royal/[0.02] transition-all duration-200 cursor-pointer"
                >
                  <Plus size={16} />
                  <span className="text-[9px] mt-1 font-medium">+ Add</span>
                </button>
                {showRefPicker.show && showRefPicker.category === "character" && (
                  <div className="absolute bottom-full left-0 z-30 mb-1 w-48 rounded-xl border border-smoke bg-graphite p-2 shadow-xl">
                    <button
                      onClick={() => { handleAddRefImage("character"); setShowRefPicker({ category: "character", show: false, assetsLoaded: false }); }}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] text-ash hover:text-cloud hover:bg-slate transition-colors cursor-pointer"
                    >
                      <Upload size={12} /> Upload File
                    </button>
                    <button
                      onClick={() => handleAddFromAssets("character")}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] text-ash hover:text-cloud hover:bg-slate transition-colors cursor-pointer"
                    >
                      <FolderOpen size={12} /> From Assets
                    </button>
                    {showRefPicker.assetsLoaded && (
                      <div className="mt-2 grid grid-cols-3 gap-1 max-h-32 overflow-y-auto border-t border-smoke/40 pt-2">
                        {refPickerAssets.filter((a) => a.type === "image").length === 0 && (
                          <span className="col-span-3 text-[10px] text-ash/50 text-center py-2">No image assets</span>
                        )}
                        {refPickerAssets.filter((a) => a.type === "image").map((asset) => (
                          <button
                            key={asset.id}
                            onClick={() => handlePickAsset(asset, "character")}
                            className="aspect-square rounded-md overflow-hidden border border-smoke/30 hover:border-royal/40 cursor-pointer"
                          >
                            <img
                              src={asset.url.startsWith("https://princemarketing.ai/") ? `/api/proxy/image?url=${encodeURIComponent(asset.url)}` : asset.url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Props */}
        <div className="mb-3">
          <span className="text-[10px] uppercase tracking-wider text-ash/60 font-medium">Props</span>
          <div className="flex gap-2 mt-1.5 flex-wrap">
            {(() => {
              // Global index: props after characters (offset = character count)
              const propRefs = refs.filter((r) => r.category === "prop");
              const propOffset = refs.filter((r) => r.category === "character").length;
              return propRefs.map((img, i) => {
                const globalIdx = propOffset + i + 1;
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
                    <img src={img.url} alt={img.label || `Prop ${i + 1}`} className="w-full h-full object-cover" />
                    <div className="absolute top-1 left-1">
                      <Badge variant="default" className="text-[8px] bg-void/80 backdrop-blur-sm text-cloud border border-white/10 px-1 py-0">
                        @image{globalIdx}
                      </Badge>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRemoveRefImage(img.id); }}
                      className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-void/70 text-ash opacity-0 group-hover/ref:opacity-100 hover:text-coral transition-all cursor-pointer"
                    >
                      <X size={8} />
                    </button>
                    <input
                      placeholder="Label..."
                      value={img.label}
                      onChange={(e) => handleUpdateRefLabel(img.id, e.target.value)}
                      className="absolute bottom-0 w-full bg-void/80 backdrop-blur-sm text-[9px] text-center py-0.5 text-cloud placeholder:text-ash/50 border-0 outline-none"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingDimensions(editingDimensions === img.id ? null : img.id); }}
                      className={`absolute bottom-5 right-1 flex h-4 w-4 items-center justify-center rounded-full transition-all cursor-pointer ${
                        img.dimensions && (img.dimensions.height || img.dimensions.width || img.dimensions.length) ? "bg-royal/60 text-white opacity-100" : "bg-void/70 text-ash opacity-0 group-hover/ref:opacity-100 hover:text-royal"
                      }`}
                      title="Add dimensions (optional)"
                    >
                      <Ruler size={8} />
                    </button>
                    {editingDimensions === img.id && (
                      <div className="absolute top-full left-0 z-30 mt-1 w-44 rounded-lg border border-smoke bg-graphite p-2 shadow-xl" onClick={(e) => e.stopPropagation()}>
                        <div className="text-[8px] uppercase tracking-wider text-ash/50 font-medium mb-1">Dimensions (optional)</div>
                        <input placeholder="Height (e.g. 12 in)" value={img.dimensions?.height ?? ""} onChange={(e) => handleUpdateRefDimensions(img.id, "height", e.target.value)} className="w-full rounded bg-slate/50 px-1.5 py-1 text-[10px] text-cloud placeholder:text-ash/40 mb-1 border-0 outline-none" />
                        <input placeholder="Width (e.g. 4 in)" value={img.dimensions?.width ?? ""} onChange={(e) => handleUpdateRefDimensions(img.id, "width", e.target.value)} className="w-full rounded bg-slate/50 px-1.5 py-1 text-[10px] text-cloud placeholder:text-ash/40 mb-1 border-0 outline-none" />
                        <input placeholder="Length (e.g. 11 in)" value={img.dimensions?.length ?? ""} onChange={(e) => handleUpdateRefDimensions(img.id, "length", e.target.value)} className="w-full rounded bg-slate/50 px-1.5 py-1 text-[10px] text-cloud placeholder:text-ash/40 mb-1 border-0 outline-none" />
                        <input placeholder="Notes (e.g. matte black)" value={img.dimensions?.notes ?? ""} onChange={(e) => handleUpdateRefDimensions(img.id, "notes", e.target.value)} className="w-full rounded bg-slate/50 px-1.5 py-1 text-[10px] text-cloud placeholder:text-ash/40 border-0 outline-none" />
                      </div>
                    )}
                  </div>
                );
              });
            })()}
            {refs.filter((r) => r.category === "prop").length < 3 && (
              <div className="relative">
                <button
                  onClick={() => setShowRefPicker({ category: "prop", show: !showRefPicker.show || showRefPicker.category !== "prop", assetsLoaded: false })}
                  className="w-20 h-20 rounded-xl border border-dashed border-smoke/60 flex flex-col items-center justify-center text-ash/40 hover:text-royal hover:border-royal/40 hover:bg-royal/[0.02] transition-all duration-200 cursor-pointer"
                >
                  <Plus size={16} />
                  <span className="text-[9px] mt-1 font-medium">+ Add</span>
                </button>
                {showRefPicker.show && showRefPicker.category === "prop" && (
                  <div className="absolute bottom-full left-0 z-30 mb-1 w-48 rounded-xl border border-smoke bg-graphite p-2 shadow-xl">
                    <button
                      onClick={() => { handleAddRefImage("prop"); setShowRefPicker({ category: "prop", show: false, assetsLoaded: false }); }}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] text-ash hover:text-cloud hover:bg-slate transition-colors cursor-pointer"
                    >
                      <Upload size={12} /> Upload File
                    </button>
                    <button
                      onClick={() => handleAddFromAssets("prop")}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] text-ash hover:text-cloud hover:bg-slate transition-colors cursor-pointer"
                    >
                      <FolderOpen size={12} /> From Assets
                    </button>
                    {showRefPicker.assetsLoaded && (
                      <div className="mt-2 grid grid-cols-3 gap-1 max-h-32 overflow-y-auto border-t border-smoke/40 pt-2">
                        {refPickerAssets.filter((a) => a.type === "image").length === 0 && (
                          <span className="col-span-3 text-[10px] text-ash/50 text-center py-2">No image assets</span>
                        )}
                        {refPickerAssets.filter((a) => a.type === "image").map((asset) => (
                          <button
                            key={asset.id}
                            onClick={() => handlePickAsset(asset, "prop")}
                            className="aspect-square rounded-md overflow-hidden border border-smoke/30 hover:border-royal/40 cursor-pointer"
                          >
                            <img
                              src={asset.url.startsWith("https://princemarketing.ai/") ? `/api/proxy/image?url=${encodeURIComponent(asset.url)}` : asset.url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Scenes / Environments */}
        <div>
          <span className="text-[10px] uppercase tracking-wider text-ash/60 font-medium">Environments</span>
          <div className="flex gap-2 mt-1.5 flex-wrap">
            {(() => {
              // Global index: scenes after characters + props
              const sceneRefs = refs.filter((r) => r.category === "scene");
              const sceneOffset = refs.filter((r) => r.category === "character").length + refs.filter((r) => r.category === "prop").length;
              return sceneRefs.map((img, i) => {
                const globalIdx = sceneOffset + i + 1;
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
                    <img src={img.url} alt={img.label || `Environment ${i + 1}`} className="w-full h-full object-cover" />
                    <div className="absolute top-1 left-1">
                      <Badge variant="default" className="text-[8px] bg-void/80 backdrop-blur-sm text-cloud border border-white/10 px-1 py-0">
                        @image{globalIdx}
                      </Badge>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRemoveRefImage(img.id); }}
                      className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-void/70 text-ash opacity-0 group-hover/ref:opacity-100 hover:text-coral transition-all cursor-pointer"
                    >
                      <X size={8} />
                    </button>
                    <input
                      placeholder="Label..."
                      value={img.label}
                      onChange={(e) => handleUpdateRefLabel(img.id, e.target.value)}
                      className="absolute bottom-0 w-full bg-void/80 backdrop-blur-sm text-[9px] text-center py-0.5 text-cloud placeholder:text-ash/50 border-0 outline-none"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingDimensions(editingDimensions === img.id ? null : img.id); }}
                      className={`absolute bottom-5 right-1 flex h-4 w-4 items-center justify-center rounded-full transition-all cursor-pointer ${
                        img.dimensions && img.dimensions.notes ? "bg-royal/60 text-white opacity-100" : "bg-void/70 text-ash opacity-0 group-hover/ref:opacity-100 hover:text-royal"
                      }`}
                      title="Add details (optional)"
                    >
                      <Ruler size={8} />
                    </button>
                    {editingDimensions === img.id && (
                      <div className="absolute top-full left-0 z-30 mt-1 w-44 rounded-lg border border-smoke bg-graphite p-2 shadow-xl" onClick={(e) => e.stopPropagation()}>
                        <div className="text-[8px] uppercase tracking-wider text-ash/50 font-medium mb-1">Details (optional)</div>
                        <input placeholder="Size (e.g. 30x20 ft)" value={img.dimensions?.height ?? ""} onChange={(e) => handleUpdateRefDimensions(img.id, "height", e.target.value)} className="w-full rounded bg-slate/50 px-1.5 py-1 text-[10px] text-cloud placeholder:text-ash/40 mb-1 border-0 outline-none" />
                        <input placeholder="Notes (e.g. warehouse, concrete)" value={img.dimensions?.notes ?? ""} onChange={(e) => handleUpdateRefDimensions(img.id, "notes", e.target.value)} className="w-full rounded bg-slate/50 px-1.5 py-1 text-[10px] text-cloud placeholder:text-ash/40 border-0 outline-none" />
                      </div>
                    )}
                  </div>
                );
              });
            })()}
            {refs.filter((r) => r.category === "scene").length < 3 && (
              <div className="relative">
                <button
                  onClick={() => setShowRefPicker({ category: "scene", show: !showRefPicker.show || showRefPicker.category !== "scene", assetsLoaded: false })}
                  className="w-20 h-20 rounded-xl border border-dashed border-smoke/60 flex flex-col items-center justify-center text-ash/40 hover:text-royal hover:border-royal/40 hover:bg-royal/[0.02] transition-all duration-200 cursor-pointer"
                >
                  <Plus size={16} />
                  <span className="text-[9px] mt-1 font-medium">+ Add</span>
                </button>
                {showRefPicker.show && showRefPicker.category === "scene" && (
                  <div className="absolute bottom-full left-0 z-30 mb-1 w-48 rounded-xl border border-smoke bg-graphite p-2 shadow-xl">
                    <button
                      onClick={() => { handleAddRefImage("scene"); setShowRefPicker({ category: "scene", show: false, assetsLoaded: false }); }}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] text-ash hover:text-cloud hover:bg-slate transition-colors cursor-pointer"
                    >
                      <Upload size={12} /> Upload File
                    </button>
                    <button
                      onClick={() => handleAddFromAssets("scene")}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] text-ash hover:text-cloud hover:bg-slate transition-colors cursor-pointer"
                    >
                      <FolderOpen size={12} /> From Assets
                    </button>
                    {showRefPicker.assetsLoaded && (
                      <div className="mt-2 grid grid-cols-3 gap-1 max-h-32 overflow-y-auto border-t border-smoke/40 pt-2">
                        {refPickerAssets.filter((a) => a.type === "image").length === 0 && (
                          <span className="col-span-3 text-[10px] text-ash/50 text-center py-2">No image assets</span>
                        )}
                        {refPickerAssets.filter((a) => a.type === "image").map((asset) => (
                          <button
                            key={asset.id}
                            onClick={() => handlePickAsset(asset, "scene")}
                            className="aspect-square rounded-md overflow-hidden border border-smoke/30 hover:border-royal/40 cursor-pointer"
                          >
                            <img
                              src={asset.url.startsWith("https://princemarketing.ai/") ? `/api/proxy/image?url=${encodeURIComponent(asset.url)}` : asset.url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Asset Drawer ───────────────────────────────────────── */}
      <AssetDrawer
        open={showAssetDrawer}
        onClose={() => setShowAssetDrawer(false)}
        project={project}
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
          const isFirstEmpty = firstScene && !firstScene.prompt && !firstScene.videoUrl && !firstScene.sourceImageUrl && firstScene.status !== "generating";
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
                <button
                  onClick={async () => {
                    const res = await fetch(stitchedUrl!);
                    const blob = await res.blob();
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob);
                    a.download = `${project.title || "export"}.mp4`;
                    a.click();
                    URL.revokeObjectURL(a.href);
                  }}
                  className="flex items-center gap-1.5 rounded-lg bg-royal px-3 py-1.5 text-xs font-medium text-white hover:bg-royal/80 transition-colors cursor-pointer"
                >
                  <Download size={12} /> Download
                </button>
                <button
                  onClick={async () => {
                    if (generatingScore) return;
                    setGeneratingScore(true);
                    try {
                      // Build scene timing from the project
                      let currentTime = 0;
                      const sceneTiming = project.scenes
                        .filter((s) => s.videoUrl && s.status === "ready")
                        .map((s, i, arr) => {
                          const duration = s.trimEnd - s.trimStart;
                          const startTime = currentTime;
                          currentTime += duration;
                          const totalScenes = arr.length;
                          const attentionRole = i === 0
                            ? "stimulation"
                            : i === totalScenes - 1
                              ? "validation"
                              : i < totalScenes / 2
                                ? "captivation"
                                : "anticipation";
                          return {
                            prompt: s.prompt,
                            startTime,
                            endTime: currentTime,
                            attentionRole,
                          };
                        });

                      // Call Sound Director
                      const soundRes = await fetch("/api/proxy/direct-sound", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          videoUrl: stitchedUrl,
                          scenes: sceneTiming,
                          totalDuration: currentTime,
                          targetEmotion: "engagement",
                        }),
                      });

                      if (soundRes.ok) {
                        const soundData = await soundRes.json();
                        const sunoPrompt = soundData?.data?.sunoPrompt ?? soundData?.sunoPrompt;
                        const sunoDuration = soundData?.data?.sunoDuration ?? soundData?.sunoDuration ?? Math.ceil(currentTime);

                        if (sunoPrompt) {
                          // Generate music via Suno
                          const musicRes = await fetch("/api/generate/music", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              prompt: sunoPrompt,
                              duration: sunoDuration,
                              style: soundData?.data?.sunoStyle ?? "cinematic",
                            }),
                          });

                          if (musicRes.ok) {
                            const musicData = await musicRes.json();
                            if (musicData.generationId) {
                              // Poll for completion
                              const pollUrl = musicData.pollUrl ?? `/api/stream/${musicData.generationId}`;
                              let attempts = 0;
                              while (attempts < 120) {
                                attempts++;
                                await new Promise((r) => setTimeout(r, 1000));
                                try {
                                  const pollRes = await fetch(pollUrl);
                                  if (!pollRes.ok) continue;
                                  const pollData = await pollRes.json();
                                  const status = pollData.status ?? pollData.data?.status;
                                  const resultUrl = pollData.resultUrl ?? pollData.data?.resultUrl;
                                  if ((status === "passed" || status === "completed") && resultUrl) {
                                    updateProject({ audioUrl: resultUrl });
                                    break;
                                  }
                                  if (status === "failed") break;
                                } catch { /* retry */ }
                              }
                            }
                          }
                        }
                      }
                    } catch {
                      // Sound generation failed silently
                    } finally {
                      setGeneratingScore(false);
                    }
                  }}
                  disabled={generatingScore}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {generatingScore ? <Loader2 size={12} className="animate-spin" /> : <Music size={12} />}
                  {generatingScore ? "Scoring..." : "Generate Score"}
                </button>
                <button
                  onClick={() => { setShowKaraoke(true); setStitchedUrl(null); }}
                  className="flex items-center gap-1.5 rounded-lg bg-coral/80 px-3 py-1.5 text-xs font-medium text-white hover:bg-coral transition-colors cursor-pointer"
                >
                  <Mic size={12} /> Record Voiceover
                </button>
                <button
                  disabled={criticLoading}
                  onClick={async () => {
                    if (!stitchedUrl) return;
                    setCriticLoading(true);
                    setCriticReview(null);
                    try {
                      const res = await fetch("/api/ai/critic-review", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          videoUrl: stitchedUrl,
                          brief: project.title ?? "Untitled commercial",
                          scenes: project.scenes.map((s, i) => ({
                            index: i,
                            prompt: s.prompt,
                            duration: s.trimEnd - s.trimStart,
                          })),
                        }),
                      });
                      if (res.ok) {
                        const data = await res.json();
                        const payload = data?.data ?? data;
                        if (payload?.scenes) setCriticReview(payload);
                      }
                    } catch (err) {
                      console.warn("[Critic] failed:", err);
                    } finally {
                      setCriticLoading(false);
                    }
                  }}
                  className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {criticLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  {criticLoading ? "Critic reviewing..." : "Run Critic"}
                </button>
                <button onClick={() => window.open(stitchedUrl, "_blank")} className="flex items-center gap-1.5 rounded-lg bg-slate px-3 py-1.5 text-xs font-medium text-cloud hover:bg-smoke transition-colors cursor-pointer">
                  Open in Tab
                </button>
                <button onClick={() => setStitchedUrl(null)} className="flex h-7 w-7 items-center justify-center rounded-lg text-ash hover:text-cloud hover:bg-slate transition-colors cursor-pointer">
                  <X size={14} />
                </button>
              </div>
            </div>
            <div className="p-4">
              {/* WHY: Audio re-mix presets. Lets the user iterate on
                  ducking intensity without a full re-stitch. Hits the
                  lightweight /api/video/remix-audio endpoint which copies
                  the video stream and only re-runs the filter graph. */}
              {(project.audioUrl || project.voiceoverUrl) && (
                <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-smoke bg-graphite/60 px-3 py-2">
                  <span className="text-[11px] text-ash">Audio mix:</span>
                  {([
                    { key: "subtle" as const, label: "Subtle", db: -6 },
                    { key: "standard" as const, label: "Standard", db: -12 },
                    { key: "aggressive" as const, label: "Aggressive", db: -18 },
                  ]).map((preset) => {
                    const isActive = activeDuckingDb === preset.db;
                    const isLoading = remixing === preset.key;
                    return (
                      <button
                        key={preset.key}
                        type="button"
                        disabled={!!remixing || isActive}
                        onClick={async () => {
                          if (!stitchedUrl) return;
                          setRemixing(preset.key);
                          try {
                            const res = await fetch("/api/video/remix-audio", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                projectId: project.id,
                                baseVideoUrl: stitchedUrl,
                                audioUrl: project.audioUrl,
                                voiceoverUrl: project.voiceoverUrl,
                                duckingDb: preset.db,
                              }),
                            });
                            if (res.ok) {
                              const data = await res.json();
                              const newUrl = data?.videoUrl ?? data?.directUrl;
                              if (newUrl) {
                                setStitchedUrl(newUrl);
                                setActiveDuckingDb(preset.db);
                              }
                            }
                          } catch (err) {
                            console.warn("[Remix] failed:", err);
                          } finally {
                            setRemixing(null);
                          }
                        }}
                        className={[
                          "flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                          isActive
                            ? "bg-royal text-white"
                            : "bg-graphite text-cloud hover:bg-smoke",
                          remixing ? "cursor-not-allowed opacity-60" : "",
                        ].join(" ")}
                      >
                        {isLoading && <Loader2 size={10} className="animate-spin" />}
                        {preset.label}
                        <span className="text-[9px] opacity-70">{preset.db}dB</span>
                      </button>
                    );
                  })}
                  {remixing && (
                    <span className="text-[10px] text-ash/60">
                      Re-mixing audio...
                    </span>
                  )}
                </div>
              )}
              <video src={stitchedUrl} controls autoPlay className="w-full rounded-xl" />

              {/* Critic review — per-scene scores + fix suggestions with
                  one-click regeneration. Only rendered after the user
                  explicitly runs the critic (it's a paid Gemini call, not
                  auto-fired). Weak scenes (≤7) get a Regenerate button that
                  re-fires the existing per-scene generation path with the
                  critic's fix suggestion appended to the prompt. */}
              {criticReview && (
                <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles size={14} className="text-amber-400" />
                      <span className="text-xs font-medium text-cloud">
                        Critic verdict
                      </span>
                      <span
                        className={[
                          "rounded-full px-2 py-0.5 text-[10px] font-bold",
                          criticReview.overallScore >= 8
                            ? "bg-emerald-500/20 text-emerald-300"
                            : criticReview.overallScore >= 6
                              ? "bg-amber-500/20 text-amber-300"
                              : "bg-rose-500/20 text-rose-300",
                        ].join(" ")}
                      >
                        {criticReview.overallScore}/10
                      </span>
                    </div>
                    <button
                      onClick={() => setCriticReview(null)}
                      className="text-[10px] text-ash hover:text-cloud"
                    >
                      dismiss
                    </button>
                  </div>
                  <p className="mb-3 text-[11px] leading-relaxed text-cloud">
                    {criticReview.overallVerdict}
                  </p>
                  <div className="flex flex-col gap-2">
                    {criticReview.scenes.map((s) => {
                      const scene = project.scenes[s.sceneIndex];
                      const scoreColor =
                        s.score >= 8
                          ? "text-emerald-400"
                          : s.score >= 6
                            ? "text-amber-400"
                            : "text-rose-400";
                      return (
                        <div
                          key={s.sceneIndex}
                          className="rounded-lg border border-smoke/60 bg-graphite/60 p-2 text-[11px]"
                        >
                          <div className="mb-1 flex items-center gap-2">
                            <span className="font-medium text-cloud">
                              Scene {s.sceneIndex + 1}
                            </span>
                            <span className={`font-bold ${scoreColor}`}>
                              {s.score}/10
                            </span>
                          </div>
                          {s.strengths && (
                            <div className="mb-0.5 text-emerald-300/80">
                              <span className="opacity-60">+</span> {s.strengths}
                            </div>
                          )}
                          {s.weaknesses && s.score <= 7 && (
                            <div className="mb-1 text-rose-300/80">
                              <span className="opacity-60">−</span> {s.weaknesses}
                            </div>
                          )}
                          {s.fixSuggestion && scene && (
                            <div className="mt-1.5 flex flex-col gap-1.5">
                              <div className="rounded-md bg-graphite/80 px-2 py-1 text-ash/90">
                                {s.fixSuggestion}
                              </div>
                              <button
                                onClick={async () => {
                                  // Append the critic's fix suggestion to the
                                  // scene's existing prompt and re-generate.
                                  // WHY: Preserve the original intent — we're
                                  // refining, not replacing. The fix becomes
                                  // additive guidance the Director enriches.
                                  const revisedPrompt = `${scene.prompt}\n\nCRITIC NOTE: ${s.fixSuggestion}`;
                                  const revisedScene = { ...scene, prompt: revisedPrompt };
                                  updateScene(scene.id, { prompt: revisedPrompt });
                                  await handleRegenerate(revisedScene);
                                }}
                                className="self-start rounded-md bg-royal px-2 py-1 text-[10px] font-medium text-white hover:bg-royal/80 transition-colors"
                              >
                                Regenerate scene {s.sceneIndex + 1}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Karaoke Recorder Overlay ───────────────────────────────────
          WHY: Renders the inline KaraokeRecorder when either the user
          clicks "Record Voiceover" (showKaraoke local state) OR the
          AI Strategist triggers OPEN_KARAOKE from chat (karaokeSession prop). */}
      {(showKaraoke || karaokeSession) && stitchedUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/80 backdrop-blur-sm overflow-y-auto p-4">
          <div className="w-full max-w-3xl">
            <KaraokeRecorder
              videoUrl={stitchedUrl}
              script={
                karaokeSession?.script ?? [
                  // Default fallback script — single line covering full duration
                  { startTime: 0, endTime: project.scenes.reduce((sum, s) => sum + (s.trimEnd - s.trimStart), 0), text: "Add your voiceover here..." },
                ]
              }
              onRecordingComplete={(_blob, audioUrl) => {
                // WHY: Karaoke recordings now land on voiceoverUrl, not
                // audioUrl. The music track (audioUrl) stays untouched —
                // the stitch pipeline sidechains music under voiceover
                // at render time. Previously this overwrote the music bed.
                updateProject({
                  voiceoverUrl: audioUrl,
                  voiceoverSource: "karaoke",
                });
                setShowKaraoke(false);
                onCloseKaraoke?.();
              }}
              onClose={() => {
                setShowKaraoke(false);
                onCloseKaraoke?.();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
