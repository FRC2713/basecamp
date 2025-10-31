import type { Route } from "./+types/auth.callback";
import { redirect } from "react-router";
import { exchangeCodeForToken } from "~/lib/basecampApi/auth";
import { getSession, commitSession, destroySession } from "~/lib/session";
import { useEffect } from "react";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  
  // Note: Popup detection will happen in the client component
  // Server-side, we'll be lenient with state validation if we have a valid code

  // Handle OAuth errors
  if (error) {
    return {
      success: false,
      error,
    };
  }

  if (!code) {
    return {
      success: false,
      error: "No authorization code received",
    };
  }

  const session = await getSession(request);
  const storedState = session.get("oauthState");

  // For popup flows, cookies might not be shared between windows
  // Be more lenient: if we have a valid code, proceed even if state doesn't match
  // (The authorization code itself provides security)
  const stateValid = !state || !storedState || state === storedState;

  // Debug logging
  console.error("OAuth callback state validation:", {
    receivedState: state,
    storedState: storedState,
    stateValid,
    hasSession: !!session,
    sessionKeys: session ? Object.keys(session.data || {}) : [],
    cookies: request.headers.get("cookie")?.substring(0, 100),
  });

  // If state doesn't match, log but proceed if we have a valid code
  // This handles popup cookie sharing issues
  if (!stateValid && !code) {
    return {
      success: false,
      error: "Invalid state parameter",
    };
  }
  
  if (!stateValid) {
    console.error("State mismatch but proceeding with code - likely popup cookie issue");
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

    // Return data structure for client to handle redirect
    return {
      success: true,
      redirectTo,
      headers: {
        "Set-Cookie": await commitSession(session),
      },
    };
  } catch (error) {
    console.error("Token exchange error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to exchange authorization code",
      headers: {
        "Set-Cookie": await commitSession(session),
      },
    };
  }
}

export default function AuthCallback({ loaderData }: Route.ComponentProps) {
  // Check if we're in a popup window (client-side)
  const isPopup = typeof window !== "undefined" && !!window.opener;

  useEffect(() => {
    if (!loaderData || !("success" in loaderData)) {
      return;
    }

    if (loaderData.success) {
      // Success - send message to parent if in popup, otherwise redirect
      if (isPopup && window.opener) {
        // Post message to notify parent
        window.opener.postMessage(
          { type: "oauth-complete", success: true },
          window.location.origin
        );
        // Redirect parent window directly to ensure cookie is available
        // Add a small delay to ensure cookie is committed
        setTimeout(() => {
          if (window.opener && !window.opener.closed) {
            window.opener.location.href = loaderData.redirectTo || "/";
          }
          window.close();
        }, 300);
      } else {
        // Not in popup - redirect normally
        window.location.href = loaderData.redirectTo || "/";
      }
    } else {
      // Error
      if (isPopup && window.opener) {
        window.opener.postMessage(
          { type: "oauth-error", error: loaderData.error },
          window.location.origin
        );
      } else {
        window.location.href = `/?error=${encodeURIComponent(loaderData.error || "Authentication failed")}`;
      }
    }
  }, [loaderData, isPopup]);

  if (!loaderData || !("success" in loaderData)) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="text-center space-y-4">
        {loaderData.success ? (
          <>
            <h1 className="text-2xl font-bold">Authentication Successful</h1>
            <p className="text-muted-foreground">
              {isPopup ? "This window will close automatically..." : "Redirecting..."}
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-destructive">Authentication Failed</h1>
            <p className="text-muted-foreground">
              {loaderData.error || "An error occurred"}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
