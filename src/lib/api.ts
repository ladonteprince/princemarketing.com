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
): Promise<void> {
  const response = await fetch(`${BASE_URL}/ai/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, message }),
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
