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
  
  console.log("[AUTH LOADER] URL:", url.pathname + url.search);
  console.log("[AUTH LOADER] State param:", url.searchParams.get("state"));
  
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

  const clientId = process.env.BASECAMP_CLIENT_ID;
  const redirectUri = process.env.BASECAMP_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    throw new Error("Missing BASECAMP_CLIENT_ID or BASECAMP_REDIRECT_URI environment variables");
  }
  
  // Check if we have a state parameter in the URL (from our own init endpoint)
  const stateParam = url.searchParams.get("state");
  
  if (stateParam) {
    // We have a state from init, use it to build auth URL
    console.log("[AUTH] Using state from URL param:", stateParam);
    
    // Verify the state matches what's in the session
    const storedState = session.get("oauthState");
    console.log("[AUTH] Stored state in session:", storedState);
    console.log("[AUTH] States match:", stateParam === storedState);
    
    const authUrl = getAuthorizationUrl(redirectUri, clientId, stateParam);
    
    return {
      authUrl,
      usePopup: true,
      redirectTo,
    };
  }
  
  // No state yet - render page that will call init endpoint
  console.log("[AUTH] No state yet, need to initialize");
  return {
    authUrl: null,
    usePopup: true,
    redirectTo,
  };
}

// New action to initialize OAuth state
export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json(
      { error: "Method not allowed" },
      { status: 405 }
    );
  }

  const session = await getSession(request);
  const body = await request.json();
  const { redirectTo } = body;

  // Generate state for CSRF protection
  const state = randomBytes(32).toString("hex");
  console.log("[AUTH] Generated new state via action:", state);
  
  session.set("oauthState", state);
  if (redirectTo && redirectTo !== "/") {
    session.set("oauthRedirect", redirectTo);
  }

  // Commit session to ensure cookie is set
  const cookie = await commitSession(session);
  console.log("[AUTH] Set session cookie with state via action. Cookie header length:", cookie.length);
  
  return Response.json(
    { state },
    {
      headers: {
        "Set-Cookie": cookie,
      },
    }
  );
}

export default function Auth({ loaderData }: Route.ComponentProps) {
  if (!loaderData || !loaderData.usePopup) {
    return null; // Shouldn't render - already redirected
  }

  const { authUrl, redirectTo } = loaderData;

  useEffect(() => {
    // If we don't have an authUrl yet, we need to initialize the state first
    if (!authUrl) {
      console.log("[AUTH CLIENT] No authUrl, calling init action");
      const initializeAuth = async () => {
        try {
          const response = await fetch("/auth", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({ redirectTo }),
          });

          const data = await response.json();
          
          if (data.state) {
            console.log("[AUTH CLIENT] Got state from server, reloading with state");
            // Reload the page with the state parameter so loader can build authUrl
            window.location.href = `/auth?state=${data.state}&redirect=${encodeURIComponent(redirectTo || "/")}`;
          } else {
            console.error("[AUTH CLIENT] Failed to initialize auth:", data.error);
            window.location.href = `/?error=${encodeURIComponent(data.error || "Failed to initialize authentication")}`;
          }
        } catch (error) {
          console.error("[AUTH CLIENT] Error initializing auth:", error);
          window.location.href = `/?error=${encodeURIComponent("Failed to initialize authentication")}`;
        }
      };
      
      initializeAuth();
      return;
    }

    console.log("[AUTH CLIENT] Have authUrl, opening popup");
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
            credentials: "include", // Include cookies (session) in the request
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
