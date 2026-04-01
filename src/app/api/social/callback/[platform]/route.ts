import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isValidPlatform, PLATFORMS, getPlatformCredentials } from "@/lib/social/platforms";

const BASE = () => process.env.NEXTAUTH_URL || "https://princemarketing.com";

function settingsRedirect(query: string) {
  return NextResponse.redirect(`${BASE()}/dashboard/settings?${query}`);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ platform: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.redirect(`${BASE()}/login`);
    }

    const { platform } = await params;

    if (!isValidPlatform(platform)) {
      return settingsRedirect("error=invalid_platform");
    }

    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      const errorDesc = url.searchParams.get("error_description") ?? error;
      return settingsRedirect(`error=${error}&message=${encodeURIComponent(errorDesc)}`);
    }

    if (!code) {
      return settingsRedirect("error=no_code");
    }

    // CSRF verification
    const cookies = request.headers.get("cookie") ?? "";
    const stateMatch = cookies.match(new RegExp(`oauth_state_${platform}=([^;]+)`));
    const savedState = stateMatch?.[1];

    if (!savedState || savedState !== state) {
      return settingsRedirect("error=invalid_state");
    }

    const { clientId, clientSecret } = getPlatformCredentials(platform);
    if (!clientId || !clientSecret) {
      return settingsRedirect("error=not_configured");
    }

    const config = PLATFORMS[platform];
    const redirectUri = `${BASE()}/api/social/callback/${platform}`;

    // Exchange code for access token
    const tokenBody: Record<string, string> = {
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    };

    if (platform === "twitter") {
      tokenBody.code_verifier = state;
    }

    // TikTok uses client_key, code_verifier from cookie, and different body format
    if (platform === "tiktok") {
      tokenBody.client_key = clientId;
      tokenBody.client_secret = clientSecret;
      // Retrieve PKCE code verifier from cookie
      const verifierMatch = cookies.match(new RegExp(`oauth_verifier_${platform}=([^;]+)`));
      if (verifierMatch?.[1]) {
        tokenBody.code_verifier = verifierMatch[1];
      }
    }

    // All OAuth2 token endpoints accept x-www-form-urlencoded (the spec standard).
    // Instagram and LinkedIn reject JSON; Twitter needs Basic auth header.
    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
    };

    if (platform === "twitter") {
      headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
    }

    const tokenRes = await fetch(config.tokenUrl, {
      method: "POST",
      headers,
      body: new URLSearchParams(tokenBody).toString(),
    });

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      console.error("Token exchange failed:", tokenData);
      return settingsRedirect("error=token_exchange_failed");
    }

    // Get account name
    let accountName: string = config.name;
    try {
      if (platform === "facebook" || platform === "instagram") {
        const meRes = await fetch(`https://graph.facebook.com/v19.0/me?access_token=${accessToken}`);
        const meData = await meRes.json();
        accountName = (meData.name as string) ?? config.name;
      } else if (platform === "twitter") {
        const meRes = await fetch("https://api.twitter.com/2/users/me", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const meData = await meRes.json();
        accountName = `@${(meData.data?.username as string) ?? "unknown"}`;
      } else if (platform === "linkedin") {
        const meRes = await fetch("https://api.linkedin.com/v2/userinfo", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const meData = await meRes.json();
        accountName = (meData.name as string) ?? config.name;
      } else if (platform === "tiktok") {
        const meRes = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=display_name,username", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const meData = await meRes.json();
        accountName = `@${(meData.data?.user?.username as string) ?? (meData.data?.user?.display_name as string) ?? "tiktok"}`;
      } else if (platform === "youtube") {
        const meRes = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const meData = await meRes.json();
        const channel = meData.items?.[0];
        accountName = (channel?.snippet?.title as string) ?? "YouTube Channel";
      }
    } catch {
      // Keep default name
    }

    // Upsert platform in database
    await db.platform.upsert({
      where: { userId_type: { userId: session.user.id, type: config.dbType } },
      create: { userId: session.user.id, type: config.dbType, accountName, accessToken, connected: true },
      update: { accountName, accessToken, connected: true },
    });

    const response = NextResponse.redirect(`${BASE()}/dashboard/settings?connected=${platform}`);
    response.cookies.delete(`oauth_state_${platform}`);
    response.cookies.delete(`oauth_verifier_${platform}`);
    return response;
  } catch (error) {
    console.error("Social callback error:", error);
    return settingsRedirect("error=callback_failed");
  }
}
