"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";
import type { VideoProject, VideoScene } from "@/types/canvas";

/* ─── Props ─────────────────────────────────────────────────────────── */

type TimelineViewProps = {
  project: VideoProject;
  selectedSceneId: string | null;
  onSelectScene: (id: string) => void;
};

/* ─── Component ─────────────────────────────────────────────────────── */

export function TimelineView({
  project,
  selectedSceneId,
  onSelectScene,
}: TimelineViewProps) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const totalDuration = project.scenes.reduce(
    (sum, s) => sum + (s.trimEnd - s.trimStart),
    0,
  );

  const selectedScene =
    project.scenes.find((s) => s.id === selectedSceneId) ?? project.scenes[0];

  /* Pre-compute scene start times on the global timeline */
  const sceneStartTimes: number[] = [];
  let accum = 0;
  for (const scene of project.scenes) {
    sceneStartTimes.push(accum);
    accum += scene.trimEnd - scene.trimStart;
  }

  /* Sync video element when selected scene changes */
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.pause();
      setPlaying(false);
      videoRef.current.currentTime = 0;
      const idx = project.scenes.findIndex((s) => s.id === selectedSceneId);
      if (idx >= 0) setCurrentTime(sceneStartTimes[idx]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSceneId]);

  /* Navigate scenes */
  const goToPrev = useCallback(() => {
    const idx = project.scenes.findIndex((s) => s.id === selectedSceneId);
    if (idx > 0) onSelectScene(project.scenes[idx - 1].id);
  }, [project.scenes, selectedSceneId, onSelectScene]);

  const goToNext = useCallback(() => {
    const idx = project.scenes.findIndex((s) => s.id === selectedSceneId);
    if (idx >= 0 && idx < project.scenes.length - 1)
      onSelectScene(project.scenes[idx + 1].id);
  }, [project.scenes, selectedSceneId, onSelectScene]);

  /* Play / Pause */
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (playing) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setPlaying(!playing);
  }, [playing]);

  /* Click on filmstrip to seek / select */
  const handleTrackClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!trackRef.current || totalDuration === 0) return;
      const rect = trackRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const targetTime = pct * totalDuration;

      // Find which scene that time falls in
      for (let i = 0; i < project.scenes.length; i++) {
        const sceneEnd =
          sceneStartTimes[i] +
          (project.scenes[i].trimEnd - project.scenes[i].trimStart);
        if (targetTime <= sceneEnd || i === project.scenes.length - 1) {
          onSelectScene(project.scenes[i].id);
          const offsetInScene = targetTime - sceneStartTimes[i];
          setCurrentTime(targetTime);
          if (videoRef.current) {
            videoRef.current.currentTime = offsetInScene;
          }
          break;
        }
      }
    },
    [totalDuration, project.scenes, sceneStartTimes, onSelectScene],
  );

  /* Time ruler tick count */
  const rulerTicks = Math.ceil(totalDuration) + 1;

  return (
    <div className="border-t border-smoke/60">
      {/* ── Preview Monitor ─────────────────────────────────── */}
      <div className="flex justify-center bg-void/80 px-5 py-4">
        <div className="relative w-full max-w-2xl aspect-video rounded-xl overflow-hidden bg-void border border-smoke/30">
          {selectedScene?.videoUrl ? (
            <video
              ref={videoRef}
              src={selectedScene.videoUrl}
              className="w-full h-full object-contain"
              onTimeUpdate={() => {
                if (videoRef.current) {
                  const sceneIdx = project.scenes.findIndex(
                    (s) => s.id === selectedSceneId,
                  );
                  setCurrentTime(
                    (sceneStartTimes[sceneIdx] ?? 0) +
                      videoRef.current.currentTime,
                  );
                }
              }}
              onEnded={() => {
                setPlaying(false);
                // Auto-advance to next scene
                goToNext();
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-ash/40 text-sm">
              Select a scene to preview
            </div>
          )}
        </div>
      </div>

      {/* ── Transport Controls ──────────────────────────────── */}
      <div className="flex items-center justify-center gap-4 px-5 py-2 bg-graphite border-t border-smoke/30">
        <button
          onClick={goToPrev}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-ash hover:text-cloud hover:bg-slate transition-colors cursor-pointer"
          title="Previous scene"
        >
          <SkipBack size={14} />
        </button>

        <button
          onClick={togglePlay}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-royal text-white hover:bg-royal/80 transition-colors cursor-pointer"
          title={playing ? "Pause" : "Play"}
        >
          {playing ? (
            <Pause size={16} />
          ) : (
            <Play size={16} className="ml-0.5" />
          )}
        </button>

        <button
          onClick={goToNext}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-ash hover:text-cloud hover:bg-slate transition-colors cursor-pointer"
          title="Next scene"
        >
          <SkipForward size={14} />
        </button>

        <span className="text-[11px] font-mono text-ash ml-2">
          {currentTime.toFixed(1)}s / {totalDuration.toFixed(1)}s
        </span>

        {/* Mini progress bar */}
        <div className="hidden sm:block w-32 h-1 rounded-full bg-smoke/40 ml-2 overflow-hidden">
          <div
            className="h-full bg-royal rounded-full transition-all duration-150"
            style={{
              width: totalDuration > 0
                ? `${(currentTime / totalDuration) * 100}%`
                : "0%",
            }}
          />
        </div>
      </div>

      {/* ── Filmstrip Timeline ──────────────────────────────── */}
      <div className="relative px-5 py-3 bg-graphite/50">
        {/* Time ruler */}
        <div className="relative h-4 mb-1">
          {Array.from({ length: rulerTicks }, (_, i) => (
            <span
              key={i}
              className="absolute text-[8px] font-mono text-ash/40 -translate-x-1/2"
              style={{
                left:
                  totalDuration > 0 ? `${(i / totalDuration) * 100}%` : "0%",
              }}
            >
              {i}s
            </span>
          ))}
        </div>

        {/* Video track */}
        <div
          ref={trackRef}
          onClick={handleTrackClick}
          className="relative flex h-14 rounded-lg overflow-hidden border border-smoke/40 mb-1 cursor-pointer"
        >
          {project.scenes.map((scene, i) => {
            const sceneDur = scene.trimEnd - scene.trimStart;
            const widthPct = totalDuration > 0 ? (sceneDur / totalDuration) * 100 : 0;
            const isSelected = scene.id === selectedSceneId;

            return (
              <button
                key={scene.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectScene(scene.id);
                }}
                className={`relative h-full overflow-hidden transition-all cursor-pointer ${
                  isSelected
                    ? "ring-2 ring-royal ring-inset"
                    : "hover:brightness-110"
                }`}
                style={{ width: `${widthPct}%` }}
              >
                {scene.videoUrl ? (
                  <video
                    src={scene.videoUrl}
                    className="w-full h-full object-cover pointer-events-none"
                    muted
                    preload="metadata"
                  />
                ) : (
                  <div className="w-full h-full bg-slate/40" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-void/60 via-transparent to-transparent" />
                <span className="absolute bottom-1 left-1.5 text-[9px] font-mono text-white/80">
                  S{i + 1}
                </span>
                {i < project.scenes.length - 1 && (
                  <div className="absolute right-0 top-0 bottom-0 w-px bg-smoke/60" />
                )}
              </button>
            );
          })}

          {/* Playhead */}
          {totalDuration > 0 && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-royal pointer-events-none z-10"
              style={{ left: `${(currentTime / totalDuration) * 100}%` }}
            >
              {/* Playhead top marker */}
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-royal rounded-full" />
            </div>
          )}
        </div>

        {/* Audio track */}
        <div className="flex h-8 rounded-lg overflow-hidden border border-smoke/40 bg-void/40">
          {project.audioUrl ? (
            <div className="w-full h-full flex items-center px-2">
              <div className="w-full h-4 bg-emerald-500/20 rounded-sm relative overflow-hidden">
                {/* Waveform visualization placeholder */}
                <div className="flex items-center h-full gap-px px-1">
                  {Array.from({ length: 60 }, (_, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-emerald-400/60 rounded-sm"
                      style={{
                        height: `${20 + Math.sin(i * 0.5) * 30 + Math.sin(i * 1.3) * 25 + 25}%`,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[9px] text-ash/30 font-mono">
              No audio track
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
