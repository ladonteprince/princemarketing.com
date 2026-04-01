import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { PlatformType } from "@prisma/client";

// GET /api/user/platform-accounts — Returns available accounts/pages per connected platform
// WHY: After OAuth, platforms like Facebook let you manage multiple Pages.
// The user needs to pick WHICH page to publish to. This endpoint fetches those options.

type PlatformAccount = {
  id: string;
  name: string;
  type: "page" | "channel" | "property" | "account";
  pictureUrl?: string;
};

type PlatformAccountsResponse = {
  platform: PlatformType;
  accounts: PlatformAccount[];
  selectedAccountId: string | null;
};

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const platforms = await db.platform.findMany({
      where: { userId: session.user.id, connected: true },
      select: {
        type: true,
        accessToken: true,
        accountName: true,
      },
    });

    const results: PlatformAccountsResponse[] = [];

    // WHY: Fetch accounts in parallel — each platform API call is independent.
    const fetches = platforms.map(async (p) => {
      if (!p.accessToken) {
        return {
          platform: p.type,
          accounts: [{ id: "default", name: p.accountName, type: "account" as const }],
          selectedAccountId: "default",
        };
      }

      try {
        const accounts = await fetchPlatformAccounts(p.type, p.accessToken);
        return {
          platform: p.type,
          accounts:
            accounts.length > 0
              ? accounts
              : [{ id: "default", name: p.accountName, type: "account" as const }],
          selectedAccountId: accounts.length > 0 ? accounts[0].id : "default",
        };
      } catch (err) {
        console.error(`[PlatformAccounts] Failed to fetch for ${p.type}:`, err);
        return {
          platform: p.type,
          accounts: [{ id: "default", name: p.accountName, type: "account" as const }],
          selectedAccountId: "default",
        };
      }
    });

    const settled = await Promise.all(fetches);
    results.push(...settled);

    return NextResponse.json({ platformAccounts: results });
  } catch (error) {
    console.error("Platform accounts fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch platform accounts" },
      { status: 500 },
    );
  }
}

// --- Per-platform account fetchers ---

async function fetchPlatformAccounts(
  platform: PlatformType,
  accessToken: string,
): Promise<PlatformAccount[]> {
  switch (platform) {
    case "FACEBOOK":
      return fetchFacebookPages(accessToken);
    case "INSTAGRAM":
      return fetchInstagramAccounts(accessToken);
    case "YOUTUBE":
      return fetchYouTubeChannels(accessToken);
    case "GOOGLE_ANALYTICS":
      return fetchGAProperties(accessToken);
    // WHY: These platforms only support a single account per OAuth connection.
    // No account picker needed — return empty to use the default.
    case "TWITTER":
    case "LINKEDIN":
    case "TIKTOK":
    default:
      return [];
  }
}

/**
 * Facebook: GET /me/accounts returns Pages the user manages.
 * WHY: A business owner may manage multiple Facebook Pages (personal brand + business).
 */
async function fetchFacebookPages(
  accessToken: string,
): Promise<PlatformAccount[]> {
  const res = await fetch(
    `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,picture&access_token=${accessToken}`,
  );
  const data = await res.json();

  if (!data.data || !Array.isArray(data.data)) return [];

  return data.data.map((page: Record<string, unknown>) => ({
    id: String(page.id),
    name: String(page.name ?? "Untitled Page"),
    type: "page" as const,
    pictureUrl:
      (page.picture as Record<string, unknown>)?.data
        ? String(
            ((page.picture as Record<string, unknown>).data as Record<string, unknown>)
              ?.url ?? "",
          )
        : undefined,
  }));
}

/**
 * Instagram: Get IG Business Accounts linked to Facebook Pages.
 * WHY: Instagram Business accounts are managed through Facebook Pages.
 * A user with multiple Pages may have multiple IG accounts.
 */
async function fetchInstagramAccounts(
  accessToken: string,
): Promise<PlatformAccount[]> {
  const res = await fetch(
    `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,instagram_business_account{id,username,profile_picture_url}&access_token=${accessToken}`,
  );
  const data = await res.json();

  if (!data.data || !Array.isArray(data.data)) return [];

  const accounts: PlatformAccount[] = [];
  for (const page of data.data) {
    const ig = (page as Record<string, unknown>).instagram_business_account as
      | Record<string, unknown>
      | undefined;
    if (ig?.id) {
      accounts.push({
        id: String(ig.id),
        name: String(ig.username ?? page.name ?? "Instagram Account"),
        type: "account" as const,
        pictureUrl: ig.profile_picture_url
          ? String(ig.profile_picture_url)
          : undefined,
      });
    }
  }

  return accounts;
}

/**
 * YouTube: GET /youtube/v3/channels?mine=true returns channels owned by the user.
 * WHY: A Google account can own multiple YouTube channels (brand accounts).
 */
async function fetchYouTubeChannels(
  accessToken: string,
): Promise<PlatformAccount[]> {
  const res = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const data = await res.json();

  if (!data.items || !Array.isArray(data.items)) return [];

  return data.items.map((ch: Record<string, unknown>) => {
    const snippet = (ch.snippet ?? {}) as Record<string, unknown>;
    const thumbnails = (snippet.thumbnails ?? {}) as Record<
      string,
      Record<string, unknown>
    >;
    return {
      id: String(ch.id),
      name: String(snippet.title ?? "YouTube Channel"),
      type: "channel" as const,
      pictureUrl: thumbnails.default?.url
        ? String(thumbnails.default.url)
        : undefined,
    };
  });
}

/**
 * Google Analytics: List GA4 properties via Admin API.
 * WHY: A business may have multiple GA properties (e.g. main site + blog + store).
 */
async function fetchGAProperties(
  accessToken: string,
): Promise<PlatformAccount[]> {
  const res = await fetch(
    "https://analyticsadmin.googleapis.com/v1beta/accountSummaries",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const data = await res.json();

  if (!data.accountSummaries || !Array.isArray(data.accountSummaries))
    return [];

  const properties: PlatformAccount[] = [];
  for (const summary of data.accountSummaries) {
    const propertySummaries =
      (summary as Record<string, unknown>).propertySummaries;
    if (!Array.isArray(propertySummaries)) continue;

    for (const prop of propertySummaries) {
      const p = prop as Record<string, unknown>;
      properties.push({
        id: String(p.property ?? ""),
        name: String(p.displayName ?? "Analytics Property"),
        type: "property" as const,
      });
    }
  }

  return properties;
}
