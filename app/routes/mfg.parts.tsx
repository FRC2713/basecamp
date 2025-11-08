import type { Route } from "./+types/mfg.parts";
import { redirect } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { getSession, isOnshapeAuthenticated, commitSession } from "~/lib/session";
import { Card, CardContent } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { Box } from "lucide-react";
import { PartCardSkeleton } from "~/components/mfg/PartCardSkeleton";
import { PartCard } from "~/components/mfg/PartCard";
import { ErrorDisplay } from "~/components/mfg/ErrorDisplay";
import { action } from "./mfg.parts/actions";
import { validateQueryParams } from "./mfg.parts/loaders/queryValidation";
import { loadBasecampData } from "./mfg.parts/loaders/basecampLoader";
import type { BtPartMetadataInfo } from "~/lib/onshapeApi/generated-wrapper";

export { action };

export function meta({}: Route.MetaArgs) {
  return [
    { title: "MFG Parts - Onshape Integration" },
    { name: "description", content: "View parts from Onshape Part Studio" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSession(request);
  
  // Check Onshape authentication (required)
  const onshapeAuthenticated = await isOnshapeAuthenticated(request);
  if (!onshapeAuthenticated) {
    return redirect("/auth/onshape?redirect=/mfg/parts");
  }

  // Validate query parameters
  const validation = validateQueryParams(request);
  if (!validation.isValid) {
    return {
      error: validation.error,
      queryParams: validation.queryParams || {
        documentId: null,
        instanceType: "w",
        instanceId: null,
        elementId: null,
        elementType: null,
      },
      exampleUrl: validation.exampleUrl,
      basecampCards: [],
      basecampColumns: [],
      basecampError: null,
    };
  }

  // Load Basecamp data (optional) - still done server-side
  const basecampData = await loadBasecampData(request);

  const cookie = await commitSession(session);

  return {
    queryParams: validation.queryParams!,
    error: null,
    exampleUrl: null,
    basecampCards: basecampData.cards,
    basecampColumns: basecampData.columns,
    basecampError: basecampData.error,
    headers: {
      "Set-Cookie": cookie,
    },
  };
}

export default function MfgParts({ loaderData }: Route.ComponentProps) {
  const { queryParams, error: validationError, exampleUrl, basecampCards, basecampColumns } = loaderData;
  
  // Fetch parts data client-side using TanStack Query
  const {
    data: parts = [],
    isLoading: isLoadingParts,
    error: partsError,
  } = useQuery<BtPartMetadataInfo[]>({
    queryKey: ['parts', queryParams?.documentId, queryParams?.instanceId, queryParams?.elementId],
    queryFn: async () => {
      if (!queryParams?.documentId) {
        return [];
      }
      
      const params = new URLSearchParams({
        documentId: queryParams.documentId,
        instanceType: queryParams.instanceType,
        instanceId: queryParams.instanceId!,
        elementId: queryParams.elementId!,
        withThumbnails: "true",
      });
      
      const response = await fetch(`/api/onshape/parts?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch parts');
      }
      return response.json();
    },
    enabled: !!queryParams?.documentId,
    staleTime: 30 * 1000, // Cache for 30 seconds
  });

  const error = validationError || (partsError ? String(partsError) : null);

  // Show loading screen while data is being fetched
  if (isLoadingParts && queryParams?.documentId) {
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
              MFG Parts
            </h1>
            <p className="text-muted-foreground mt-1">
              {parts.length} {parts.length === 1 ? "part" : "parts"}
            </p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <ErrorDisplay error={error} exampleUrl={exampleUrl || undefined} />
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

        {parts.length > 0 && queryParams && (
          <div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {parts.map((part) => (
                <PartCard 
                  key={part.partId || part.id || part.partIdentity || JSON.stringify(part)} 
                  part={part} 
                  queryParams={queryParams}
                  cards={basecampCards || []}
                  columns={basecampColumns || []}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
