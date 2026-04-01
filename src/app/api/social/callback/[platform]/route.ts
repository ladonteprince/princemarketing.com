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

    const tokenRes = await fetch(config.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": platform === "twitter"
          ? "application/x-www-form-urlencoded"
          : "application/json",
        ...(platform === "twitter"
          ? { Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}` }
          : {}),
      },
      body: platform === "twitter"
        ? new URLSearchParams(tokenBody).toString()
        : JSON.stringify(tokenBody),
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
    return response;
  } catch (error) {
    console.error("Social callback error:", error);
    return settingsRedirect("error=callback_failed");
  }
}
