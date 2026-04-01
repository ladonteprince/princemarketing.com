// API client for frontend-to-backend communication
// WHY: Centralized fetch wrapper with error handling and type safety

import { getErrorMessage } from "@/utils/errors";

const BASE_URL = "/api";

type FetchOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
};

export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number };

export async function apiClient<T>(
  path: string,
  options: FetchOptions = {},
): Promise<ApiResponse<T>> {
  const { method = "GET", body, headers = {} } = options;

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      return {
        ok: false,
        error:
          (errorBody as { error?: string }).error ??
          `Request failed with status ${response.status}`,
        status: response.status,
      };
    }

    const data = (await response.json()) as T;
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error), status: 0 };
  }
}

// Streaming fetch for AI chat responses
export async function streamChat(
  sessionId: string,
  message: string,
  onChunk: (text: string) => void,
  onDone: () => void,
  history?: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<void> {
  const response = await fetch(`${BASE_URL}/ai/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, message, history }),
  });

  if (!response.ok || !response.body) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      (errorBody as { error?: string }).error ?? "Failed to connect to AI",
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  // WHY: Process streaming chunks as they arrive for real-time chat feel
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split("\n").filter((line) => line.startsWith("data: "));

    for (const line of lines) {
      const data = line.slice(6);
      if (data === "[DONE]") {
        onDone();
        return;
      }
      onChunk(data);
    }
  }

  onDone();
}

// ─── Generation SSE Stream ─────────────────────────────────────────────────
// WHY: Real-time progress for video/image generation instead of polling.
// Opens an SSE connection, fires callbacks on each event, auto-closes on completion.

export type GenerationStreamEvent = {
  type:
    | "status_change"
    | "progress"
    | "scoring"
    | "completed"
    | "failed"
    | "heartbeat";
  generationId: string;
  timestamp: string;
  data: {
    status?: string;
    previousStatus?: string;
    progress?: number;
    stage?: string;
    message?: string;
    resultUrl?: string;
    score?: number;
    feedback?: string;
    error?: string;
    model?: string;
    predictionId?: string;
    durationMs?: number;
  };
};

export type StreamCallbacks = {
  onProgress?: (event: GenerationStreamEvent) => void;
  onStatusChange?: (event: GenerationStreamEvent) => void;
  onScoring?: (event: GenerationStreamEvent) => void;
  onCompleted?: (event: GenerationStreamEvent) => void;
  onFailed?: (event: GenerationStreamEvent) => void;
  onError?: (error: Error) => void;
};

export function streamGeneration(
  generationId: string,
  callbacks: StreamCallbacks,
): () => void {
  const abortController = new AbortController();

  (async () => {
    try {
      const response = await fetch(`${BASE_URL}/stream/${generationId}`, {
        headers: { Accept: "text/event-stream" },
        signal: abortController.signal,
      });

      if (!response.ok || !response.body) {
        callbacks.onError?.(
          new Error(`Stream connection failed (${response.status})`),
        );
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? ""; // Keep incomplete line in buffer

        let currentEventType = "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEventType = line.slice(7).trim();
            if (currentEventType === "done") return; // Stream complete
            continue;
          }

          if (line.startsWith("data: ") && currentEventType) {
            try {
              const event = JSON.parse(line.slice(6)) as GenerationStreamEvent;

              switch (event.type) {
                case "progress":
                  callbacks.onProgress?.(event);
                  break;
                case "status_change":
                  callbacks.onStatusChange?.(event);
                  break;
                case "scoring":
                  callbacks.onScoring?.(event);
                  break;
                case "completed":
                  callbacks.onCompleted?.(event);
                  return; // Done
                case "failed":
                  callbacks.onFailed?.(event);
                  return; // Done
                case "heartbeat":
                  break; // Ignore heartbeats
              }
            } catch {
              // Ignore malformed JSON lines
            }
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        callbacks.onError?.(
          err instanceof Error ? err : new Error("Stream error"),
        );
      }
    }
  })();

  // Return cancel function
  return () => abortController.abort();
}
