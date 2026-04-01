// Internal service client that calls princemarketing.ai API
// WHY: Centralized backend-to-backend client for .com → .ai communication.
// All generation requests flow through this client, keeping API keys server-side only.

const API_BASE = process.env.PRINCE_API_URL || "https://princemarketing.ai";
const API_KEY = process.env.PRINCE_API_KEY || "";

type RequestInit = {
  method: string;
  headers: Record<string, string>;
  body?: string;
};

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; query?: Record<string, string> } = {},
): Promise<T> {
  const { method = "GET", body, query } = options;

  let url = `${API_BASE}${path}`;
  if (query) {
    const params = new URLSearchParams(query).toString();
    if (params) url += `?${params}`;
  }

  const init: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
    },
  };

  if (body) {
    init.body = JSON.stringify(body);
  }

  const res = await fetch(url, init);

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(
      (errorBody as { error?: string }).error ??
        `princemarketing.ai responded with ${res.status}`,
    );
  }

  return res.json() as Promise<T>;
}

// WHY: Each method maps 1:1 to a princemarketing.ai endpoint.
// Types are intentionally loose here — the .ai API owns validation.

export type ImageGenerateParams = {
  prompt: string;
  quality?: "pro" | "standard";
  aspectRatio?: string;
};

export type VideoGenerateParams = {
  prompt: string;
  duration?: number;
  aspectRatio?: string;
  model?: string;
  images?: string[];
  mode?: 't2v' | 'i2v' | 'extend' | 'character' | 'video-edit';
  sourceImage?: string;  // For i2v (image-to-video)
  sourceVideo?: string;  // For extend and video-edit
  seed?: number;
};

export type CopyGenerateParams = {
  prompt: string;
  type?: string;
  tone?: string;
};

export type ScoreParams = {
  url: string;
  type: string;
};

export type Generation = {
  id: string;
  type: string;
  status: string;
  prompt: string;
  resultUrl?: string;
  createdAt: string;
};

export type GenerationListResponse = {
  generations: Generation[];
  total: number;
};

export const princeAPI = {
  async generateImage(params: ImageGenerateParams) {
    return request<{ id: string; status: string; resultUrl?: string }>(
      "/api/v1/generate/image",
      { method: "POST", body: params },
    );
  },

  async generateVideo(params: VideoGenerateParams) {
    return request<{ id: string; status: string; resultUrl?: string }>(
      "/api/v1/generate/video",
      { method: "POST", body: params },
    );
  },

  async generateCopy(params: CopyGenerateParams) {
    return request<{ id: string; status: string; result?: string }>(
      "/api/v1/generate/copy",
      { method: "POST", body: params },
    );
  },

  async scoreAsset(params: ScoreParams) {
    return request<{ score: number; feedback: string }>(
      "/api/v1/score",
      { method: "POST", body: params },
    );
  },

  async getGenerations(params?: { limit?: number; offset?: number }) {
    const query: Record<string, string> = {};
    if (params?.limit) query.limit = String(params.limit);
    if (params?.offset) query.offset = String(params.offset);

    return request<GenerationListResponse>("/api/v1/generations", { query });
  },

  async getGeneration(id: string) {
    return request<Generation>(`/api/v1/generations/${id}`);
  },
};
