import type { Route } from "./+types/projects";
import { redirect } from "react-router";
import { getSession } from "~/lib/session";
import { BasecampClient } from "~/lib/basecampApi/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { FolderKanban, AlertCircle } from "lucide-react";

export interface BasecampProject {
  id: number;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  url: string;
  app_url: string;
  status: string;
  dock: unknown[];
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Projects - Basecamp Integration" },
    { name: "description", content: "View your Basecamp projects" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSession(request);
  const accessToken = session.get("accessToken");

  // Redirect to home if not authenticated
  if (!accessToken) {
    return redirect("/?error=" + encodeURIComponent("Please authenticate first"));
  }

  // Get account ID from session or environment variable
  // Note: Account ID should ideally be stored during OAuth flow or fetched from API
  const accountId = session.get("accountId") || process.env.BASECAMP_ACCOUNT_ID;

  if (!accountId) {
    return {
      error: "Account ID not found. Please ensure BASECAMP_ACCOUNT_ID is set or account ID is stored in session.",
      projects: [],
    };
  }

  try {
    const client = new BasecampClient({
      accessToken,
      accountId: String(accountId),
      userAgent: "Basecamp Integration (your-email@example.com)",
    });

    // Get the first page to get total count
    const firstPageResponse = await client.get<BasecampProject[]>("/projects.json");
    
    // Fetch all pages using getAllPages to get complete list
    const allProjects = await client.getAllPages<BasecampProject>("/projects.json");
    
    return {
      projects: allProjects || [],
      totalCount: firstPageResponse.totalCount || allProjects.length,
      error: null,
    };
  } catch (error: unknown) {
    console.error("Error fetching projects:", error);
    
    const errorMessage = error && typeof error === "object" && "message" in error
      ? String(error.message)
      : "Failed to fetch projects from Basecamp API";

    return {
      projects: [],
      error: errorMessage,
    };
  }
}

export default function Projects({ loaderData }: Route.ComponentProps) {
  const { projects, error, totalCount } = loaderData;

  return (
    <main className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <FolderKanban className="h-8 w-8" />
              Projects
            </h1>
            {totalCount !== undefined && (
              <p className="text-muted-foreground mt-1">
                {totalCount} {totalCount === 1 ? "project" : "projects"} total
              </p>
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <p className="text-sm">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Projects List */}
        {projects.length === 0 && !error && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-center">
                No projects found.
              </p>
            </CardContent>
          </Card>
        )}

        {projects.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Card key={project.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{project.name}</CardTitle>
                    <Badge variant={project.status === "active" ? "default" : "secondary"}>
                      {project.status}
                    </Badge>
                  </div>
                  {project.description && (
                    <CardDescription className="line-clamp-2">
                      {project.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div>
                      Created: {new Date(project.created_at).toLocaleDateString()}
                    </div>
                    <div>
                      Updated: {new Date(project.updated_at).toLocaleDateString()}
                    </div>
                    {project.app_url && (
                      <a
                        href={project.app_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-block"
                      >
                        Open in Basecamp →
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}


