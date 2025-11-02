import type { Route } from "./+types/mfg.parts";
import { redirect, useNavigation } from "react-router";
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
import { loadOnshapeData } from "./mfg.parts/loaders/onshapeLoader";

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
      parts: [],
      partStudioName: null,
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

  // Load Basecamp data (optional)
  const basecampData = await loadBasecampData(request);

  // Load Onshape data (required)
  const onshapeData = await loadOnshapeData(request, validation.queryParams!);

  const cookie = await commitSession(session);

  return {
    parts: onshapeData.parts,
    partStudioName: onshapeData.partStudioName,
    queryParams: validation.queryParams!,
    error: onshapeData.error,
    exampleUrl: onshapeData.exampleUrl,
    basecampCards: basecampData.cards,
    basecampColumns: basecampData.columns,
    basecampError: basecampData.error,
    headers: {
      "Set-Cookie": cookie,
    },
  };
}

export default function MfgParts({ loaderData }: Route.ComponentProps) {
  const { parts, partStudioName, queryParams, error, exampleUrl, basecampCards, basecampColumns } = loaderData;
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
          <ErrorDisplay error={error} exampleUrl={exampleUrl} />
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
            <h2 className="text-xl font-semibold mb-4">Parts</h2>
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
