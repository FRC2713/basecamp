import type { Route } from "./+types/auth.callback";
import { useEffect } from "react";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  // Extract OAuth parameters and return them to client
  // Client will send code/state to parent via postMessage
  return {
    code,
    state,
    error,
  };
}

export default function AuthCallback({ loaderData }: Route.ComponentProps) {
  useEffect(() => {
    if (!loaderData) {
      return;
    }

    const { code, state, error } = loaderData;

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
      // Not in popup - redirect to home with error
      const errorMsg = error || "No authorization code received";
      window.location.href = `/?error=${encodeURIComponent(errorMsg)}`;
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
