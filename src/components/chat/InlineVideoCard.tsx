"use client";

import { useState, useRef, useEffect } from "react";
import {
  Play,
  Pause,
  RefreshCw,
  Scissors,
  Check,
  ChevronDown,
  ChevronUp,
  Film,
  Loader2,
  Sparkles,
  Download,
  Music,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";

// WHY: Inline video card that renders inside the chat message stream.
// Users can preview, trim, regenerate, and approve scenes without
// switching to the Video Editor. This is the chat-first philosophy:
// the chat IS the production interface for most users.

type InlineVideoCardProps = {
  sceneIndex: number;
  totalScenes: number;
  prompt: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  status: "draft" | "generating" | "ready" | "regenerating";
  duration: number;
  trimStart: number;
  trimEnd: number;
  score?: number;
  attentionRole?: string;
  onRegenerate: () => void;
  onTrimChange: (start: number, end: number) => void;
  onApprove: () => void;
};

export function InlineVideoCard({
  sceneIndex,
  totalScenes,
  prompt,
  videoUrl,
  status,
  duration,
  trimStart,
  trimEnd,
  score,
  attentionRole,
  onRegenerate,
  onTrimChange,
  onApprove,
}: InlineVideoCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [showTrim, setShowTrim] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [approved, setApproved] = useState(false);
  const [localTrimStart, setLocalTrimStart] = useState(trimStart);
  const [localTrimEnd, setLocalTrimEnd] = useState(trimEnd);

  const isLoading = status === "generating" || status === "regenerating";
  const isReady = status === "ready" && videoUrl;

  // Sync local trim with props
  useEffect(() => {
    setLocalTrimStart(trimStart);
    setLocalTrimEnd(trimEnd);
  }, [trimStart, trimEnd]);

  function togglePlay() {
    if (!videoRef.current) return;
    if (playing) {
      videoRef.current.pause();
    } else {
      videoRef.current.currentTime = localTrimStart;
      videoRef.current.play();
    }
    setPlaying(!playing);
  }

  // Stop at trim end
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    function handleTimeUpdate() {
      if (video && video.currentTime >= localTrimEnd) {
        video.pause();
        setPlaying(false);
      }
    }
    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => video.removeEventListener("timeupdate", handleTimeUpdate);
  }, [localTrimEnd]);

  // Score color
  const scoreColor = score
    ? score >= 7 ? "text-emerald-400" : score >= 5 ? "text-amber-400" : "text-coral"
    : "text-ash";

  // Attention role label
  const roleLabels: Record<string, string> = {
    stimulation: "Stimulation",
    captivation: "Captivation",
    anticipation: "Anticipation",
    validation: "Validation",
    revelation: "Revelation",
  };

  return (
    <div className="rounded-xl border border-smoke/60 bg-slate/30 overflow-hidden transition-all duration-200">
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-3 py-2 hover:bg-slate/50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Film size={12} className="text-royal" />
          <span className="text-[11px] font-medium text-cloud">
            Scene {sceneIndex + 1}/{totalScenes}
          </span>
          {attentionRole && (
            <Badge variant="default" className="text-[8px] bg-royal/10 text-royal border-royal/20">
              {roleLabels[attentionRole] ?? attentionRole}
            </Badge>
          )}
          {isLoading && (
            <Loader2 size={11} className="animate-spin text-royal" />
          )}
          {isReady && score != null && (
            <span className={`text-[10px] font-mono ${scoreColor}`}>
              {score.toFixed(1)}/10
            </span>
          )}
          {approved && (
            <Badge variant="mint" className="text-[8px]">
              Approved
            </Badge>
          )}
        </div>
        {expanded ? <ChevronUp size={12} className="text-ash" /> : <ChevronDown size={12} className="text-ash" />}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-smoke/40">
          {/* Video preview */}
          {isReady ? (
            <div className="relative">
              <video
                ref={videoRef}
                src={videoUrl}
                className="w-full aspect-video bg-void"
                preload="metadata"
                playsInline
                muted
                onEnded={() => setPlaying(false)}
                onPause={() => setPlaying(false)}
                onPlay={() => setPlaying(true)}
              />
              {/* Play/Pause overlay */}
              {!playing && (
                <button
                  onClick={togglePlay}
                  className="absolute inset-0 flex items-center justify-center bg-void/30 hover:bg-void/20 transition-colors cursor-pointer"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-royal/90 shadow-lg">
                    <Play size={16} className="text-white ml-0.5" fill="white" />
                  </div>
                </button>
              )}
              {playing && (
                <button
                  onClick={togglePlay}
                  className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-void/70 hover:bg-void/90 transition-colors cursor-pointer"
                >
                  <Pause size={12} className="text-white" fill="white" />
                </button>
              )}
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center h-32 bg-void/30">
              <div className="flex flex-col items-center gap-2">
                <Loader2 size={20} className="animate-spin text-royal" />
                <span className="text-[10px] text-ash">
                  {status === "regenerating" ? "Regenerating..." : "Generating scene..."}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-20 bg-void/20">
              <span className="text-[10px] text-ash/50">Queued</span>
            </div>
          )}

          {/* Prompt text */}
          <div className="px-3 py-2">
            <p className="text-[10px] text-ash leading-relaxed line-clamp-2">{prompt}</p>
          </div>

          {/* Trim controls (collapsible) */}
          {isReady && showTrim && (
            <div className="px-3 pb-2 border-t border-smoke/30 pt-2">
              <div className="flex items-center gap-2 text-[9px] text-ash">
                <span>In:</span>
                <input
                  type="range"
                  min={0}
                  max={localTrimEnd - 0.1}
                  step={0.1}
                  value={localTrimStart}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setLocalTrimStart(v);
                    onTrimChange(v, localTrimEnd);
                  }}
                  className="flex-1 h-1 accent-royal"
                />
                <span>{localTrimStart.toFixed(1)}s</span>
              </div>
              <div className="flex items-center gap-2 text-[9px] text-ash mt-1">
                <span>Out:</span>
                <input
                  type="range"
                  min={localTrimStart + 0.1}
                  max={duration}
                  step={0.1}
                  value={localTrimEnd}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setLocalTrimEnd(v);
                    onTrimChange(localTrimStart, v);
                  }}
                  className="flex-1 h-1 accent-royal"
                />
                <span>{localTrimEnd.toFixed(1)}s</span>
              </div>
            </div>
          )}

          {/* Action buttons */}
          {isReady && (
            <div className="flex items-center gap-1.5 px-3 pb-2.5">
              <button
                onClick={onRegenerate}
                disabled={isLoading}
                className="flex items-center gap-1 rounded-lg bg-slate/80 px-2 py-1 text-[10px] text-ash hover:text-cloud hover:bg-smoke transition-colors cursor-pointer disabled:opacity-40"
              >
                <RefreshCw size={10} /> Regenerate
              </button>
              <button
                onClick={() => setShowTrim(!showTrim)}
                className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] transition-colors cursor-pointer ${
                  showTrim ? "bg-royal/10 text-royal" : "bg-slate/80 text-ash hover:text-cloud hover:bg-smoke"
                }`}
              >
                <Scissors size={10} /> Trim
              </button>
              {!approved ? (
                <button
                  onClick={() => { setApproved(true); onApprove(); }}
                  className="flex items-center gap-1 rounded-lg bg-emerald-600/80 px-2 py-1 text-[10px] text-white hover:bg-emerald-500 transition-colors cursor-pointer ml-auto"
                >
                  <Check size={10} /> Approve
                </button>
              ) : (
                <span className="flex items-center gap-1 ml-auto text-[10px] text-emerald-400">
                  <Check size={10} /> Approved
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// WHY: Renders the full scene set inline in chat — all scenes stacked with
// a stitch button at the bottom when all are approved.
type InlineVideoSetProps = {
  scenes: Array<{
    id: string;
    sceneIndex: number;
    prompt: string;
    videoUrl?: string;
    thumbnailUrl?: string;
    status: "draft" | "generating" | "ready" | "regenerating";
    duration: number;
    trimStart: number;
    trimEnd: number;
    score?: number;
    attentionRole?: string;
  }>;
  totalScenes: number;
  projectTitle: string;
  onRegenerate: (sceneId: string) => void;
  onTrimChange: (sceneId: string, start: number, end: number) => void;
  onStitch: () => void;
  onGenerateScore: () => void;
  stitchedUrl?: string | null;
  stitching?: boolean;
  generatingScore?: boolean;
};

export function InlineVideoSet({
  scenes,
  totalScenes,
  projectTitle,
  onRegenerate,
  onTrimChange,
  onStitch,
  onGenerateScore,
  stitchedUrl,
  stitching,
  generatingScore,
}: InlineVideoSetProps) {
  const [approvedScenes, setApprovedScenes] = useState<Set<string>>(new Set());
  const allReady = scenes.every((s) => s.status === "ready" && s.videoUrl);
  const allApproved = allReady && scenes.every((s) => approvedScenes.has(s.id));

  return (
    <div className="ml-11 mt-2.5 flex flex-col gap-2">
      {/* Project header */}
      <div className="flex items-center gap-2 px-1">
        <Film size={13} className="text-royal" />
        <span className="text-[11px] font-semibold text-cloud">{projectTitle}</span>
        <span className="text-[10px] text-ash">{scenes.length} scenes</span>
      </div>

      {/* Scene cards */}
      {scenes.map((scene) => (
        <InlineVideoCard
          key={scene.id}
          sceneIndex={scene.sceneIndex}
          totalScenes={totalScenes}
          prompt={scene.prompt}
          videoUrl={scene.videoUrl}
          thumbnailUrl={scene.thumbnailUrl}
          status={scene.status}
          duration={scene.duration}
          trimStart={scene.trimStart}
          trimEnd={scene.trimEnd}
          score={scene.score}
          attentionRole={scene.attentionRole}
          onRegenerate={() => onRegenerate(scene.id)}
          onTrimChange={(start, end) => onTrimChange(scene.id, start, end)}
          onApprove={() => setApprovedScenes((prev) => new Set(prev).add(scene.id))}
        />
      ))}

      {/* Stitch + audio controls — appear when all scenes are ready */}
      {allReady && (
        <div className="flex flex-wrap items-center gap-2 px-1 pt-1">
          {!stitchedUrl ? (
            <button
              onClick={onStitch}
              disabled={stitching}
              className="flex items-center gap-1.5 rounded-lg bg-royal px-3 py-1.5 text-[11px] font-medium text-white hover:bg-royal/80 transition-colors cursor-pointer disabled:opacity-50"
            >
              {stitching ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {stitching ? "Stitching..." : allApproved ? "Stitch & Export" : "Stitch Preview"}
            </button>
          ) : (
            <>
              {/* Stitched result */}
              <div className="w-full rounded-xl border border-emerald-500/30 bg-emerald-500/5 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-emerald-500/20">
                  <div className="flex items-center gap-2">
                    <Check size={12} className="text-emerald-400" />
                    <span className="text-[11px] font-medium text-emerald-400">Final Export</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={onGenerateScore}
                      disabled={generatingScore}
                      className="flex items-center gap-1 rounded-md bg-emerald-600/50 px-2 py-1 text-[9px] text-white hover:bg-emerald-500/60 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {generatingScore ? <Loader2 size={9} className="animate-spin" /> : <Music size={9} />}
                      {generatingScore ? "Scoring..." : "Generate Score"}
                    </button>
                    <button
                      onClick={async () => {
                        const res = await fetch(stitchedUrl);
                        const blob = await res.blob();
                        const a = document.createElement("a");
                        a.href = URL.createObjectURL(blob);
                        a.download = `${projectTitle || "export"}.mp4`;
                        a.click();
                        URL.revokeObjectURL(a.href);
                      }}
                      className="flex items-center gap-1 rounded-md bg-slate/60 px-2 py-1 text-[9px] text-cloud hover:bg-smoke transition-colors cursor-pointer"
                    >
                      <Download size={9} /> Download
                    </button>
                  </div>
                </div>
                <video
                  src={stitchedUrl}
                  controls
                  playsInline
                  className="w-full aspect-video"
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
