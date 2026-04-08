// Shared types for the canvas + video editor system

export type ContentNodeType = "image" | "video" | "copy" | "post" | "kpi";
export type ContentNodeStatus = "draft" | "scheduled" | "published";

export interface ContentNode {
  id: string;
  type: ContentNodeType;
  title: string;
  thumbnail?: string;
  status: ContentNodeStatus;
  prompt?: string;
  createdAt: string;
  connections: string[]; // IDs of connected nodes
  position: { x: number; y: number };
  videoProjectId?: string; // links to a VideoProject if type === "video"
}

export type VideoSceneStatus = "draft" | "generating" | "ready" | "regenerating";

export type VideoSceneMode = "t2v" | "i2v" | "character" | "extend" | "interpolate";

export interface VideoSceneVersion {
  url: string;
  createdAt: string;
}

export interface ReferenceDimensions {
  height?: string;  // e.g. "6'1\"" or "12 inches"
  width?: string;   // e.g. "4 inches"
  length?: string;  // e.g. "11 inches"
  notes?: string;   // e.g. "slim build" or "matte black finish"
}

export interface ReferenceImage {
  id: string;
  url: string;
  label: string;
  category: "character" | "prop" | "scene";
  dimensions?: ReferenceDimensions;
}

export interface VideoScene {
  id: string;
  prompt: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  sourceImageUrl?: string; // starting frame for i2v mode
  // WHY: For "interpolate" mode — first/last keyframes that Seedance 2 fills
  // motion between. Used for invisible match cuts and brand-controlled hero
  // shots where the exact final frame composition matters.
  firstFrameUrl?: string;
  lastFrameUrl?: string;
  duration: number; // seconds
  trimStart: number; // trim in-point
  trimEnd: number; // trim out-point
  status: VideoSceneStatus;
  mode: VideoSceneMode;
  referenceImageIds: string[]; // IDs referencing project-level reference images
  versions: VideoSceneVersion[];
  score?: number;
  // WHY: Live progress for the inline video card. Updated by ChatPanel from
  // SSE events emitted by the .ai backend during Seedance generation.
  // progressStartedAt is used for ETA extrapolation when the percent stalls.
  progress?: number; // 0-100
  progressStage?: string; // human-readable stage label, e.g. "Composing scene"
  progressStartedAt?: number; // Date.now() when generation started, for ETA calc
}

// WHY: Score-first production. The track gets picked BEFORE scenes are
// generated so Gemini Director can snap scene durations to musical sections
// (intro/verse/drop/outro) and the Critic can score against a fixed timeline.
export interface ScoreTrackOption {
  id: string;
  prompt: string;
  genre?: string;
  bpm?: number;
  duration: number; // seconds
  audioUrl?: string;
  status: "generating" | "ready" | "failed";
  // Musical section markers produced by Gemini once the track is picked.
  // Used to lock scene durations to beat-aligned boundaries.
  markers?: Array<{ time: number; label: string }>;
}

export interface VideoProject {
  id: string;
  title: string;
  scenes: VideoScene[];
  referenceImages: ReferenceImage[];
  audioUrl?: string;
  createdAt: string;
  // WHY: Populated by CREATE_SCORE before any Seedance calls. The selected
  // track becomes the timeline skeleton — every scene's duration is derived
  // from which musical section it belongs to.
  scoreTrackOptions?: ScoreTrackOption[];
  selectedScoreTrackId?: string;
  scoreMarkers?: Array<{ time: number; label: string }>;
  // WHY: Voiceover fork. Either the user records their own via karaoke
  // OR we generate an ElevenLabs AI voice. Either path produces an
  // audio URL the final stitch layers over the music bed.
  voiceoverScript?: Array<{ startTime: number; endTime: number; text: string }>;
  voiceoverUrl?: string;
  voiceoverSource?: "karaoke" | "ai";
  voiceoverVoiceId?: string;
}

// Chat-to-canvas action types
export type CanvasAction =
  | { type: "add-node"; node: ContentNode }
  | { type: "remove-node"; nodeId: string }
  | { type: "connect-nodes"; fromId: string; toId: string }
  | { type: "update-node"; nodeId: string; updates: Partial<ContentNode> }
  | { type: "open-video-editor"; videoProjectId: string }
  | { type: "add-video-scene"; videoProjectId: string; scene: { prompt: string; mode?: VideoSceneMode; duration?: number } }
  | { type: "set-video-audio"; videoProjectId: string; audioDescription: string }
  | { type: "generate-video-scene"; videoProjectId: string; sceneIndex: number }
  | { type: "extend-video-scene"; videoProjectId: string; sceneIndex: number }
  | { type: "stitch-video"; videoProjectId: string }
  | { type: "set-scene-mode"; videoProjectId: string; sceneIndex: number; mode: VideoSceneMode }
  | { type: "add-reference-image"; videoProjectId: string; url: string; label: string; category?: "character" | "prop" | "scene" }
  | { type: "remove-reference-image"; videoProjectId: string; referenceId: string }
  | { type: "add-score-options"; videoProjectId: string; options: ScoreTrackOption[] }
  | { type: "select-score-track"; videoProjectId: string; trackId: string; markers?: Array<{ time: number; label: string }> }
  | { type: "set-voiceover-script"; videoProjectId: string; script: Array<{ startTime: number; endTime: number; text: string }> }
  | { type: "set-voiceover"; videoProjectId: string; url: string; source: "karaoke" | "ai"; voiceId?: string }
  | { type: "tag-reference-to-scene"; videoProjectId: string; sceneIndex: number; refLabel: string }
  | { type: "open-karaoke"; videoProjectId: string; script: Array<{ startTime: number; endTime: number; text: string }> }
  | { type: "set-scene-score"; videoProjectId: string; sceneId: string; score: number };
