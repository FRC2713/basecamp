import type { Route } from "./+types/auth.exchange";
import { exchangeCodeForToken } from "~/lib/basecampApi/auth";
import { getSession, commitSession } from "~/lib/session";

export async function action({ request }: Route.ActionArgs) {
  console.log("[EXCHANGE] Token exchange request received");
  console.log("[EXCHANGE] Cookie header:", request.headers.get("Cookie") ? "present" : "missing");
  
  if (request.method !== "POST") {
    return Response.json(
      { success: false, error: "Method not allowed" },
      { status: 405 }
    );
  }

  const session = await getSession(request);
  const body = await request.json();
  const { code, state } = body;

  console.log("[EXCHANGE] Received code:", code ? `${code.substring(0, 10)}...` : "null");
  console.log("[EXCHANGE] Received state:", state);

  if (!code) {
    console.log("[EXCHANGE] ERROR: No code provided");
    return Response.json(
      { success: false, error: "No authorization code provided" },
      { status: 400 }
    );
  }

  if (!state) {
    console.log("[EXCHANGE] ERROR: No state provided");
    return Response.json(
      { success: false, error: "No state parameter provided" },
      { status: 400 }
    );
  }

  // Validate state against session to prevent CSRF attacks
  const storedState = session.get("oauthState");
  console.log("[EXCHANGE] Stored state from session:", storedState);
  console.log("[EXCHANGE] States match:", state === storedState);
  
  if (!storedState || state !== storedState) {
    console.log("[EXCHANGE] ERROR: State validation failed");
    console.log("[EXCHANGE] Expected:", storedState);
    console.log("[EXCHANGE] Received:", state);
    return Response.json(
      { success: false, error: "Invalid state parameter" },
      { status: 400 }
    );
  }
  
  console.log("[EXCHANGE] State validation passed");

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
    console.log("[EXCHANGE] Exchanging code for token...");
    // Exchange authorization code for access token
    const tokenResponse = await exchangeCodeForToken(
      code,
      redirectUri,
      clientId,
      clientSecret
    );

    console.log("[EXCHANGE] Token exchange successful");
    // Store tokens in session
    session.set("accessToken", tokenResponse.access_token);
    session.set("refreshToken", tokenResponse.refresh_token);
    session.set("expiresAt", Date.now() + tokenResponse.expires_in * 1000);

    // Get redirect destination if stored
    const redirectTo = session.get("oauthRedirect") || "/";
    const signInRedirect = session.get("signInRedirect");
    
    console.log("[EXCHANGE] oauthRedirect:", redirectTo);
    console.log("[EXCHANGE] signInRedirect (should be preserved):", signInRedirect);
    
    session.unset("oauthState"); // Remove state after successful exchange
    session.unset("oauthRedirect"); // Remove redirect after use
    // Keep signInRedirect - signin page will need it

    // Commit session to save cookies
    const cookie = await commitSession(session);
    console.log("[EXCHANGE] Session updated, sending response");

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
    console.error("[EXCHANGE] Token exchange error:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to exchange authorization code",
      },
      { status: 500 }
    );
  }
}
