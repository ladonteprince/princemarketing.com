"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Sparkles, Check, Loader2, ArrowLeft, Play, Pause } from "lucide-react";

// WHY: Voiceover fork picker. After the score is locked, the AI drafts a
// timestamped script and this component presents the user with the two
// paths: record yourself (karaoke) or pick an ElevenLabs voice. Both
// produce a voiceoverUrl on the project that the final stitch layers
// over the music bed.

// Mirror of the .ai voice presets. Keep in sync with /api/v1/generate/voiceover.
export const VOICE_PRESETS = [
  {
    id: "21m00Tcm4TlvDq8ikWAM",
    name: "Rachel",
    description: "Warm, conversational, trustworthy",
    bestFor: "Luxury lifestyle, DTC, female narrator",
  },
  {
    id: "pNInz6obpgDQGcFmaJgB",
    name: "Adam",
    description: "Deep, authoritative, cinematic",
    bestFor: "Finance, sports, masculine brands",
  },
  {
    id: "AZnzlk1XvdvUeBnXmlld",
    name: "Domi",
    description: "Intimate, sultry, close-miked",
    bestFor: "Beauty, romance, after-dark",
  },
] as const;

export type VoiceoverScriptEntry = {
  startTime: number;
  endTime: number;
  text: string;
};

type InlineVoiceoverPickerProps = {
  videoProjectId: string;
  script: VoiceoverScriptEntry[];
  recommendedVoiceId?: string;
  onRecordKaraoke: () => void;
  onGenerateAiVoice: (voiceId: string) => Promise<void>;
};

