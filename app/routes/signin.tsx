import type { Route } from "./+types/signin";
import { redirect } from "react-router";
import { getSession, commitSession, isBasecampAuthenticated, isOnshapeAuthenticated } from "~/lib/session";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Box, CheckCircle2 } from "lucide-react";

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSession(request);
  const url = new URL(request.url);
  const redirectTo = url.searchParams.get("redirect") || "/mfg/parts";

  // Check authentication status
  const basecampAuth = await isBasecampAuthenticated(request);
  const onshapeAuth = await isOnshapeAuthenticated(request);

  // Store redirect path in session for after authentication
  if (redirectTo && redirectTo !== "/") {
    session.set("signInRedirect", redirectTo);
  }

  const cookie = await commitSession(session);

  // If both are authenticated, redirect to the intended destination
  if (basecampAuth && onshapeAuth) {
    return redirect(redirectTo, {
      headers: {
        "Set-Cookie": cookie,
      },
    });
  }

  return {
    basecampAuth,
    onshapeAuth,
    redirectTo,
    headers: {
      "Set-Cookie": cookie,
    },
  };
}

export default function SignIn({ loaderData }: Route.ComponentProps) {
  const { basecampAuth, onshapeAuth, redirectTo } = loaderData;

  const handleBasecampAuth = () => {
    // Redirect to Basecamp auth with return path
    window.location.href = `/auth?redirect=${encodeURIComponent(redirectTo)}`;
  };

  const handleOnshapeAuth = () => {
    // Redirect to Onshape auth with return path
    window.location.href = `/auth/onshape?redirect=${encodeURIComponent(redirectTo)}`;
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <Box className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl text-center">Sign In Required</CardTitle>
          <CardDescription className="text-center">
            Connect your Basecamp and Onshape accounts to continue
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Basecamp Authentication */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Basecamp</h3>
              {basecampAuth && (
                <div className="flex items-center gap-1 text-green-600 dark:text-green-500">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-xs">Connected</span>
                </div>
              )}
            </div>
            <Button
              onClick={handleBasecampAuth}
              variant={basecampAuth ? "outline" : "default"}
              className="w-full"
              disabled={basecampAuth}
            >
              {basecampAuth ? "Basecamp Connected" : "Connect Basecamp"}
            </Button>
          </div>

          {/* Onshape Authentication */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Onshape</h3>
              {onshapeAuth && (
                <div className="flex items-center gap-1 text-green-600 dark:text-green-500">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-xs">Connected</span>
                </div>
              )}
            </div>
            <Button
              onClick={handleOnshapeAuth}
              variant={onshapeAuth ? "outline" : "default"}
              className="w-full"
              disabled={onshapeAuth}
            >
              {onshapeAuth ? "Onshape Connected" : "Connect Onshape"}
            </Button>
          </div>

          {/* Status Message */}
          {basecampAuth && onshapeAuth && (
            <div className="pt-4 text-center">
              <p className="text-sm text-muted-foreground">
                All services connected! Redirecting...
              </p>
            </div>
          )}

          {(!basecampAuth || !onshapeAuth) && (
            <div className="pt-4 text-center">
              <p className="text-sm text-muted-foreground">
                You need to connect both services to access manufacturing parts
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

