import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isValidPlatform, PLATFORMS, getPlatformCredentials } from "@/lib/social/platforms";
import crypto from "crypto";

// GET /api/social/connect/[platform] — Initiates OAuth flow for a platform
export async function GET(
  request: Request,
  { params }: { params: Promise<{ platform: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { platform } = await params;

    if (!isValidPlatform(platform)) {
      return NextResponse.json(
        { error: `Invalid platform: ${platform}. Valid: instagram, facebook, twitter, linkedin` },
        { status: 400 },
      );
    }

    const { clientId, clientSecret } = getPlatformCredentials(platform);

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        {
          error: `${PLATFORMS[platform].name} is not configured yet. Add ${PLATFORMS[platform].envPrefix}_CLIENT_ID and ${PLATFORMS[platform].envPrefix}_CLIENT_SECRET to your environment variables.`,
        },
        { status: 501 },
      );
    }

    // Generate CSRF state token
    const state = crypto.randomBytes(32).toString("hex");

    const config = PLATFORMS[platform];
    const redirectUri = `${process.env.NEXTAUTH_URL}/api/social/callback/${platform}`;
    // OAuth2 spec requires space-separated scopes; Instagram/Facebook also accept commas
    const scopeSeparator = platform === "instagram" || platform === "facebook" ? "," : " ";
    const scope = config.scopes.join(scopeSeparator);

    const authUrl = new URL(config.authUrl);
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", scope);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("state", state);

    // Facebook Business Login requires config_id for configured permissions
    if ("configId" in config && config.configId) {
      authUrl.searchParams.set("config_id", config.configId as string);
    }

    // Twitter uses PKCE
    if (platform === "twitter") {
      authUrl.searchParams.set("code_challenge", state);
      authUrl.searchParams.set("code_challenge_method", "plain");
    }

    // Store state in a cookie for CSRF verification
    const response = NextResponse.redirect(authUrl.toString());
    response.cookies.set(`oauth_state_${platform}`, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Social connect error:", error);
    return NextResponse.json(
      { error: "Failed to initiate connection" },
      { status: 500 },
    );
  }
}
