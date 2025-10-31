import type { Route } from "./+types/auth.onshape.callback";
import { redirect } from "react-router";
import { exchangeCodeForToken } from "~/lib/onshapeApi/auth";
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
  const storedState = session.get("onshapeOauthState");

  // Verify state to prevent CSRF attacks
  if (!state || state !== storedState) {
    return redirect("/?error=" + encodeURIComponent("Invalid state parameter"));
  }

  const clientId = process.env.ONSHAPE_CLIENT_ID;
  const clientSecret = process.env.ONSHAPE_CLIENT_SECRET;
  const redirectUri = process.env.ONSHAPE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Missing Onshape OAuth environment variables");
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
    session.set("onshapeAccessToken", tokenResponse.access_token);
    session.set("onshapeRefreshToken", tokenResponse.refresh_token);
    session.set("onshapeExpiresAt", Date.now() + tokenResponse.expires_in * 1000);
    session.unset("onshapeOauthState"); // Remove state after successful exchange

    // Redirect to home page
    return redirect("/", {
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

