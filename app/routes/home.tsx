import type { Route } from "./+types/home";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Sparkles, LogIn, CheckCircle2, Box, CheckSquare2, FolderKanban, ArrowRight } from "lucide-react";
import { Link, useSearchParams, redirect } from "react-router";
import { isOnshapeAuthenticated, isBasecampAuthenticated, getSession, commitSession } from "~/lib/session";
import { refreshOnshapeTokenIfNeededWithSession, refreshBasecampTokenIfNeededWithSession } from "~/lib/tokenRefresh";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Onshape & Basecamp Integration" },
    { name: "description", content: "Bridge Onshape CAD data with Basecamp project management. View parts, manage manufacturing tasks, and streamline your workflow." },
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
            <h1 className="text-4xl font-bold tracking-tight">Onshape & Basecamp Integration</h1>
          </div>
          <p className="text-xl text-muted-foreground">
            Bridge your CAD data with project management. View Onshape parts, manage manufacturing tasks, and streamline your workflow.
          </p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
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
                    <Link to="/auth">
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
              <Box className="h-6 w-6 text-primary mb-2" />
              <CardTitle>MFG Parts</CardTitle>
              <CardDescription>
                View and manage Onshape parts from Part Studios. Update part numbers, create Basecamp cards with thumbnails, and track manufacturing states.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full" variant="default">
                <Link to="/mfg/parts">
                  View Parts
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CheckSquare2 className="h-6 w-6 text-primary mb-2" />
              <CardTitle>MFG Tasks</CardTitle>
              <CardDescription>
                View and manage manufacturing tasks in Basecamp card tables. Create new tasks, organize by columns, and track progress.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full" variant="default">
                <Link to="/mfg/tasks">
                  View Tasks
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <FolderKanban className="h-6 w-6 text-primary mb-2" />
              <CardTitle>Projects</CardTitle>
              <CardDescription>
                Browse all your Basecamp projects. View project details, status, and access project management tools.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full" variant="default">
                <Link to="/projects">
                  View Projects
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Quick Links */}
        <Card>
          <CardHeader>
            <CardTitle>Resources</CardTitle>
            <CardDescription>
              Documentation and API references
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
                href="https://cad.onshape.com/help" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-8 px-3 text-xs"
              >
                Onshape Help
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
