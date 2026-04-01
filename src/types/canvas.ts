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

export type VideoSceneStatus = "generating" | "ready" | "regenerating";

export type VideoSceneMode = "t2v" | "i2v" | "character" | "extend";

export interface VideoSceneVersion {
  url: string;
  createdAt: string;
}

export interface ReferenceImage {
  id: string;
  url: string;
  label: string;
}

export interface VideoScene {
  id: string;
  prompt: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  sourceImageUrl?: string; // starting frame for i2v mode
  duration: number; // seconds
  trimStart: number; // trim in-point
  trimEnd: number; // trim out-point
  status: VideoSceneStatus;
  mode: VideoSceneMode;
  referenceImageIds: string[]; // IDs referencing project-level reference images
  versions: VideoSceneVersion[];
}

export interface VideoProject {
  id: string;
  title: string;
  scenes: VideoScene[];
  referenceImages: ReferenceImage[];
  audioUrl?: string;
  createdAt: string;
}

// Chat-to-canvas action types
export type CanvasAction =
  | { type: "add-node"; node: ContentNode }
  | { type: "remove-node"; nodeId: string }
  | { type: "connect-nodes"; fromId: string; toId: string }
  | { type: "update-node"; nodeId: string; updates: Partial<ContentNode> }
  | { type: "open-video-editor"; videoProjectId: string }
  | { type: "add-video-scene"; videoProjectId: string; scene: { prompt: string; mode?: VideoSceneMode; duration?: number } }
  | { type: "set-video-audio"; videoProjectId: string; audioDescription: string };
