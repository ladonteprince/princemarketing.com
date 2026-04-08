"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Music, Play, Pause, Loader2 } from "lucide-react";

// WHY: Inline track picker for the score-first production flow. When the AI
// emits CREATE_SCORE with 3 track options, Lyria fires in parallel and the
// results stream back as a row of cards. Each card has an inline play button
// and a Select button — the chosen track becomes the project's timeline
// skeleton. Mirrors the InlineProductPicker UX so the whole chat feels
// consistent.

export type TrackOption = {
  id: string;
  prompt: string;
  genre?: string;
  bpm?: number;
  duration: number;
  audioUrl?: string;
  status: "generating" | "ready" | "failed";
};

type InlineTrackPickerProps = {
  videoProjectId: string;
  tracks: TrackOption[];
  onSelect: (track: TrackOption) => Promise<void> | void;
};

export default function InlineTrackPicker({
  videoProjectId: _videoProjectId,
  tracks,
  onSelect,
}: InlineTrackPickerProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  // WHY: The onSelect path has two distinct phases the user should see:
  // (1) Gemini audio analysis extracting real section markers (~8-20s),
  // (2) canvas dispatch locking the timeline (instant). Without distinct
  // labels the wait feels like nothing is happening. Tracked in a small
  // state machine so the button text can swap between phases.
  const [selectStage, setSelectStage] = useState<"analyzing" | "locking">("analyzing");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // WHY: Stop any in-flight preview when the picker unmounts (navigation,
  // chat clear, message re-render). Without this, the Audio element keeps
  // playing until GC — awkward during demos and easy to miss in testing.
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
    };
  }, []);

  const handlePlay = (track: TrackOption) => {
    if (!track.audioUrl) return;
    // Stop whatever is playing first
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (playingId === track.id) {
      setPlayingId(null);
      return;
    }
    const audio = new Audio(track.audioUrl);
    audio.addEventListener("ended", () => setPlayingId(null));
    audio.play().catch((err) => {
      console.warn("[InlineTrackPicker] play failed:", err);
      setPlayingId(null);
    });
    audioRef.current = audio;
    setPlayingId(track.id);
  };

  const handleSelect = async (track: TrackOption) => {
    if (adding || selectedId || track.status !== "ready") return;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setPlayingId(null);
    }
    setSelectedId(track.id);
    setAdding(true);
    setSelectStage("analyzing");
    // WHY: Most of the onSelect wall-clock is the Gemini audio analyzer.
    // We don't have a hook into its completion, so we flip the label to
    // "locking" after a fixed delay that roughly matches analyzer median
    // latency. Either phase may linger briefly — good enough to make the
    // UI feel alive instead of frozen.
    const lockTimer = setTimeout(() => setSelectStage("locking"), 9_000);
    try {
      await onSelect(track);
    } finally {
      clearTimeout(lockTimer);
      setAdding(false);
    }
  };

  if (!tracks || tracks.length === 0) {
    return (
      <div className="ml-11 mt-2">
        <div className="flex items-center gap-2 text-xs text-ash/70">
          <Music className="h-3.5 w-3.5" />
          <span>No track options generated</span>
        </div>
      </div>
    );
  }

  return (
    <div className="ml-11 mt-2">
      <div className="mb-2 flex items-center gap-2">
        <Music className="h-3.5 w-3.5 text-ash" />
        <span className="text-xs text-cloud">
          Score options
        </span>
        <span className="text-[10px] text-ash/60">
          pick the track that sets the timeline
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {tracks.map((track) => {
          const isSelected = selectedId === track.id;
          const isPlaying = playingId === track.id;
          const isDisabled = selectedId !== null && !isSelected;
          const isAddingThis = isSelected && adding;
          const isAddedThis = isSelected && !adding;
          const isFailed = track.status === "failed";

          return (
            <div
              key={track.id}
              className={[
                "group relative flex flex-col gap-2 rounded-xl border bg-graphite p-3 transition-all",
                isSelected
                  ? "border-emerald-500/60 bg-emerald-500/5"
                  : "border-smoke hover:border-royal hover:bg-royal/10",
                isDisabled || isFailed ? "opacity-50" : "",
              ].join(" ")}
            >
              <div className="flex items-start gap-2">
                <button
                  type="button"
                  onClick={() => handlePlay(track)}
                  disabled={!track.audioUrl || isFailed}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-royal/20 text-royal transition-colors hover:bg-royal/30 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={isPlaying ? "Pause track" : "Play track"}
                >
                  {isPlaying ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="ml-0.5 h-4 w-4" />
                  )}
                </button>
                <div className="flex min-w-0 flex-col">
                  <div className="truncate text-xs font-medium text-cloud">
                    {track.genre ?? "Score"}
                    {track.bpm ? ` · ${track.bpm} BPM` : ""}
                  </div>
                  <div className="truncate text-[10px] text-ash/70">
                    {track.duration}s
                  </div>
                </div>
              </div>

              <div
                className="text-[11px] leading-snug text-ash"
                style={{
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
                title={track.prompt}
              >
                {track.prompt}
              </div>

              <button
                type="button"
                onClick={() => handleSelect(track)}
                disabled={isDisabled || adding || isAddedThis || isFailed}
                className={[
                  "flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors",
                  isAddedThis
                    ? "bg-emerald-500 text-white"
                    : "bg-royal text-white hover:bg-royal/80",
                  isDisabled || isFailed ? "cursor-not-allowed" : "",
                ].join(" ")}
              >
                {isAddingThis ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {selectStage === "analyzing"
                      ? "Analyzing beats..."
                      : "Locking timeline..."}
                  </>
                ) : isAddedThis ? (
                  <>
                    <Check className="h-3 w-3" />
                    Selected
                  </>
                ) : isFailed ? (
                  "Generation failed"
                ) : (
                  "Use this track"
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
