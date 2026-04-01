"use client";

import { useState } from "react";
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
} from "lucide-react";
import type { VideoScene, VideoProject } from "@/types/canvas";

type VideoEditorProps = {
  project: VideoProject;
  onUpdateProject: (project: VideoProject) => void;
  onClose?: () => void;
};

function SceneCard({
  scene,
  index,
  onRegenerate,
  onRevert,
  onTrimChange,
}: {
  scene: VideoScene;
  index: number;
  onRegenerate: () => void;
  onRevert: (versionIndex: number) => void;
  onTrimChange: (trimStart: number, trimEnd: number) => void;
}) {
  const [showTrim, setShowTrim] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const isLoading = scene.status === "generating" || scene.status === "regenerating";

  return (
    <div className="group relative flex shrink-0 flex-col">
      {/* Scene number */}
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[10px] font-mono uppercase tracking-wider text-ash">
          Scene {index + 1}
        </span>
        <Badge
          variant={scene.status === "ready" ? "mint" : "amber"}
          className="text-[10px]"
        >
          {scene.status}
        </Badge>
      </div>

      {/* Preview card */}
      <div className="relative h-40 w-64 overflow-hidden rounded-xl border border-smoke bg-slate/60">
        {isLoading ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2">
            <Loader2 size={24} strokeWidth={1.5} className="animate-spin text-royal" />
            <span className="text-xs text-ash">
              {scene.status === "regenerating" ? "Regenerating..." : "Generating..."}
            </span>
          </div>
        ) : scene.thumbnailUrl || scene.videoUrl ? (
          <div className="relative h-full w-full">
            {scene.videoUrl ? (
              <video
                src={scene.videoUrl}
                className="h-full w-full object-cover"
                muted
                loop
                onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
                onMouseLeave={(e) => {
                  const v = e.target as HTMLVideoElement;
                  v.pause();
                  v.currentTime = 0;
                }}
              />
            ) : (
              <img
                src={scene.thumbnailUrl}
                alt={`Scene ${index + 1}`}
                className="h-full w-full object-cover"
              />
            )}
            {/* Play overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-void/30 opacity-0 group-hover:opacity-100 transition-opacity">
              <Play size={28} strokeWidth={1.5} className="text-white" />
            </div>
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Film size={28} strokeWidth={1} className="text-ash/40" />
          </div>
        )}

        {/* Duration badge */}
        <div className="absolute bottom-2 right-2">
          <Badge variant="default" className="bg-void/70 text-[10px] font-mono text-cloud backdrop-blur-sm">
            {(scene.trimEnd - scene.trimStart).toFixed(1)}s
          </Badge>
        </div>
      </div>

      {/* Prompt text */}
      <p className="mt-2 w-64 truncate text-xs text-ash">{scene.prompt}</p>

      {/* Action buttons */}
      <div className="mt-2 flex items-center gap-1.5">
        <button
          onClick={onRegenerate}
          disabled={isLoading}
          className="
            flex h-7 items-center gap-1 rounded-md bg-slate px-2
            text-[11px] text-ash hover:text-cloud hover:bg-smoke
            transition-colors duration-150 cursor-pointer
            disabled:opacity-40 disabled:cursor-not-allowed
          "
          title="Regenerate scene"
        >
          <RefreshCw size={12} strokeWidth={1.5} />
          <span>Redo</span>
        </button>

        <div className="relative">
          <button
            onClick={() => setShowVersions(!showVersions)}
            disabled={scene.versions.length < 2}
            className="
              flex h-7 items-center gap-1 rounded-md bg-slate px-2
              text-[11px] text-ash hover:text-cloud hover:bg-smoke
              transition-colors duration-150 cursor-pointer
              disabled:opacity-40 disabled:cursor-not-allowed
            "
            title="Revert to previous version"
          >
            <Undo2 size={12} strokeWidth={1.5} />
            <span>Revert</span>
            <ChevronDown size={10} />
          </button>

          {/* Version dropdown */}
          {showVersions && scene.versions.length >= 2 && (
            <div className="absolute top-full left-0 z-10 mt-1 w-48 rounded-lg border border-smoke bg-graphite py-1 shadow-xl">
              {scene.versions.map((v, vi) => (
                <button
                  key={vi}
                  onClick={() => {
                    onRevert(vi);
                    setShowVersions(false);
                  }}
                  className="
                    flex w-full items-center gap-2 px-3 py-1.5
                    text-xs text-ash hover:text-cloud hover:bg-slate
                    transition-colors cursor-pointer
                  "
                >
                  <span className="font-mono">v{vi + 1}</span>
                  <span className="text-ash/60">
                    {new Date(v.createdAt).toLocaleTimeString()}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => setShowTrim(!showTrim)}
          className={`
            flex h-7 items-center gap-1 rounded-md px-2
            text-[11px] transition-colors duration-150 cursor-pointer
            ${showTrim ? "bg-royal/20 text-royal" : "bg-slate text-ash hover:text-cloud hover:bg-smoke"}
          `}
          title="Trim scene"
        >
          <Scissors size={12} strokeWidth={1.5} />
          <span>Trim</span>
        </button>
      </div>

      {/* Trim controls */}
      {showTrim && (
        <div className="mt-2 w-64 rounded-lg border border-smoke bg-slate/60 p-3">
          <div className="flex items-center justify-between text-[10px] text-ash mb-1.5">
            <span>In: {scene.trimStart.toFixed(1)}s</span>
            <span>Out: {scene.trimEnd.toFixed(1)}s</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={scene.duration}
              step={0.1}
              value={scene.trimStart}
              onChange={(e) => onTrimChange(parseFloat(e.target.value), scene.trimEnd)}
              className="h-1 flex-1 accent-royal"
            />
            <input
              type="range"
              min={0}
              max={scene.duration}
              step={0.1}
              value={scene.trimEnd}
              onChange={(e) => onTrimChange(scene.trimStart, parseFloat(e.target.value))}
              className="h-1 flex-1 accent-royal"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function VideoEditor({ project, onUpdateProject, onClose }: VideoEditorProps) {
  const [newPrompt, setNewPrompt] = useState("");
  const [showAddScene, setShowAddScene] = useState(false);
  const [stitching, setStitching] = useState(false);

  function updateScene(sceneId: string, updates: Partial<VideoScene>) {
    onUpdateProject({
      ...project,
      scenes: project.scenes.map((s) => (s.id === sceneId ? { ...s, ...updates } : s)),
    });
  }

  async function handleRegenerate(scene: VideoScene) {
    // Save current version
    const currentVersion = scene.videoUrl
      ? { url: scene.videoUrl, createdAt: new Date().toISOString() }
      : null;

    updateScene(scene.id, {
      status: "regenerating",
      versions: currentVersion ? [...scene.versions, currentVersion] : scene.versions,
    });

    try {
      const res = await fetch("/api/video/generate-scene", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: scene.prompt }),
      });

      if (res.ok) {
        const data = await res.json();
        updateScene(scene.id, {
          status: "ready",
          videoUrl: data.videoUrl,
          thumbnailUrl: data.thumbnailUrl,
          duration: data.duration ?? scene.duration,
          trimEnd: data.duration ?? scene.trimEnd,
        });
      } else {
        updateScene(scene.id, { status: "ready" });
      }
    } catch {
      updateScene(scene.id, { status: "ready" });
    }
  }

  function handleRevert(scene: VideoScene, versionIndex: number) {
    const version = scene.versions[versionIndex];
    if (!version) return;

    updateScene(scene.id, {
      videoUrl: version.url,
      thumbnailUrl: undefined,
    });
  }

  function handleTrimChange(sceneId: string, trimStart: number, trimEnd: number) {
    if (trimStart >= trimEnd) return;
    updateScene(sceneId, { trimStart, trimEnd });
  }

  async function handleAddScene() {
    if (!newPrompt.trim()) return;

    const newScene: VideoScene = {
      id: crypto.randomUUID(),
      prompt: newPrompt.trim(),
      duration: 5,
      trimStart: 0,
      trimEnd: 5,
      status: "generating",
      versions: [],
    };

    onUpdateProject({
      ...project,
      scenes: [...project.scenes, newScene],
    });
    setNewPrompt("");
    setShowAddScene(false);

    // Generate the scene
    try {
      const res = await fetch("/api/video/generate-scene", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: newScene.prompt }),
      });

      if (res.ok) {
        const data = await res.json();
        updateScene(newScene.id, {
          status: "ready",
          videoUrl: data.videoUrl,
          thumbnailUrl: data.thumbnailUrl,
          duration: data.duration ?? 5,
          trimEnd: data.duration ?? 5,
        });
      } else {
        updateScene(newScene.id, { status: "ready" });
      }
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
        // Could open the final video or add it as a node
        if (data.videoUrl) {
          window.open(data.videoUrl, "_blank");
        }
      }
    } catch {
      // Silent fail — would want to show a toast
    } finally {
      setStitching(false);
    }
  }

  const totalDuration = project.scenes.reduce(
    (sum, s) => sum + (s.trimEnd - s.trimStart),
    0,
  );
  const readyScenes = project.scenes.filter((s) => s.status === "ready" && s.videoUrl);

  return (
    <div className="flex flex-col rounded-xl border border-smoke bg-graphite">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-smoke px-5 py-3">
        <div className="flex items-center gap-3">
          <Film size={18} strokeWidth={1.5} className="text-royal" />
          <div>
            <h3 className="text-sm font-semibold text-cloud">{project.title}</h3>
            <p className="text-[11px] text-ash">
              {project.scenes.length} scenes &middot; {totalDuration.toFixed(1)}s total
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

      {/* Timeline */}
      <div className="flex items-start gap-4 overflow-x-auto px-5 py-5">
        {project.scenes.map((scene, i) => (
          <div key={scene.id} className="flex items-start gap-4">
            <SceneCard
              scene={scene}
              index={i}
              onRegenerate={() => handleRegenerate(scene)}
              onRevert={(vi) => handleRevert(scene, vi)}
              onTrimChange={(start, end) => handleTrimChange(scene.id, start, end)}
            />
            {/* Connection arrow */}
            {i < project.scenes.length - 1 && (
              <div className="flex h-40 items-center">
                <ArrowRight size={16} strokeWidth={1.5} className="text-royal/30" />
              </div>
            )}
          </div>
        ))}

        {/* Add scene button */}
        {showAddScene ? (
          <div className="flex shrink-0 flex-col gap-2">
            <textarea
              value={newPrompt}
              onChange={(e) => setNewPrompt(e.target.value)}
              placeholder="Describe this scene..."
              rows={3}
              className="
                w-64 resize-none rounded-lg border border-smoke bg-void px-3 py-2
                text-sm text-cloud placeholder:text-ash/60
                focus:border-royal focus:outline-none
              "
              autoFocus
            />
            <div className="flex gap-2">
              <Button variant="primary" size="sm" onClick={handleAddScene} disabled={!newPrompt.trim()}>
                Add Scene
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setShowAddScene(false); setNewPrompt(""); }}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAddScene(true)}
            className="
              flex h-40 w-20 shrink-0 flex-col items-center justify-center
              rounded-xl border border-dashed border-smoke
              text-ash hover:text-cloud hover:border-royal/40
              transition-colors duration-200 cursor-pointer
            "
          >
            <Plus size={20} strokeWidth={1.5} />
            <span className="mt-1 text-[10px]">Add</span>
          </button>
        )}
      </div>
    </div>
  );
}
