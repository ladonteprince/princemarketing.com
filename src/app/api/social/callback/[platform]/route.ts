import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isValidPlatform, PLATFORMS, getPlatformCredentials } from "@/lib/social/platforms";

// GET /api/social/callback/[platform] — Handles OAuth callback, exchanges code for token
export async function GET(
  request: Request,
  { params }: { params: Promise<{ platform: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const { platform } = await params;

    if (!isValidPlatform(platform)) {
      return NextResponse.redirect(
        new URL("/dashboard/settings?error=invalid_platform", request.url),
      );
    }

    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      // WHY: LinkedIn returns "redirect_uri does not match" as an error_description param.
      // Show a user-friendly message instead of the raw OAuth error code.
      const errorDesc = url.searchParams.get("error_description") ?? error;
      const friendlyError = encodeURIComponent(errorDesc);
      return NextResponse.redirect(
        new URL(`/dashboard/settings?error=${error}&message=${friendlyError}`, request.url),
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL("/dashboard/settings?error=no_code", request.url),
      );
    }

    // CSRF verification
    const cookies = request.headers.get("cookie") ?? "";
    const stateMatch = cookies.match(new RegExp(`oauth_state_${platform}=([^;]+)`));
    const savedState = stateMatch?.[1];

    if (!savedState || savedState !== state) {
      return NextResponse.redirect(
        new URL("/dashboard/settings?error=invalid_state", request.url),
      );
    }

    const { clientId, clientSecret } = getPlatformCredentials(platform);
    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        new URL("/dashboard/settings?error=not_configured", request.url),
      );
    }

    const config = PLATFORMS[platform];
    const redirectUri = `${process.env.NEXTAUTH_URL}/api/social/callback/${platform}`;

    // Exchange code for access token
    const tokenBody: Record<string, string> = {
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    };

    // Twitter uses PKCE
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
      return NextResponse.redirect(
        new URL("/dashboard/settings?error=token_exchange_failed", request.url),
      );
    }

    // Get account name based on platform
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
        const username = (meData.data?.username as string) ?? "unknown";
        accountName = `@${username}`;
      } else if (platform === "linkedin") {
        const meRes = await fetch("https://api.linkedin.com/v2/userinfo", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const meData = await meRes.json();
        accountName = (meData.name as string) ?? config.name;
      }
    } catch {
      // Keep default name on fetch failure
    }

    // Upsert platform in database
    await db.platform.upsert({
      where: {
        userId_type: {
          userId: session.user.id,
          type: config.dbType,
        },
      },
      create: {
        userId: session.user.id,
        type: config.dbType,
        accountName,
        accessToken,
        connected: true,
      },
      update: {
        accountName,
        accessToken,
        connected: true,
      },
    });

    // Clear the state cookie and redirect
    const response = NextResponse.redirect(
      new URL(`/dashboard/settings?connected=${platform}`, request.url),
    );
    response.cookies.delete(`oauth_state_${platform}`);
    return response;
  } catch (error) {
    console.error("Social callback error:", error);
    return NextResponse.redirect(
      new URL("/dashboard/settings?error=callback_failed", request.url),
    );
  }
}
