"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Mic, Square, Play, RotateCcw, Check, X } from "lucide-react";

/* ─── Types ────────────────────────────────────────────────────────── */

type ScriptLine = {
  startTime: number;
  endTime: number;
  text: string;
};

type KaraokeRecorderProps = {
  videoUrl: string;
  script: Array<ScriptLine>;
  onRecordingComplete: (audioBlob: Blob, audioUrl: string) => void;
  onClose: () => void;
};

/* ─── State Machine ────────────────────────────────────────────────── */

type RecorderState =
  | "idle"
  | "countdown"
  | "recording"
  | "recorded"
  | "previewing";

/* ─── Helpers ──────────────────────────────────────────────────────── */

function getWordsForLine(line: ScriptLine) {
  const words = line.text.split(/\s+/);
  const duration = line.endTime - line.startTime;
  const wordDuration = duration / words.length;
  return words.map((word, i) => ({
    word,
    start: line.startTime + i * wordDuration,
    end: line.startTime + (i + 1) * wordDuration,
  }));
}

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
  if (MediaRecorder.isTypeSupported("audio/ogg")) return "audio/ogg";
  return "audio/webm";
}

/* ─── Component ────────────────────────────────────────────────────── */

export function KaraokeRecorder({
  videoUrl,
  script,
  onRecordingComplete,
  onClose,
}: KaraokeRecorderProps) {
  /* ── Refs ── */
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioPreviewRef = useRef<HTMLAudioElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const rafRef = useRef<number>(0);
  const blobUrlRef = useRef<string | null>(null);

  /* ── State ── */
  const [state, setState] = useState<RecorderState>("idle");
  const [currentTime, setCurrentTime] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [micError, setMicError] = useState<string | null>(null);

  /* ── Derived ── */
  const totalDuration = useMemo(
    () => (script.length > 0 ? script[script.length - 1].endTime : 0),
    [script],
  );

  const currentLineIndex = useMemo(() => {
    for (let i = 0; i < script.length; i++) {
      if (currentTime >= script[i].startTime && currentTime < script[i].endTime)
        return i;
    }
    // If between lines, show the next upcoming line
    for (let i = 0; i < script.length; i++) {
      if (currentTime < script[i].startTime) return i;
    }
    return script.length - 1;
  }, [currentTime, script]);

  /* ── Cleanup on unmount ── */
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  /* ── Time tracking loop ── */
  const startTimeTracking = useCallback(() => {
    const tick = () => {
      if (videoRef.current) {
        setCurrentTime(videoRef.current.currentTime);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const stopTimeTracking = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
  }, []);

  /* ── Mic access ── */
  const getMicStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setMicError(null);
      return stream;
    } catch {
      setMicError(
        "Microphone access denied. Please allow mic access in your browser settings and try again.",
      );
      return null;
    }
  }, []);

  /* ── Countdown then record ── */
  const startCountdown = useCallback(async () => {
    const stream = await getMicStream();
    if (!stream) return;

    setState("countdown");
    setCountdown(3);

    let count = 3;
    const interval = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        clearInterval(interval);
        beginRecording(stream);
      } else {
        setCountdown(count);
      }
    }, 1000);
  }, [getMicStream]);

  /* ── Begin recording ── */
  const beginRecording = useCallback(
    (stream: MediaStream) => {
      // Reset
      chunksRef.current = [];
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setAudioBlob(blob);
        setState("recorded");
        stopTimeTracking();
      };

      recorder.start(250); // collect in 250ms chunks
      setState("recording");
      setCurrentTime(0);

      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.muted = true;
        videoRef.current.play();
      }

      startTimeTracking();
    },
    [startTimeTracking, stopTimeTracking],
  );

  /* ── Stop recording ── */
  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop();
    }
    if (videoRef.current) {
      videoRef.current.pause();
    }
    stopTimeTracking();
  }, [stopTimeTracking]);

  /* ── Video ended → auto-stop ── */
  const handleVideoEnded = useCallback(() => {
    if (state === "recording") {
      stopRecording();
    }
  }, [state, stopRecording]);

  /* ── Preview ── */
  const startPreview = useCallback(() => {
    if (!blobUrlRef.current || !videoRef.current) return;
    setState("previewing");
    setCurrentTime(0);

    videoRef.current.currentTime = 0;
    videoRef.current.muted = true;
    videoRef.current.play();

    if (audioPreviewRef.current) {
      audioPreviewRef.current.src = blobUrlRef.current;
      audioPreviewRef.current.currentTime = 0;
      audioPreviewRef.current.play();
    }

    startTimeTracking();
  }, [startTimeTracking]);

  const stopPreview = useCallback(() => {
    if (videoRef.current) videoRef.current.pause();
    if (audioPreviewRef.current) audioPreviewRef.current.pause();
    stopTimeTracking();
    setState("recorded");
  }, [stopTimeTracking]);

  /* ── Re-record ── */
  const reRecord = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setAudioBlob(null);
    setCurrentTime(0);
    setState("idle");
  }, []);

  /* ── Save ── */
  const save = useCallback(() => {
    if (audioBlob && blobUrlRef.current) {
      onRecordingComplete(audioBlob, blobUrlRef.current);
    }
  }, [audioBlob, onRecordingComplete]);

  /* ── Preview video ended ── */
  const handlePreviewVideoEnded = useCallback(() => {
    if (state === "previewing") {
      stopPreview();
    }
  }, [state, stopPreview]);

  /* ── Render helpers ── */
  const progressPercent =
    totalDuration > 0 ? Math.min((currentTime / totalDuration) * 100, 100) : 0;

  const isActive = state === "recording" || state === "previewing";

  return (
    <div className="flex w-full flex-col gap-4 rounded-xl border border-smoke bg-graphite p-4">
      {/* ── Close button ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mic className="h-4 w-4 text-royal" />
          <span className="text-sm font-medium text-cloud">
            Voiceover Recorder
          </span>
          {state === "recording" && (
            <Badge variant="coral">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-400 mr-1" />
              REC
            </Badge>
          )}
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1.5 text-ash hover:bg-smoke hover:text-cloud transition-colors"
          aria-label="Close recorder"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* ── Video player ── */}
      <div className="relative w-full overflow-hidden rounded-lg bg-black aspect-video">
        <video
          ref={videoRef}
          src={videoUrl}
          className="h-full w-full object-contain"
          playsInline
          muted
          onEnded={state === "previewing" ? handlePreviewVideoEnded : handleVideoEnded}
        />

        {/* Countdown overlay */}
        {state === "countdown" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <span className="text-7xl font-bold text-cloud animate-pulse">
              {countdown}
            </span>
          </div>
        )}
      </div>

      {/* ── Karaoke text area ── */}
      <div className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-lg border border-smoke bg-slate px-4 py-6 md:min-h-[140px]">
        {script.length === 0 ? (
          <p className="text-sm text-ash">No script lines loaded.</p>
        ) : (
          <>
            {/* Previous line (fading out) */}
            {currentLineIndex > 0 && isActive && (
              <p className="text-xs text-ash/30 transition-opacity">
                {script[currentLineIndex - 1].text}
              </p>
            )}

            {/* Current line — word-by-word highlighting */}
            <p className="text-center text-2xl leading-relaxed md:text-2xl">
              {getWordsForLine(script[currentLineIndex]).map((w, i) => {
                let colorClass = "text-ash/40"; // future
                if (isActive) {
                  if (currentTime >= w.end) colorClass = "text-royal"; // past
                  else if (currentTime >= w.start)
                    colorClass = "text-cloud font-bold"; // current
                } else {
                  colorClass = "text-ash/60"; // inactive — all dim
                }
                return (
                  <span
                    key={`${currentLineIndex}-${i}`}
                    className={`${colorClass} transition-colors duration-150`}
                  >
                    {w.word}{" "}
                  </span>
                );
              })}
            </p>

            {/* Next line preview */}
            {currentLineIndex < script.length - 1 && (
              <p className="text-sm text-ash/60">
                {script[currentLineIndex + 1].text}
              </p>
            )}
          </>
        )}
      </div>

      {/* ── Progress bar ── */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-smoke">
        <div
          className="h-full rounded-full bg-royal transition-[width] duration-200"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* ── Mic error ── */}
      {micError && (
        <div className="rounded-md border border-coral/30 bg-coral/10 px-3 py-2 text-sm text-coral">
          {micError}
        </div>
      )}

      {/* ── Transport controls ── */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {/* idle state — show Record */}
        {state === "idle" && (
          <button
            onClick={startCountdown}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-coral text-white shadow-lg hover:bg-red-500 active:scale-95 transition-all md:h-16 md:w-16"
            aria-label="Start recording"
          >
            <Mic className="h-6 w-6 md:h-7 md:w-7" />
          </button>
        )}

        {/* countdown — disabled record */}
        {state === "countdown" && (
          <button
            disabled
            className="flex h-14 w-14 items-center justify-center rounded-full bg-coral/50 text-white/50 md:h-16 md:w-16 cursor-not-allowed"
            aria-label="Recording starting"
          >
            <Mic className="h-6 w-6 md:h-7 md:w-7" />
          </button>
        )}

        {/* recording — show Stop */}
        {state === "recording" && (
          <button
            onClick={stopRecording}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-coral text-white shadow-lg hover:bg-red-500 active:scale-95 transition-all md:h-16 md:w-16"
            aria-label="Stop recording"
          >
            <Square className="h-6 w-6 md:h-7 md:w-7" />
          </button>
        )}

        {/* recorded — Preview, Re-record, Save */}
        {state === "recorded" && (
          <>
            <Button variant="ghost" size="md" icon={<RotateCcw className="h-4 w-4" />} onClick={reRecord}>
              Re-record
            </Button>
            <button
              onClick={startPreview}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-royal text-white shadow-lg hover:bg-royal-hover active:scale-95 transition-all md:h-16 md:w-16"
              aria-label="Play preview"
            >
              <Play className="h-6 w-6 md:h-7 md:w-7" />
            </button>
            <Button variant="primary" size="md" icon={<Check className="h-4 w-4" />} onClick={save}>
              Save
            </Button>
          </>
        )}

        {/* previewing — show Stop preview */}
        {state === "previewing" && (
          <button
            onClick={stopPreview}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-smoke text-cloud shadow-lg hover:bg-ash/30 active:scale-95 transition-all md:h-16 md:w-16"
            aria-label="Stop preview"
          >
            <Square className="h-6 w-6 md:h-7 md:w-7" />
          </button>
        )}
      </div>

      {/* Hidden audio element for preview playback */}
      <audio ref={audioPreviewRef} className="hidden" />
    </div>
  );
}
