import type { Route } from "./+types/auth";
import { redirect } from "react-router";
import { getAuthorizationUrl } from "~/lib/basecampApi/auth";
import { getSession, commitSession } from "~/lib/session";
import { randomBytes } from "node:crypto";
import { useEffect } from "react";

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSession(request);
  const url = new URL(request.url);
  const redirectTo = url.searchParams.get("redirect") || "/";
  
  // Check if already authenticated
  if (session.get("accessToken")) {
    // Commit session to ensure cookie is set
    const cookie = await commitSession(session);
    return redirect(redirectTo, {
      headers: {
        "Set-Cookie": cookie,
      },
    });
  }
  
  // If we're already in an OAuth flow (have oauthState), don't start a new one
  // This prevents redirect loops
  if (session.get("oauthState")) {
    // Still return popup mode, but don't regenerate state
    const existingState = session.get("oauthState");
    const storedRedirect = session.get("oauthRedirect") || redirectTo;
    
    const clientId = process.env.BASECAMP_CLIENT_ID;
    const redirectUri = process.env.BASECAMP_REDIRECT_URI;
    
    if (!clientId || !redirectUri) {
      throw new Error("Missing BASECAMP_CLIENT_ID or BASECAMP_REDIRECT_URI environment variables");
    }
    
    const authUrl = getAuthorizationUrl(redirectUri, clientId, existingState);
    const cookie = await commitSession(session);
    const redirectUrlWithState = `/auth/redirect?url=${encodeURIComponent(authUrl)}&state=${existingState}`;
    
    return {
      authUrl: redirectUrlWithState,
      usePopup: true,
      redirectTo: storedRedirect,
      headers: {
        "Set-Cookie": cookie,
      },
    };
  }

  const clientId = process.env.BASECAMP_CLIENT_ID;
  const redirectUri = process.env.BASECAMP_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    throw new Error("Missing BASECAMP_CLIENT_ID or BASECAMP_REDIRECT_URI environment variables");
  }

  // Generate state for CSRF protection (include redirect in state)
  const state = randomBytes(32).toString("hex");
  session.set("oauthState", state);
  if (redirectTo !== "/") {
    session.set("oauthRedirect", redirectTo);
  }

  // Always use popup mode for Basecamp OAuth
  // Generate authorization URL (use standard redirect URI - don't modify it)
  const authUrl = getAuthorizationUrl(redirectUri, clientId, state);
  
  // Commit session first to ensure cookie is set
  const cookie = await commitSession(session);
  
  // Store state in URL as backup for popup windows (cookie might not be shared)
  const redirectUrlWithState = `/auth/redirect?url=${encodeURIComponent(authUrl)}&state=${state}`;
  
  // Return auth URL for client-side popup handling
  return {
    authUrl: redirectUrlWithState,
    usePopup: true,
    redirectTo,
    headers: {
      "Set-Cookie": cookie,
    },
  };
}

export default function Auth({ loaderData }: Route.ComponentProps) {
  if (!loaderData || !loaderData.usePopup) {
    return null; // Shouldn't render - already redirected
  }

  const { authUrl, redirectTo } = loaderData;

  useEffect(() => {
    // Open OAuth in popup window
    // First open our auth redirect route which will set cookies, then redirect to Basecamp
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    // authUrl already includes the redirect URL with state parameter
    // Open it directly - it will go through /auth/redirect first
    const popup = window.open(
      authUrl,
      "Basecamp OAuth",
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
    );

    if (!popup) {
      alert("Please allow popups for this site to complete authentication.");
      window.location.href = redirectTo || "/";
      return;
    }

    // Poll for popup to close or redirect
    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        // Redirect to home page - the callback will handle setting cookies
        // Since cookies are set server-side, we can just reload
        window.location.href = redirectTo || "/";
      }
    }, 500);

    // Listen for messages from popup (if callback posts message)
    const messageHandler = (event: MessageEvent) => {
      // Only accept messages from our origin
      if (event.origin !== window.location.origin) return;
      
      if (event.data.type === "oauth-complete") {
        clearInterval(checkClosed);
        window.removeEventListener("message", messageHandler);
        // Don't close popup here - let the callback close it after redirect
        // Don't redirect here - let the callback redirect the parent directly
        // This prevents double redirects
      }
    };

    window.addEventListener("message", messageHandler);

    return () => {
      clearInterval(checkClosed);
      window.removeEventListener("message", messageHandler);
    };
  }, [authUrl, redirectTo]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold">Connecting to Basecamp</h1>
        <p className="text-muted-foreground">
          A popup window should open for authentication.
        </p>
        <p className="text-sm text-muted-foreground">
          If the popup doesn't open, please allow popups for this site.
        </p>
      </div>
    </div>
  );
}
