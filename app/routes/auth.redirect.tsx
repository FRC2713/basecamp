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

  if (!targetUrl) {
    return redirect("/?error=" + encodeURIComponent("Missing redirect URL"));
  }

  // Get session to ensure cookies are initialized in the popup window
  // This ensures the popup has access to the same session cookies as the main window
  const session = await getSession(request);
  
  // Commit session to ensure cookies are set (even if empty, this initializes the cookie)
  const cookie = await commitSession(session);
  
  // Redirect to the OAuth provider
  // The session cookies will now be available when the callback runs in this popup
  return redirect(targetUrl, {
    headers: {
      "Set-Cookie": cookie,
    },
  });
}

