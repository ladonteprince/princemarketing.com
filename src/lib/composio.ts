// Composio Integration — REST API approach
// WHY: composio-core SDK pulls in heavy deps (langchain, openai) we don't need.
// The REST API is lightweight, stable, and gives us full control over error handling.

const COMPOSIO_API_KEY =
  process.env.COMPOSIO_API_KEY || "ak_Ayz4msuNtCGfkJwTyOE3";
const COMPOSIO_USER_ID =
  process.env.COMPOSIO_USER_ID ||
  "pg-test-d170904d-b385-4982-af95-23bd8982f502";
const COMPOSIO_BASE = "https://backend.composio.dev/api/v2";

export function getComposioUserId(): string {
  return COMPOSIO_USER_ID;
}

/**
 * Execute a Composio action via REST API.
 *
 * @param actionSlug - The Composio action name (e.g. "FACEBOOK_CREATE_POST")
 * @param params - Action-specific input parameters
 * @returns Normalized result with success flag, data, and error
 */
export async function executeComposioAction(
  actionSlug: string,
  params: Record<string, unknown>,
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    const res = await fetch(
      `${COMPOSIO_BASE}/actions/${actionSlug}/execute`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": COMPOSIO_API_KEY,
        },
        body: JSON.stringify({
          entityId: COMPOSIO_USER_ID,
          input: params,
        }),
      },
    );

    if (!res.ok) {
      const text = await res.text().catch(() => "Unknown error");
      return {
        success: false,
        error: `Composio API ${res.status}: ${text.slice(0, 300)}`,
      };
    }

    const data = await res.json();

    if (data.successful === false) {
      return {
        success: false,
        error: data.error || "Action execution failed",
      };
    }

    return { success: true, data: data.data ?? data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Composio request failed",
    };
  }
}

/**
 * List available Composio actions for a given app.
 * Useful for discovery and debugging.
 */
export async function listComposioActions(
  appName: string,
): Promise<{ success: boolean; actions?: string[]; error?: string }> {
  try {
    const res = await fetch(
      `${COMPOSIO_BASE}/actions?appNames=${appName}`,
      {
        headers: { "X-API-Key": COMPOSIO_API_KEY },
      },
    );

    if (!res.ok) {
      return { success: false, error: `Failed to list actions: ${res.status}` };
    }

    const data = await res.json();
    const actions = (data.items ?? data)?.map(
      (a: { name?: string; actionName?: string }) =>
        a.name ?? a.actionName ?? "unknown",
    );

    return { success: true, actions };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to list actions",
    };
  }
}
