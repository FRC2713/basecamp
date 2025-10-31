import type { Route } from "./+types/mfg.parts";
import { redirect } from "react-router";
import { isOnshapeAuthenticated } from "~/lib/session";
import { createOnshapeClient } from "~/lib/onshapeApi/client";
import type { OnshapePart } from "~/lib/onshapeApi/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { AlertCircle, Box } from "lucide-react";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "MFG Parts - Onshape Integration" },
    { name: "description", content: "View parts from Onshape Part Studio" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  // Check Onshape authentication (required)
  const onshapeAuthenticated = await isOnshapeAuthenticated(request);
  if (!onshapeAuthenticated) {
    return redirect("/auth/onshape?redirect=/mfg/parts");
  }

  // Extract query parameters
  const url = new URL(request.url);
  const documentId = url.searchParams.get("documentId");
  const instanceType = url.searchParams.get("instanceType") || "w"; // Default to workspace
  const instanceId = url.searchParams.get("instanceId");
  const elementId = url.searchParams.get("elementId");
  const elementType = url.searchParams.get("elementType");

  // Validate required parameters
  if (!documentId || !instanceId || !elementId) {
    return {
      error: "Missing required query parameters. Required: documentId, instanceId, elementId. Optional: instanceType (defaults to 'w'), elementType.",
      parts: [],
      queryParams: {
        documentId,
        instanceType,
        instanceId,
        elementId,
        elementType,
      },
      exampleUrl: "/mfg/parts?elementType=PARTSTUDIO&documentId={$documentId}&instanceType={$workspaceOrVersion}&instanceId={$workspaceOrVersionId}&elementId={$elementId}",
    };
  }

  // Validate elementType if provided
  if (elementType && elementType !== "PARTSTUDIO") {
    return {
      error: `Invalid elementType: "${elementType}". Expected "PARTSTUDIO" or omit this parameter.`,
      parts: [],
      queryParams: {
        documentId,
        instanceType,
        instanceId,
        elementId,
        elementType,
      },
      exampleUrl: "/mfg/parts?elementType=PARTSTUDIO&documentId={$documentId}&instanceType={$workspaceOrVersion}&instanceId={$workspaceOrVersionId}&elementId={$elementId}",
    };
  }

  try {
    const client = await createOnshapeClient(request);
    
    // Call Onshape API to get parts
    const parts = await client.getParts(documentId, instanceType, instanceId, elementId);

    return {
      parts,
      queryParams: {
        documentId,
        instanceType,
        instanceId,
        elementId,
        elementType,
      },
      error: null,
    };
  } catch (error: unknown) {
    console.error("Error fetching parts from Onshape:", error);
    
    const errorMessage = error && typeof error === "object" && "message" in error
      ? String(error.message)
      : "Failed to fetch parts from Onshape API";

    const errorStatus = error && typeof error === "object" && "status" in error
      ? Number(error.status)
      : undefined;

    let detailedError = errorMessage;
    if (errorStatus === 404) {
      detailedError = "Part Studio not found. Please verify the documentId, instanceId, and elementId are correct.";
    } else if (errorStatus === 401 || errorStatus === 403) {
      detailedError = "Authentication failed. Please ensure you have access to this document and are authenticated with Onshape.";
    }

    return {
      parts: [],
      queryParams: {
        documentId,
        instanceType,
        instanceId,
        elementId,
        elementType,
      },
      error: detailedError,
      exampleUrl: "/mfg/parts?elementType=PARTSTUDIO&documentId={$documentId}&instanceType={$workspaceOrVersion}&instanceId={$workspaceOrVersionId}&elementId={$elementId}",
    };
  }
}

export default function MfgParts({ loaderData }: Route.ComponentProps) {
  const { parts, queryParams, error, exampleUrl } = loaderData;

  return (
    <main className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Box className="h-8 w-8" />
              MFG Parts
            </h1>
            <p className="text-muted-foreground mt-1">
              {parts.length} {parts.length === 1 ? "part" : "parts"} found
            </p>
          </div>
        </div>

        {/* Query Parameters Info */}
        {queryParams.documentId && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Part Studio Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-semibold">Document ID:</span>{" "}
                  <code className="bg-muted px-1 rounded">{queryParams.documentId}</code>
                </div>
                <div>
                  <span className="font-semibold">Instance Type:</span>{" "}
                  <code className="bg-muted px-1 rounded">{queryParams.instanceType}</code>
                </div>
                <div>
                  <span className="font-semibold">Instance ID:</span>{" "}
                  <code className="bg-muted px-1 rounded">{queryParams.instanceId}</code>
                </div>
                <div>
                  <span className="font-semibold">Element ID:</span>{" "}
                  <code className="bg-muted px-1 rounded">{queryParams.elementId}</code>
                </div>
                {queryParams.elementType && (
                  <div>
                    <span className="font-semibold">Element Type:</span>{" "}
                    <Badge variant="secondary">{queryParams.elementType}</Badge>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error Message */}
        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  <p className="text-sm font-semibold">Error</p>
                </div>
                <p className="text-sm">{error}</p>
                {exampleUrl && (
                  <div className="mt-4 p-3 bg-muted rounded-md text-xs space-y-2">
                    <p className="font-semibold">Example URL format:</p>
                    <code className="block bg-background px-2 py-1 rounded break-all">
                      {exampleUrl}
                    </code>
                    <p className="text-muted-foreground">
                      When used in Onshape, placeholders like {"{$documentId}"} are automatically replaced with actual values.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Parts List */}
        {parts.length === 0 && !error && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-center">
                No parts found in this Part Studio.
              </p>
            </CardContent>
          </Card>
        )}

        {parts.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Parts</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {parts.map((part) => (
                <Card key={part.partId} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg">
                        {part.name || `Part ${part.partId}`}
                      </CardTitle>
                      {part.isHidden && (
                        <Badge variant="secondary">Hidden</Badge>
                      )}
                    </div>
                    {part.name && (
                      <CardDescription>
                        Part ID: <code className="text-xs">{part.partId}</code>
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      {part.bodyType && (
                        <div>
                          <span className="font-semibold">Body Type:</span>{" "}
                          <Badge variant="outline">{part.bodyType}</Badge>
                        </div>
                      )}
                      {part.isMesh !== undefined && (
                        <div>
                          <span className="font-semibold">Type:</span>{" "}
                          {part.isMesh ? "Mesh" : "Solid"}
                        </div>
                      )}
                      {part.appearance && (
                        <div>
                          <span className="font-semibold">Appearance:</span>{" "}
                          {part.appearance.color && (
                            <span className="inline-block w-4 h-4 rounded border border-gray-300 ml-1 align-middle" 
                                  style={{
                                    backgroundColor: `rgba(${part.appearance.color[0]}, ${part.appearance.color[1]}, ${part.appearance.color[2]}, ${part.appearance.opacity ?? part.appearance.color[3] ?? 1})`
                                  }}
                            />
                          )}
                        </div>
                      )}
                      {part.microversionId && (
                        <div className="text-xs">
                          <span className="font-semibold">Microversion:</span>{" "}
                          <code className="bg-muted px-1 rounded">{part.microversionId}</code>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

