import type { Route } from "./+types/auth.callback";
import { redirect } from "react-router";
import { exchangeCodeForToken } from "~/lib/basecampApi/auth";
import { getSession, commitSession, destroySession } from "~/lib/session";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  // Handle OAuth errors
  if (error) {
    return redirect("/?error=" + encodeURIComponent(error));
  }

  if (!code) {
    return redirect("/?error=" + encodeURIComponent("No authorization code received"));
  }

  const session = await getSession(request);
  const storedState = session.get("oauthState");

  // Debug logging
  console.error("OAuth callback state validation:", {
    receivedState: state,
    storedState: storedState,
    hasSession: !!session,
    sessionKeys: session ? Object.keys(session.data || {}) : [],
    cookies: request.headers.get("cookie")?.substring(0, 100), // First 100 chars
  });

  // Verify state to prevent CSRF attacks
  if (!state || state !== storedState) {
    // If state doesn't match, it might be a cookie issue
    // Check if we have a code but no stored state
    if (code && !storedState) {
      console.error("State missing from session - cookie may not be accessible in popup");
      // Try to restart auth flow
      await destroySession(session);
      return redirect("/auth?popup=true");
    }
    return redirect("/?error=" + encodeURIComponent("Invalid state parameter"));
  }

  const clientId = process.env.BASECAMP_CLIENT_ID;
  const clientSecret = process.env.BASECAMP_CLIENT_SECRET;
  const redirectUri = process.env.BASECAMP_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Missing Basecamp OAuth environment variables");
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

    // Redirect to intended destination or home page
    return redirect(redirectTo, {
      headers: {
        "Set-Cookie": await commitSession(session),
      },
    });
  } catch (error) {
    console.error("Token exchange error:", error);
    await destroySession(session);
    return redirect("/?error=" + encodeURIComponent("Failed to exchange authorization code"));
  }
}

