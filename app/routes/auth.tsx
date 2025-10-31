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
    
    return {
      authUrl,
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

  // Generate state for CSRF protection
  const state = randomBytes(32).toString("hex");
  session.set("oauthState", state);
  if (redirectTo !== "/") {
    session.set("oauthRedirect", redirectTo);
  }

  // Generate authorization URL - open popup directly to Basecamp OAuth
  const authUrl = getAuthorizationUrl(redirectUri, clientId, state);
  
  // Commit session to ensure cookie is set
  const cookie = await commitSession(session);
  
  // Return auth URL for client-side popup handling
  return {
    authUrl,
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
    // Configure popup window features with proper centering
    const features = {
      width: 600,
      height: 700,
      top: "auto",
      left: "auto",
      toolbar: "no",
      menubar: "no",
      scrollbars: "yes",
      resizable: "yes",
    };

    const strFeatures = Object.entries(features).reduce((str, [key, value]) => {
      if (value === "auto") {
        if (key === "top") {
          value = Math.round(window.innerHeight / 2 - features.height / 2);
        }
        if (key === "left") {
          value = Math.round(window.innerWidth / 2 - features.width / 2);
        }
      }
      return str + `${key}=${value},`;
    }, "").slice(0, -1);

    // Open popup directly to Basecamp OAuth URL
    const popup = window.open(authUrl, "Basecamp OAuth", strFeatures);

    if (!popup) {
      alert("Please allow popups for this site to complete authentication.");
      window.location.href = redirectTo || "/";
      return;
    }

    // Declare interval variable so it can be accessed in messageHandler
    let checkClosed: NodeJS.Timeout;

    // Listen for messages from popup callback
    const messageHandler = async (event: MessageEvent) => {
      // Only accept messages from our origin
      if (event.origin !== window.location.origin) return;

      const { code, state, error } = event.data;

      if (error) {
        clearInterval(checkClosed);
        window.removeEventListener("message", messageHandler);
        window.location.href = `/?error=${encodeURIComponent(error)}`;
        return;
      }

      if (code && state) {
        clearInterval(checkClosed);
        window.removeEventListener("message", messageHandler);

        try {
          // Call exchange API endpoint to exchange code for tokens
          const response = await fetch("/auth/exchange", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ code, state }),
          });

          const data = await response.json();

          if (data.success) {
            // Redirect to destination after successful token exchange
            window.location.href = data.redirectTo || "/";
          } else {
            window.location.href = `/?error=${encodeURIComponent(data.error || "Authentication failed")}`;
          }
        } catch (err) {
          console.error("Failed to exchange authorization code:", err);
          window.location.href = `/?error=${encodeURIComponent("Failed to exchange authorization code")}`;
        }
      }
    };

    // Poll for popup to close (fallback in case message isn't received)
    checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        window.removeEventListener("message", messageHandler);
        // Reload to check authentication status
        window.location.href = redirectTo || "/";
      }
    }, 500);

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
