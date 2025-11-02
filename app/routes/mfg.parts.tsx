import type { Route } from "./+types/mfg.parts";
import { redirect, useNavigation } from "react-router";
import { isOnshapeAuthenticated } from "~/lib/session";
import { createOnshapeApiClient, getPartsWmve, getElementsInDocument, type BtPartMetadataInfo } from "~/lib/onshapeApi/generated-wrapper";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Skeleton } from "~/components/ui/skeleton";
import { AlertCircle, Box, Code } from "lucide-react";
import { useState } from "react";

/**
 * Skeleton component for PartCard loading state
 */
function PartCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-8 w-16" />
        </div>
        <Skeleton className="h-4 w-24 mt-2" />
      </CardHeader>
      <div className="px-6 pb-4">
        <Skeleton className="w-full rounded border" style={{ height: '300px' }} />
      </div>
      <CardContent>
        {/* Empty content for spacing */}
      </CardContent>
    </Card>
  );
}

/**
 * Component to display a single part with thumbnail error handling
 */
function PartCard({ part }: { part: BtPartMetadataInfo }) {
  // Always prefer 300x300 thumbnail from sizes array
  // The main href is just a JSON link, not an image
  const rawThumbnailUrl = part.thumbnailInfo?.sizes?.find(s => s.size === "300x300")?.href ||
    part.thumbnailInfo?.sizes?.[0]?.href ||
    part.thumbnailInfo?.sizes?.find(s => s.size === "600x340")?.href;
  
  // Use proxy endpoint for authenticated thumbnail access
  const thumbnailHref = rawThumbnailUrl 
    ? `/api/onshape/thumbnail?url=${encodeURIComponent(rawThumbnailUrl)}`
    : null;
  
  const [thumbnailError, setThumbnailError] = useState(false);
  const [isJsonDialogOpen, setIsJsonDialogOpen] = useState(false);
  const jsonString = JSON.stringify(part, null, 2);

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg">
            {part.name || `Part ${part.partId || part.id || 'Unknown'}`}
          </CardTitle>
          <div className="flex items-center gap-2">
            {part.isHidden && (
              <Badge variant="secondary">Hidden</Badge>
            )}
            <Dialog open={isJsonDialogOpen} onOpenChange={setIsJsonDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-8">
                  <Code className="h-4 w-4 mr-1" />
                  JSON
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader>
                  <DialogTitle>
                    {part.name || `Part ${part.partId || part.id || 'Unknown'}`} - JSON
                  </DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-auto bg-muted rounded-md p-4">
                  <pre className="text-xs font-mono whitespace-pre-wrap wrap-break-word">
                    {jsonString}
                  </pre>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <CardDescription>
          Part Number: <code className="text-xs">{part.partNumber || ""}</code>
        </CardDescription>
      </CardHeader>
      {thumbnailHref && !thumbnailError && (
        <div className="px-6 pb-4">
          <img
            src={thumbnailHref}
            alt={`Thumbnail for ${part.name || part.partId || part.id || 'part'}`}
            className="w-full h-auto rounded border bg-muted"
            onError={() => setThumbnailError(true)}
            style={{ maxHeight: '300px', objectFit: 'contain' }}
          />
        </div>
      )}
      <CardContent>
        {/* Empty content for spacing */}
      </CardContent>
    </Card>
  );
}

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
      partStudioName: null,
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
      partStudioName: null,
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
    const client = await createOnshapeApiClient(request);
    
    // Run both API calls in parallel for better performance
    const [elementsResult, partsResult] = await Promise.allSettled([
      // Fetch the part studio name (optional - can fail gracefully)
      getElementsInDocument({
        client,
        path: {
          did: documentId,
          wvm: instanceType as 'w' | 'v' | 'm',
          wvmid: instanceId,
        },
        query: {
          elementId: elementId,
        },
      }),
      // Fetch parts data (required - failure should propagate)
      getPartsWmve({
        client,
        path: {
          did: documentId,
          wvm: instanceType,
          wvmid: instanceId,
          eid: elementId,
        },
        query: {
          withThumbnails: true,
        },
      }),
    ]);

    // Handle part studio name result (optional - continue if it fails)
    let partStudioName: string | null = null;
    if (elementsResult.status === 'fulfilled') {
      try {
        const elements = Array.isArray(elementsResult.value.data) ? elementsResult.value.data : [];
        const element = elements.find((el) => el.id === elementId);
        if (element?.name) {
          partStudioName = element.name;
        }
      } catch (error) {
        // If we can't process the element name, continue without it
        console.warn("Failed to process part studio name:", error);
      }
    } else {
      // If fetching the element name failed, continue without it
      console.warn("Failed to fetch part studio name:", elementsResult.reason);
    }

    // Handle parts result (required - failure should propagate)
    if (partsResult.status === 'rejected') {
      // Re-throw the error to be caught by outer catch block
      throw partsResult.reason;
    }

    // Extract parts from response (response.data is an array of BtPartMetadataInfo)
    const parts = partsResult.value.data || [];

    return {
      parts,
      partStudioName,
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
    
    // Handle error response from generated client
    let errorMessage = "Failed to fetch parts from Onshape API";
    let errorStatus: number | undefined;

    if (error && typeof error === "object") {
      if ("message" in error) {
        errorMessage = String(error.message);
      }
      if ("status" in error) {
        errorStatus = Number(error.status);
      }
      // The generated client might return error in a different format
      if ("error" in error && error.error && typeof error.error === "object") {
        if ("message" in error.error) {
          errorMessage = String(error.error.message);
        }
        if ("status" in error.error) {
          errorStatus = Number(error.error.status);
        }
      }
      // Check response object for status
      if ("response" in error && error.response && typeof error.response === "object") {
        if ("status" in error.response) {
          errorStatus = Number(error.response.status);
        }
      }
    }

    let detailedError = errorMessage;
    if (errorStatus === 404) {
      detailedError = "Part Studio not found. Please verify the documentId, instanceId, and elementId are correct.";
    } else if (errorStatus === 401 || errorStatus === 403) {
      detailedError = "Authentication failed. Please ensure you have access to this document and are authenticated with Onshape.";
    }

    return {
      parts: [],
      partStudioName: null,
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
  const { parts, partStudioName, queryParams, error, exampleUrl } = loaderData;
  const navigation = useNavigation();
  const isLoading = navigation.state === "loading";

  // Show loading screen while data is being fetched
  if (isLoading) {
    return (
      <main className="container mx-auto py-8 px-4">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header Skeleton */}
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Box className="h-8 w-8" />
                <Skeleton className="h-8 w-48" />
              </div>
              <Skeleton className="h-5 w-32" />
            </div>
          </div>

          {/* Parts Grid Skeleton */}
          <div>
            <Skeleton className="h-7 w-24 mb-4" />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <PartCardSkeleton key={index} />
              ))}
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Box className="h-8 w-8" />
              {partStudioName || "MFG Parts"}
            </h1>
            <p className="text-muted-foreground mt-1">
              {parts.length} {parts.length === 1 ? "part" : "parts"} found
            </p>
          </div>
        </div>

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
                <PartCard key={part.partId || part.id || part.partIdentity || JSON.stringify(part)} part={part} />
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

