import type { Route } from "./+types/home";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Sparkles, Rocket, BookOpen, Code2, LogIn, LogOut, CheckCircle2 } from "lucide-react";
import { Link, useSearchParams, redirect } from "react-router";
import { isOnshapeAuthenticated, isBasecampAuthenticated, getSession, commitSession } from "~/lib/session";
import { refreshOnshapeTokenIfNeededWithSession, refreshBasecampTokenIfNeededWithSession } from "~/lib/tokenRefresh";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Basecamp Integration" },
    { name: "description", content: "Welcome to Basecamp Integration!" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const hasError = url.searchParams.has("error");
  
  // Check Onshape authentication first (required)
  const onshapeAuthenticated = await isOnshapeAuthenticated(request);
  
  // Get session once
  const session = await getSession(request);
  
  // If there's an error in the URL, don't redirect - let the page render with the error
  // This prevents redirect loops when OAuth callbacks fail
  if (hasError) {
    session.unset("onshapeAuthRedirectCount"); // Clear redirect counter
    return {
      onshapeAuthenticated: false,
      basecampAuthenticated: await isBasecampAuthenticated(request),
      error: url.searchParams.get("error") || undefined,
      headers: {
        "Set-Cookie": await commitSession(session),
      },
    };
  }
  
  // If not authenticated with Onshape, redirect to Onshape auth
  // Use a redirect counter to prevent infinite loops
  if (!onshapeAuthenticated) {
    const redirectCount = session.get("onshapeAuthRedirectCount") || 0;
    
    if (redirectCount < 2) {
      // Allow up to 2 redirects to handle OAuth flow
      session.set("onshapeAuthRedirectCount", redirectCount + 1);
      return redirect("/auth/onshape", {
        headers: {
          "Set-Cookie": await commitSession(session),
        },
      });
    } else {
      // Too many redirects - clear counter and show error
      session.unset("onshapeAuthRedirectCount");
      return {
        onshapeAuthenticated: false,
        basecampAuthenticated: false,
        error: "Unable to authenticate with Onshape. Please refresh the page or try opening in a new window.",
        headers: {
          "Set-Cookie": await commitSession(session),
        },
      };
    }
  }
  
  // Clear redirect counter if authenticated
  session.unset("onshapeAuthRedirectCount");

  // Refresh tokens if needed (this updates the session)
  try {
    await refreshOnshapeTokenIfNeededWithSession(session);
    await refreshBasecampTokenIfNeededWithSession(session);
  } catch (error) {
    // If refresh fails, clear tokens and redirect to auth
    console.error("Token refresh failed:", error);
  }

  // Check Basecamp authentication (optional, for creating cards)
  const basecampAuthenticated = await isBasecampAuthenticated(request);
  
  // Commit session after potential token refresh
  const cookie = await commitSession(session);
  
  return {
    onshapeAuthenticated: true,
    basecampAuthenticated,
    headers: {
      "Set-Cookie": cookie,
    },
  };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { onshapeAuthenticated, basecampAuthenticated, error: loaderError } = loaderData;
  const [searchParams] = useSearchParams();
  const urlError = searchParams.get("error");
  const error = loaderError || urlError;

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-4xl space-y-8">
        {/* Header Section */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2">
            <Sparkles className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold tracking-tight">Welcome to Basecamp</h1>
          </div>
          <p className="text-xl text-muted-foreground">
            Your integration with Basecamp 4 API
          </p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <Badge variant="secondary">React Router v7</Badge>
            <Badge variant="secondary">shadcn/ui</Badge>
            <Badge variant="secondary">Tailwind CSS</Badge>
            {onshapeAuthenticated && (
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Onshape Connected
              </Badge>
            )}
            {basecampAuthenticated && (
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Basecamp Connected
              </Badge>
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive text-sm">
                Authentication error: {decodeURIComponent(error)}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Authentication Status Card */}
        <Card>
          <CardHeader>
            <CardTitle>Authentication Status</CardTitle>
            <CardDescription>
              Manage connections to Onshape and Basecamp
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Onshape</span>
                  {onshapeAuthenticated ? (
                    <Badge variant="default" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Connected
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Not Connected</Badge>
                  )}
                </div>
              </div>
              {onshapeAuthenticated && (
                <p className="text-xs text-muted-foreground">
                  Successfully authenticated with Onshape. You can access Onshape document data.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Basecamp</span>
                  {basecampAuthenticated ? (
                    <Badge variant="default" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Connected
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Not Connected</Badge>
                  )}
                </div>
              </div>
              {basecampAuthenticated ? (
                <p className="text-xs text-muted-foreground">
                  Successfully authenticated with Basecamp. You can create cards in Basecamp.
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Connect Basecamp to create cards from Onshape documents.
                  </p>
                  <Button asChild size="sm" className="w-full">
                    <Link to="/auth?popup=true">
                      <LogIn className="h-4 w-4 mr-2" />
                      Connect Basecamp
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Feature Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <Rocket className="h-6 w-6 text-primary mb-2" />
              <CardTitle>Get Started</CardTitle>
              <CardDescription>
                Begin integrating with the Basecamp API
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="default">
                Start Building
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <BookOpen className="h-6 w-6 text-primary mb-2" />
              <CardTitle>Documentation</CardTitle>
              <CardDescription>
                Explore the Basecamp 4 API documentation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="outline">
                View Docs
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Code2 className="h-6 w-6 text-primary mb-2" />
              <CardTitle>API Integration</CardTitle>
              <CardDescription>
                Connect to Basecamp projects and data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="secondary">
                Explore API
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Quick Links */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Links</CardTitle>
            <CardDescription>
              Resources to help you get started
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <a 
                href="https://github.com/basecamp/bc3-api" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-8 px-3 text-xs"
              >
                Basecamp API Docs
              </a>
              <a 
                href="https://reactrouter.com/docs" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-8 px-3 text-xs"
              >
                React Router Docs
              </a>
              <a 
                href="https://ui.shadcn.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-8 px-3 text-xs"
              >
                shadcn/ui Docs
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
