import type { Route } from "./+types/auth.onshape";
import { redirect } from "react-router";
import { getAuthorizationUrl } from "~/lib/onshapeApi/auth";
import { getSession, commitSession } from "~/lib/session";
import { randomBytes } from "node:crypto";

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSession(request);
  const url = new URL(request.url);
  const redirectTo = url.searchParams.get("redirect");
  
  // Store redirect path in session if provided
  if (redirectTo) {
    session.set("signInRedirect", redirectTo);
  }
  
  // Check if already authenticated
  if (session.get("onshapeAccessToken")) {
    const destination = session.get("signInRedirect") || "/";
    return redirect(destination, {
      headers: {
        "Set-Cookie": await commitSession(session),
      },
    });
  }

  const clientId = process.env.ONSHAPE_CLIENT_ID;
  const redirectUri = process.env.ONSHAPE_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    throw new Error("Missing ONSHAPE_CLIENT_ID or ONSHAPE_REDIRECT_URI environment variables");
  }

  // Generate state for CSRF protection
  const state = randomBytes(32).toString("hex");
  session.set("onshapeOauthState", state);

  // Generate authorization URL
  const authUrl = getAuthorizationUrl(redirectUri, clientId, state);

  // Redirect to Onshape authorization page
  return redirect(authUrl, {
    headers: {
      "Set-Cookie": await commitSession(session),
    },
  });
}

