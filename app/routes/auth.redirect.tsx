/**
 * Redirect route for popup OAuth flows
 * This route ensures cookies are set in the popup before redirecting to OAuth provider
 * This allows the popup to access the same session cookies as the main window
 */
import type { Route } from "./+types/auth.redirect";
import { redirect } from "react-router";
import { getSession, commitSession } from "~/lib/session";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get("url");
  const stateFromUrl = url.searchParams.get("state");

  if (!targetUrl) {
    return redirect("/?error=" + encodeURIComponent("Missing redirect URL"));
  }

  // Get session to ensure cookies are initialized in the popup window
  const session = await getSession(request);
  
  // If state is passed in URL (from popup flow), ensure it's in the session
  // This handles cases where cookies aren't shared between windows
  if (stateFromUrl && !session.get("oauthState")) {
    session.set("oauthState", stateFromUrl);
  }
  
  // Commit session to ensure cookies are set
  const cookie = await commitSession(session);
  
  // Redirect to the OAuth provider
  // The session cookies will now be available when the callback runs in this popup
  return redirect(targetUrl, {
    headers: {
      "Set-Cookie": cookie,
    },
  });
}

