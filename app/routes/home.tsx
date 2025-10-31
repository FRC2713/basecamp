import type { Route } from "./+types/home";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Sparkles, Rocket, BookOpen, Code2, LogIn, LogOut, CheckCircle2 } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { getSession } from "~/lib/session";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Basecamp Integration" },
    { name: "description", content: "Welcome to Basecamp Integration!" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSession(request);
  const accessToken = session.get("accessToken");
  
  return {
    isAuthenticated: !!accessToken,
  };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { isAuthenticated } = loaderData;
  const [searchParams] = useSearchParams();
  const error = searchParams.get("error");

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
            {isAuthenticated && (
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Authenticated
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
              {isAuthenticated
                ? "You are connected to Basecamp"
                : "Connect your Basecamp account to get started"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isAuthenticated ? (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">
                  You are successfully authenticated with Basecamp. You can now access the API.
                </p>
                <Button asChild variant="outline">
                  <Link to="/auth/logout">
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                  </Link>
                </Button>
              </div>
            ) : (
              <Button asChild className="w-full">
                <Link to="/auth">
                  <LogIn className="h-4 w-4 mr-2" />
                  Login with Basecamp
                </Link>
              </Button>
            )}
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
