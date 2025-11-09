import type { Route } from "./+types/auth.callback";
import { useEffect } from "react";
import { redirect } from "react-router";
import { getSession, commitSession } from "~/lib/session";
import { exchangeCodeForToken } from "~/lib/basecampApi/auth";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  console.log("[CALLBACK] Received OAuth callback");
  console.log("[CALLBACK] Code:", code ? `${code.substring(0, 10)}...` : "null");
  console.log("[CALLBACK] State from URL:", state);
  console.log("[CALLBACK] Error:", error);
  console.log("[CALLBACK] Cookie header:", request.headers.get("Cookie") ? "present" : "missing");

  // If there's an error, return it to be handled by client
  if (error) {
    return {
      code: null,
      state: null,
      error,
      exchangedOnServer: false,
    };
  }

  // If we have code and state, try to determine if this is a popup or not
  // by checking the Sec-Fetch-Dest header or if we can do server-side exchange
  const session = await getSession(request);
  const storedState = session.get("oauthState");
  console.log("[CALLBACK] Stored state from session:", storedState);
  console.log("[CALLBACK] States match:", state === storedState);

  // If we have code, state matches, and state is in session, do server-side exchange
  // This handles the case where OAuth opens in a new tab instead of popup
  if (code && state && storedState && state === storedState) {
    console.log("[CALLBACK] State validation passed, attempting server-side exchange");
    const clientId = process.env.BASECAMP_CLIENT_ID;
    const clientSecret = process.env.BASECAMP_CLIENT_SECRET;
    const redirectUri = process.env.BASECAMP_REDIRECT_URI;

    if (clientId && clientSecret && redirectUri) {
      try {
        console.log("[CALLBACK] Exchanging code for token...");
        // Exchange authorization code for access token on server
        const tokenResponse = await exchangeCodeForToken(
          code,
          redirectUri,
          clientId,
          clientSecret
        );

        console.log("[CALLBACK] Token exchange successful");
        // Store tokens in session
        session.set("accessToken", tokenResponse.access_token);
        session.set("refreshToken", tokenResponse.refresh_token);
        session.set("expiresAt", Date.now() + tokenResponse.expires_in * 1000);

        // Always redirect back to signin page to check if other service needs auth
        const redirectTo = session.get("oauthRedirect") || "/signin";
        session.unset("oauthState");
        session.unset("oauthRedirect");
        // Keep signInRedirect in session - signin page will use it once both services are authenticated

        console.log("[CALLBACK] Redirecting to:", redirectTo);
        // Redirect back to destination with session cookie
        return redirect(redirectTo, {
          headers: {
            "Set-Cookie": await commitSession(session),
          },
        });
      } catch (exchangeError) {
        console.error("[CALLBACK] Server-side token exchange error:", exchangeError);
        // Fall through to return data for client-side handling
      }
    } else {
      console.log("[CALLBACK] Missing env vars for server-side exchange");
    }
  } else {
    console.log("[CALLBACK] Cannot do server-side exchange:");
    console.log("  - Has code:", !!code);
    console.log("  - Has state:", !!state);
    console.log("  - Has storedState:", !!storedState);
    console.log("  - States match:", state === storedState);
  }

  // If server-side exchange didn't happen, return data for client-side popup handling
  return {
    code,
    state,
    error: null,
    exchangedOnServer: false,
  };
}

export default function AuthCallback({ loaderData }: Route.ComponentProps) {
  useEffect(() => {
    if (!loaderData) {
      return;
    }

    const { code, state, error, exchangedOnServer } = loaderData;

    // If already exchanged on server, we would have been redirected
    // This component only renders for popup scenarios
    if (exchangedOnServer) {
      return;
    }

    // Check if we're in a popup window
    const isPopup = typeof window !== "undefined" && !!window.opener;

    if (isPopup && window.opener) {
      // Send code/state or error to parent window via postMessage
      if (error) {
        window.opener.postMessage({ error }, window.location.origin);
      } else if (code && state) {
        window.opener.postMessage({ code, state }, window.location.origin);
      } else {
        window.opener.postMessage(
          { error: "No authorization code received" },
          window.location.origin
        );
      }
      // Close popup after sending message
      setTimeout(() => {
        window.close();
      }, 100);
    } else {
      // Not in popup - show message that window can be closed
      // (Server-side exchange should have already happened in loader)
      // If we're here, something went wrong
      const errorMsg = error || "Authentication completed. You can close this window and return to the app.";
      if (!error) {
        // No error but we're here - redirect to home
        window.location.href = "/";
      } else {
        window.location.href = `/?error=${encodeURIComponent(errorMsg)}`;
      }
    }
  }, [loaderData]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="text-center space-y-4">
        {loaderData?.error ? (
          <>
            <h1 className="text-2xl font-bold text-destructive">Authentication Failed</h1>
            <p className="text-muted-foreground">{loaderData.error}</p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold">Authenticating...</h1>
            <p className="text-muted-foreground">
              This window will close automatically.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
