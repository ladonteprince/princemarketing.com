// Vertex AI Gemini Embedding 2 — multimodal 3072-dim embeddings.
// Handles text, image, audio, and video (up to 80s with audio, 120s silent).
//
// Reads GCP_PROJECT_ID, VERTEX_LOCATION (default us-central1), GEMINI_API_KEY.
//
// NOTE: gemini-embedding-2-preview is preview-only in us-central1 as of 2026-04.
// Single video per prompt, so segmented videos call this once per segment.

import { GoogleGenAI } from "@google/genai";

export type EmbedTask =
  | "RETRIEVAL_DOCUMENT"
  | "RETRIEVAL_QUERY"
  | "SEMANTIC_SIMILARITY"
  | "CLASSIFICATION"
  | "CLUSTERING";

const LOCATION = process.env.VERTEX_LOCATION ?? "us-central1";
const PROJECT = process.env.GCP_PROJECT_ID;
const MODEL = process.env.GEMINI_EMBED_MODEL ?? "gemini-embedding-2-preview";

let _client: GoogleGenAI | null = null;
function client(): GoogleGenAI {
  if (_client) return _client;
  if (!PROJECT) {
    throw new Error(
      "embed: GCP_PROJECT_ID is required. Set it after provisioning the GCP project.",
    );
  }
  _client = new GoogleGenAI({
    vertexai: true,
    project: PROJECT,
    location: LOCATION,
  });
  return _client;
}

export type TextInput = { kind: "text"; text: string };
export type MediaInput = {
  kind: "video" | "image" | "audio";
  // GCS URI (gs://bucket/path) strongly preferred — avoids re-upload.
  fileUri?: string;
  // Inline bytes (use only for small files <20MB).
  inlineData?: { data: string /* base64 */; mimeType: string };
};
export type EmbedInput = TextInput | MediaInput;

export type EmbedResult = {
  values: number[]; // length = outputDimensionality, default 3072
  inputType: EmbedInput["kind"];
};

/**
 * Embed a single input with Gemini Embedding 2.
 *
 * For videos: one call per segment (max 80s w/ audio, 120s silent).
 * For text: include a task instruction via `task` to get better retrieval quality.
 */
export async function embed(
  input: EmbedInput,
  opts: { task?: EmbedTask; outputDimensionality?: number; title?: string } = {},
): Promise<EmbedResult> {
  const ai = client();
  const parts: Array<Record<string, unknown>> = [];
  if (input.kind === "text") {
    parts.push({ text: input.text });
  } else if (input.fileUri) {
    parts.push({
      file_data: {
        file_uri: input.fileUri,
        mime_type: mimeForMedia(input.kind),
      },
    });
  } else if (input.inlineData) {
    parts.push({
      inline_data: {
        data: input.inlineData.data,
        mime_type: input.inlineData.mimeType,
      },
    });
  } else {
    throw new Error("embed: media input must have fileUri or inlineData");
  }

  const res = await ai.models.embedContent({
    model: MODEL,
    contents: [{ parts }],
    config: {
      taskType: opts.task,
      outputDimensionality: opts.outputDimensionality,
      title: opts.title,
    } as unknown as Record<string, unknown>,
  });

  const values = res.embeddings?.[0]?.values;
  if (!values || values.length === 0) {
    throw new Error("embed: empty embedding returned from Vertex");
  }
  return { values, inputType: input.kind };
}

function mimeForMedia(kind: MediaInput["kind"]): string {
  switch (kind) {
    case "video":
      return "video/mp4";
    case "image":
      return "image/png";
    case "audio":
      return "audio/mp3";
  }
}

/**
 * Compute segment boundaries for a long video so each segment fits in the
 * Gemini Embedding 2 window (80s w/ audio).
 */
export function segmentBoundaries(
  durationSec: number,
  windowSec = 80,
  overlapSec = 2,
): Array<{ start: number; end: number }> {
  const windows: Array<{ start: number; end: number }> = [];
  let cursor = 0;
  while (cursor < durationSec) {
    const end = Math.min(cursor + windowSec, durationSec);
    windows.push({ start: cursor, end });
    if (end >= durationSec) break;
    cursor = end - overlapSec;
  }
  return windows;
}
