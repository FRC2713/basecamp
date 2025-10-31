import type { Route } from "./+types/auth.exchange";
import { exchangeCodeForToken } from "~/lib/basecampApi/auth";
import { getSession, commitSession } from "~/lib/session";

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json(
      { success: false, error: "Method not allowed" },
      { status: 405 }
    );
  }

  const session = await getSession(request);
  const body = await request.json();
  const { code, state } = body;

  if (!code) {
    return Response.json(
      { success: false, error: "No authorization code provided" },
      { status: 400 }
    );
  }

  if (!state) {
    return Response.json(
      { success: false, error: "No state parameter provided" },
      { status: 400 }
    );
  }

  // Validate state against session to prevent CSRF attacks
  const storedState = session.get("oauthState");
  if (!storedState || state !== storedState) {
    return Response.json(
      { success: false, error: "Invalid state parameter" },
      { status: 400 }
    );
  }

  const clientId = process.env.BASECAMP_CLIENT_ID;
  const clientSecret = process.env.BASECAMP_CLIENT_SECRET;
  const redirectUri = process.env.BASECAMP_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return Response.json(
      { success: false, error: "Missing Basecamp OAuth environment variables" },
      { status: 500 }
    );
  }

  try {
    // Exchange authorization code for access token
    const tokenResponse = await exchangeCodeForToken(
      code,
      redirectUri,
      clientId,
      clientSecret
    );

    // Store tokens in session
    session.set("accessToken", tokenResponse.access_token);
    session.set("refreshToken", tokenResponse.refresh_token);
    session.set("expiresAt", Date.now() + tokenResponse.expires_in * 1000);

    // Get redirect destination if stored
    const redirectTo = session.get("oauthRedirect") || "/";
    session.unset("oauthState"); // Remove state after successful exchange
    session.unset("oauthRedirect"); // Remove redirect after use

    // Commit session to save cookies
    const cookie = await commitSession(session);

    return Response.json(
      { success: true, redirectTo },
      {
        status: 200,
        headers: {
          "Set-Cookie": cookie,
        },
      }
    );
  } catch (error) {
    console.error("Token exchange error:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to exchange authorization code",
      },
      { status: 500 }
    );
  }
}