export default function InlineVoiceoverPicker({
  videoProjectId: _videoProjectId,
  script,
  recommendedVoiceId,
  onRecordKaraoke,
  onGenerateAiVoice,
}: InlineVoiceoverPickerProps) {
  const [mode, setMode] = useState<"choose" | "pickVoice">("choose");
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [resolvedPath, setResolvedPath] = useState<"karaoke" | "ai" | null>(null);

  // WHY: Voice sample preview. Each voice card has a tiny play button that
  // streams a fixed sample phrase from /api/generate/voice-sample. We cache
  // the streaming URL in component state so repeat-clicks don't hit the API
  // again. Only one sample plays at a time — clicking another voice stops
  // the current preview. On unmount we pause and release the audio element.
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const sampleAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (sampleAudioRef.current) {
        sampleAudioRef.current.pause();
        sampleAudioRef.current.src = "";
        sampleAudioRef.current = null;
      }
    };
  }, []);

  const handlePreview = (voiceId: string) => {
    // Stop any preview in flight
    if (sampleAudioRef.current) {
      sampleAudioRef.current.pause();
      sampleAudioRef.current = null;
    }
    if (playingVoiceId === voiceId) {
      setPlayingVoiceId(null);
      return;
    }
    // The API route handles its own cache headers (max-age=86400) so
    // the browser will reuse the bytes on repeat plays for free.
    const audio = new Audio(`/api/generate/voice-sample?voiceId=${voiceId}`);
    audio.addEventListener("ended", () => setPlayingVoiceId(null));
    audio.addEventListener("error", () => {
      console.warn("[VoiceoverPicker] sample load failed");
      setPlayingVoiceId(null);
    });
    audio.play().catch((err) => {
      console.warn("[VoiceoverPicker] sample play failed:", err);
      setPlayingVoiceId(null);
    });
    sampleAudioRef.current = audio;
    setPlayingVoiceId(voiceId);
  };

  const handleKaraoke = () => {
    if (resolvedPath) return;
    setResolvedPath("karaoke");
    onRecordKaraoke();
  };

  const handleAiVoice = async (voiceId: string) => {
    if (generating || resolvedPath) return;
    // Stop any sample preview before committing — the user is past audition.
    if (sampleAudioRef.current) {
      sampleAudioRef.current.pause();
      sampleAudioRef.current = null;
      setPlayingVoiceId(null);
    }
    setSelectedVoiceId(voiceId);
    setGenerating(true);
    try {
      await onGenerateAiVoice(voiceId);
      setResolvedPath("ai");
    } catch (err) {
      console.warn("[InlineVoiceoverPicker] ai voice failed:", err);
    } finally {
      setGenerating(false);
    }
  };

  const totalDuration =
    script.length > 0 ? script[script.length - 1].endTime : 0;

  return (
    <div className="ml-11 mt-2 rounded-xl border border-smoke bg-graphite p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mic className="h-3.5 w-3.5 text-ash" />
          <span className="text-xs text-cloud">Voiceover</span>
          <span className="text-[10px] text-ash/60">
            {script.length} line{script.length === 1 ? "" : "s"} · {totalDuration.toFixed(1)}s
          </span>
        </div>
        {mode === "pickVoice" && !resolvedPath && (
          <button
            type="button"
            onClick={() => setMode("choose")}
            className="flex items-center gap-1 text-[10px] text-ash hover:text-cloud"
          >
            <ArrowLeft className="h-3 w-3" />
            Back
          </button>
        )}
      </div>

      {/* Draft script preview */}
      <details className="mb-3 rounded-md border border-smoke/60 bg-black/30 p-2 text-[11px] text-ash">
        <summary className="cursor-pointer text-ash/80">
          Preview draft script
        </summary>
        <div className="mt-2 flex flex-col gap-1.5">
          {script.map((line, i) => (
            <div key={i} className="flex gap-2">
              <span className="shrink-0 font-mono text-[10px] text-ash/50">
                {line.startTime.toFixed(1)}–{line.endTime.toFixed(1)}s
              </span>
              <span className="text-cloud">{line.text}</span>
            </div>
          ))}
        </div>
      </details>

      {/* Top-level choice */}
      {mode === "choose" && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={handleKaraoke}
            disabled={!!resolvedPath}
            className={[
              "group flex flex-col gap-1 rounded-xl border bg-graphite/60 p-3 text-left transition-all disabled:cursor-not-allowed",
              resolvedPath === "karaoke"
                ? "border-emerald-500/60 bg-emerald-500/5"
                : "border-smoke hover:border-royal hover:bg-royal/10",
            ].join(" ")}
          >
            <div className="flex items-center gap-2">
              <Mic className="h-4 w-4 text-royal" />
              <span className="text-xs font-medium text-cloud">
                Record it yourself
              </span>
              {resolvedPath === "karaoke" && (
                <Check className="ml-auto h-3.5 w-3.5 text-emerald-400" />
              )}
            </div>
            <div className="text-[11px] text-ash">
              Opens the karaoke recorder with the script timed to the track.
              Your voice, your performance.
            </div>
          </button>

          <button
            type="button"
            onClick={() => setMode("pickVoice")}
            disabled={!!resolvedPath}
            className={[
              "group flex flex-col gap-1 rounded-xl border bg-graphite/60 p-3 text-left transition-all disabled:cursor-not-allowed",
              resolvedPath === "ai"
                ? "border-emerald-500/60 bg-emerald-500/5"
                : "border-smoke hover:border-royal hover:bg-royal/10",
            ].join(" ")}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-royal" />
              <span className="text-xs font-medium text-cloud">
                Generate AI voiceover
              </span>
              {resolvedPath === "ai" && (
                <Check className="ml-auto h-3.5 w-3.5 text-emerald-400" />
              )}
            </div>
            <div className="text-[11px] text-ash">
              Pick from 3 pro voices. Generated in seconds. Perfect for brand
              work where consistency matters.
            </div>
          </button>
        </div>
      )}

      {/* Voice picker (sub-mode) */}
      {mode === "pickVoice" && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {VOICE_PRESETS.map((voice) => {
            const isRecommended = recommendedVoiceId === voice.id;
            const isSelected = selectedVoiceId === voice.id;
            const isDisabled =
              (generating && !isSelected) || !!resolvedPath;

            return (
              <button
                key={voice.id}
                type="button"
                onClick={() => handleAiVoice(voice.id)}
                disabled={isDisabled}
                className={[
                  "relative flex flex-col gap-1 rounded-xl border bg-graphite/60 p-3 text-left transition-all disabled:cursor-not-allowed",
                  isSelected && generating
                    ? "border-royal/60 bg-royal/10"
                    : isSelected && resolvedPath === "ai"
                      ? "border-emerald-500/60 bg-emerald-500/5"
                      : "border-smoke hover:border-royal hover:bg-royal/10",
                ].join(" ")}
              >
                {isRecommended && (
                  <span className="absolute right-2 top-2 rounded-full bg-royal/20 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-royal">
                    Recommended
                  </span>
                )}
                {/* Preview button — streams a fixed sample from ElevenLabs
                    so the user can hear the voice before committing. Uses
                    role=button instead of <button> to avoid nesting inside
                    the parent button. stopPropagation prevents bubbling. */}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handlePreview(voice.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      handlePreview(voice.id);
                    }
                  }}
                  aria-label={`Preview ${voice.name}`}
                  className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-royal/20 text-royal transition-colors hover:bg-royal/40"
                >
                  {playingVoiceId === voice.id ? (
                    <Pause className="h-3 w-3" />
                  ) : (
                    <Play className="ml-0.5 h-3 w-3" />
                  )}
                </span>
                <div className="mt-6 text-xs font-medium text-cloud">
                  {voice.name}
                </div>
                <div className="text-[11px] text-ash">{voice.description}</div>
                <div className="text-[10px] text-ash/60">{voice.bestFor}</div>
                <div className="mt-1 flex items-center gap-1 text-[10px]">
                  {isSelected && generating && (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin text-royal" />
                      <span className="text-royal">Generating...</span>
                    </>
                  )}
                  {isSelected && resolvedPath === "ai" && (
                    <>
                      <Check className="h-3 w-3 text-emerald-400" />
                      <span className="text-emerald-400">Added</span>
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
