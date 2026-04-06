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
  X,
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
  // WHY: Step Mode shows the Reject button and unlocks the auto-advance behavior.
  // In Auto Mode, the reject UI is hidden because there's no per-scene gating.
  stepMode?: boolean;
  // WHY: Live progress + ETA. Updated by the ChatPanel from SSE events
  // emitted during Seedance generation. The card extrapolates remaining
  // time from progress vs elapsed.
  progress?: number; // 0-100
  progressStage?: string;
  progressStartedAt?: number; // Date.now() when generation started
  onRegenerate: () => void;
  onRegenerateWithFeedback?: (feedback: string) => void;
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
  stepMode = false,
  progress,
  progressStage,
  progressStartedAt,
  onRegenerate,
  onRegenerateWithFeedback,
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
  // WHY: Step Mode reject + feedback flow. Type what's wrong → AI revises
  // the prompt → scene regenerates with the feedback baked in.
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  const isLoading = status === "generating" || status === "regenerating";
  const isReady = status === "ready" && videoUrl;

  // WHY: Synthetic tick for the progress bar — even when SSE events are
  // sparse (Seedance only emits ~5 progress events over 90s), the bar
  // animates smoothly via this 250ms interpolation. Combines real progress
  // (priority) with a time-based fallback baseline.
  const [syntheticProgress, setSyntheticProgress] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    if (!isLoading) {
      setSyntheticProgress(0);
      setElapsedSec(0);
      return;
    }
    // Baseline: assume ~90s for a 5s clip, ~150s for 10s, ~210s for 15s
    // (real Seedance times — used for the synthetic fallback only)
    const baselineMs = 60_000 + duration * 6_000;
    const startedAt = progressStartedAt ?? Date.now();

    const tick = () => {
      const elapsed = Date.now() - startedAt;
      const elapsedSeconds = Math.floor(elapsed / 1000);
      setElapsedSec(elapsedSeconds);
      // Synthetic curve: ease toward 92% (never hit 100% via clock alone —
      // real completion comes from the SSE event)
      const fraction = Math.min(0.92, 1 - Math.exp(-elapsed / baselineMs));
      setSyntheticProgress(Math.round(fraction * 100));
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [isLoading, duration, progressStartedAt]);

  // Real progress takes priority over synthetic. Only use synthetic if real is missing.
  const displayProgress = progress != null && progress > 0 ? progress : syntheticProgress;

  // ETA extrapolation: at low progress use the baseline, at higher progress
  // extrapolate linearly from the actual elapsed/percent ratio.
  let etaSeconds: number | null = null;
  if (isLoading && displayProgress > 5 && displayProgress < 100) {
    if (progress != null && progress > 5 && progressStartedAt) {
      // Real-progress extrapolation: elapsed * (100/progress - 1)
      const elapsed = (Date.now() - progressStartedAt) / 1000;
      etaSeconds = Math.max(1, Math.round(elapsed * (100 / progress - 1)));
    } else {
      // Synthetic baseline ETA
      const totalEstimated = 60 + duration * 6;
      etaSeconds = Math.max(1, totalEstimated - elapsedSec);
    }
  }

  function formatEta(s: number | null): string {
    if (s == null) return "";
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const r = s % 60;
    return r === 0 ? `${m}m` : `${m}m ${r}s`;
  }

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
            <div className="flex flex-col items-center justify-center h-32 bg-void/40 px-6 gap-3">
              {/* Stage label + percentage row */}
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <Loader2 size={12} className="animate-spin text-royal" />
                  <span className="text-[10px] text-cloud font-medium">
                    {status === "regenerating" ? "Regenerating" : "Generating"}
                    {progressStage ? ` — ${progressStage}` : ""}
                  </span>
                </div>
                <span className="text-[11px] font-mono font-semibold text-royal tabular-nums">
                  {displayProgress}%
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-1.5 rounded-full bg-slate/60 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-royal/80 via-royal to-royal-hover shadow-[0_0_8px_rgba(99,102,241,0.4)] transition-all duration-300 ease-out"
                  style={{ width: `${displayProgress}%` }}
                />
              </div>

              {/* ETA + elapsed */}
              <div className="flex items-center justify-between w-full text-[9px] text-ash/70 font-mono tabular-nums">
                <span>{elapsedSec}s elapsed</span>
                {etaSeconds != null && (
                  <span>~{formatEta(etaSeconds)} remaining</span>
                )}
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
            <div className="flex items-center gap-1.5 px-3 pb-2.5 flex-wrap">
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
              {/* Reject — only in Step Mode (gives feedback to revise the prompt) */}
              {stepMode && onRegenerateWithFeedback && !approved && (
                <button
                  onClick={() => setShowFeedback((v) => !v)}
                  className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] transition-colors cursor-pointer ${
                    showFeedback ? "bg-coral/15 text-coral" : "bg-slate/80 text-ash hover:text-coral hover:bg-coral/10"
                  }`}
                >
                  <X size={10} /> Reject
                </button>
              )}
              {!approved ? (
                <button
                  onClick={() => { setApproved(true); onApprove(); }}
                  className="flex items-center gap-1 rounded-lg bg-emerald-600/80 px-2 py-1 text-[10px] text-white hover:bg-emerald-500 transition-colors cursor-pointer ml-auto"
                >
                  <Check size={10} /> {stepMode ? "Approve & Next" : "Approve"}
                </button>
              ) : (
                <span className="flex items-center gap-1 ml-auto text-[10px] text-emerald-400">
                  <Check size={10} /> Approved
                </span>
              )}
            </div>
          )}

          {/* Feedback input — appears below action buttons when Reject is clicked */}
          {showFeedback && stepMode && onRegenerateWithFeedback && (
            <div className="px-3 pb-3 border-t border-coral/20 pt-2">
              <div className="text-[9px] uppercase tracking-wider text-coral/70 font-medium mb-1.5">
                What's wrong with this scene?
              </div>
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="e.g. too dark, wrong angle, make him smile, slower motion..."
                rows={2}
                disabled={submittingFeedback}
                className="w-full rounded-lg bg-void/60 border border-coral/20 px-2 py-1.5 text-[11px] text-cloud placeholder:text-ash/40 outline-none focus:border-coral/50 resize-none"
              />
              <div className="flex items-center gap-1.5 mt-1.5">
                <button
                  onClick={async () => {
                    if (!feedbackText.trim() || !onRegenerateWithFeedback) return;
                    setSubmittingFeedback(true);
                    try {
                      await onRegenerateWithFeedback(feedbackText.trim());
                      setShowFeedback(false);
                      setFeedbackText("");
                    } finally {
                      setSubmittingFeedback(false);
                    }
                  }}
                  disabled={!feedbackText.trim() || submittingFeedback}
                  className="flex items-center gap-1 rounded-lg bg-coral/80 px-2 py-1 text-[10px] text-white hover:bg-coral transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {submittingFeedback ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                  {submittingFeedback ? "Revising..." : "Submit & Regenerate"}
                </button>
                <button
                  onClick={() => { setShowFeedback(false); setFeedbackText(""); }}
                  disabled={submittingFeedback}
                  className="text-[10px] text-ash hover:text-cloud cursor-pointer disabled:opacity-40"
                >
                  Cancel
                </button>
              </div>
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
    progress?: number;
    progressStage?: string;
    progressStartedAt?: number;
  }>;
  totalScenes: number;
  projectTitle: string;
  stepMode?: boolean;
  onRegenerate: (sceneId: string) => void;
  onRegenerateWithFeedback?: (sceneId: string, feedback: string) => Promise<void>;
  onApproveScene?: (sceneId: string) => void;
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
  stepMode = false,
  onRegenerate,
  onRegenerateWithFeedback,
  onApproveScene,
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
          stepMode={stepMode}
          progress={scene.progress}
          progressStage={scene.progressStage}
          progressStartedAt={scene.progressStartedAt}
          onRegenerate={() => onRegenerate(scene.id)}
          onRegenerateWithFeedback={
            onRegenerateWithFeedback
              ? (feedback) => onRegenerateWithFeedback(scene.id, feedback)
              : undefined
          }
          onTrimChange={(start, end) => onTrimChange(scene.id, start, end)}
          onApprove={() => {
            setApprovedScenes((prev) => new Set(prev).add(scene.id));
            // In Step Mode, approval triggers the next scene generation
            onApproveScene?.(scene.id);
          }}
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
