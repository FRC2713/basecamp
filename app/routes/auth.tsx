import type { Route } from "./+types/auth";
import { redirect } from "react-router";
import { getAuthorizationUrl } from "~/lib/basecampApi/auth";
import { getSession, commitSession } from "~/lib/session";
import { randomBytes } from "node:crypto";

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSession(request);
  
  // Check if already authenticated
  if (session.get("accessToken")) {
    return redirect("/");
  }

  const clientId = process.env.BASECAMP_CLIENT_ID;
  const redirectUri = process.env.BASECAMP_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    throw new Error("Missing BASECAMP_CLIENT_ID or BASECAMP_REDIRECT_URI environment variables");
  }

  // Generate state for CSRF protection
  const state = randomBytes(32).toString("hex");
  session.set("oauthState", state);

  // Generate authorization URL
  const authUrl = getAuthorizationUrl(redirectUri, clientId, state);

  // Redirect to Basecamp authorization page
  return redirect(authUrl, {
    headers: {
      "Set-Cookie": await commitSession(session),
    },
  });
}

