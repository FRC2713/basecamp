import type { Route } from "./+types/mfg.parts";
import { redirect } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import Fuse from "fuse.js";
import {
  getSession,
  isOnshapeAuthenticated,
  isBasecampAuthenticated,
  commitSession,
} from "~/lib/session";
import { Card, CardContent } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Label } from "~/components/ui/label";
import { Button } from "~/components/ui/button";
import { Box, Search, ArrowUpDown } from "lucide-react";
import { PartCardSkeleton } from "~/components/mfg/PartCardSkeleton";
import { PartCard } from "~/components/mfg/PartCard";
import { ErrorDisplay } from "~/components/mfg/ErrorDisplay";
import { action } from "./mfg.parts/actions";
import { validateQueryParams } from "./mfg.parts/loaders/queryValidation";
import { loadBasecampData } from "./mfg.parts/loaders/basecampLoader";
import type { BtPartMetadataInfo } from "~/lib/onshapeApi/generated-wrapper";
import type { CardWithColumn } from "./mfg.parts/utils/types";

export { action };

export function meta({}: Route.MetaArgs) {
  return [
    { title: "MFG Parts - Onshape Integration" },
    { name: "description", content: "View parts from Onshape Part Studio" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSession(request);

  // Check both Basecamp and Onshape authentication (both required)
  const onshapeAuthenticated = await isOnshapeAuthenticated(request);
  const basecampAuthenticated = await isBasecampAuthenticated(request);

  if (!onshapeAuthenticated || !basecampAuthenticated) {
    // Preserve the full URL including query parameters for redirect
    const url = new URL(request.url);
    const fullPath = url.pathname + url.search;
    console.log("[MFG.PARTS] Not authenticated, redirecting to signin");
    console.log("[MFG.PARTS] Full path:", fullPath);
    console.log(
      "[MFG.PARTS] Encoded redirect URL:",
      `/signin?redirect=${encodeURIComponent(fullPath)}`
    );
    return redirect(`/signin?redirect=${encodeURIComponent(fullPath)}`);
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
  const {
    queryParams,
    error: validationError,
    exampleUrl,
    basecampCards,
    basecampColumns,
  } = loaderData;

  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<
    "none" | "name" | "partNumber" | "mfgState" | "createdAt" | "updatedAt"
  >("none");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Fetch parts data client-side using TanStack Query
  const {
    data: parts = [],
    isLoading: isLoadingParts,
    error: partsError,
  } = useQuery<BtPartMetadataInfo[]>({
    queryKey: [
      "parts",
      queryParams?.documentId,
      queryParams?.instanceId,
      queryParams?.elementId,
    ],
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
        throw new Error("Failed to fetch parts");
      }
      return response.json();
    },
    enabled: !!queryParams?.documentId,
    staleTime: 30 * 1000, // Cache for 30 seconds
  });

  // Configure Fuse.js for fuzzy search
  const fuse = useMemo(() => {
    return new Fuse(parts, {
      keys: ["name", "partNumber"],
      threshold: 0.4, // Lower = more strict, higher = more fuzzy
      ignoreLocation: true, // Search anywhere in the string
      minMatchCharLength: 1,
    });
  }, [parts]);

  // Filter parts based on search query
  const filteredParts = useMemo(() => {
    if (!searchQuery.trim()) {
      return parts;
    }
    return fuse.search(searchQuery).map((result) => result.item);
  }, [parts, fuse, searchQuery]);

  // Sort filtered parts
  const sortedParts = useMemo(() => {
    if (sortBy === "none") {
      return filteredParts;
    }

    const partsToSort = [...filteredParts];
    const directionMultiplier = sortDirection === "asc" ? 1 : -1;

    switch (sortBy) {
      case "name":
        return partsToSort.sort((a, b) => {
          const nameA = (a.name || "").toLowerCase();
          const nameB = (b.name || "").toLowerCase();
          return nameA.localeCompare(nameB) * directionMultiplier;
        });

      case "partNumber":
        return partsToSort.sort((a, b) => {
          const numA = (a.partNumber || "").toLowerCase();
          const numB = (b.partNumber || "").toLowerCase();
          return numA.localeCompare(numB) * directionMultiplier;
        });

      case "mfgState": {
        // Sort by manufacturing state (column position)
        return partsToSort.sort((a, b) => {
          const cardA = basecampCards?.find(
            (card) => card.title === a.partNumber
          );
          const cardB = basecampCards?.find(
            (card) => card.title === b.partNumber
          );

          if (!cardA && !cardB) return 0;
          if (!cardA) return 1; // Parts without cards go to the end
          if (!cardB) return -1;

          const columnA = basecampColumns?.find((col) => {
            const columnIdNum = Number(col.id);
            const cardParentId = cardA.parent?.id;
            const cardColumnId = cardA.columnId;
            return (
              (cardParentId !== undefined &&
                Number(cardParentId) === columnIdNum) ||
              (cardColumnId !== undefined &&
                Number(cardColumnId) === columnIdNum)
            );
          });

          const columnB = basecampColumns?.find((col) => {
            const columnIdNum = Number(col.id);
            const cardParentId = cardB.parent?.id;
            const cardColumnId = cardB.columnId;
            return (
              (cardParentId !== undefined &&
                Number(cardParentId) === columnIdNum) ||
              (cardColumnId !== undefined &&
                Number(cardColumnId) === columnIdNum)
            );
          });

          const positionA = columnA?.position ?? Number.MAX_SAFE_INTEGER;
          const positionB = columnB?.position ?? Number.MAX_SAFE_INTEGER;

          return (positionA - positionB) * directionMultiplier;
        });
      }

      case "createdAt": {
        // Sort by card creation date
        return partsToSort.sort((a, b) => {
          const cardA = basecampCards?.find(
            (card) => card.title === a.partNumber
          );
          const cardB = basecampCards?.find(
            (card) => card.title === b.partNumber
          );

          if (!cardA && !cardB) return 0;
          if (!cardA) return 1; // Parts without cards go to the end
          if (!cardB) return -1;

          const dateA = new Date(cardA.created_at).getTime();
          const dateB = new Date(cardB.created_at).getTime();

          // Base sort: newest first (dateB - dateA), then apply direction
          return (dateB - dateA) * directionMultiplier;
        });
      }

      case "updatedAt": {
        // Sort by card last updated date
        return partsToSort.sort((a, b) => {
          const cardA = basecampCards?.find(
            (card) => card.title === a.partNumber
          );
          const cardB = basecampCards?.find(
            (card) => card.title === b.partNumber
          );

          if (!cardA && !cardB) return 0;
          if (!cardA) return 1; // Parts without cards go to the end
          if (!cardB) return -1;

          const dateA = new Date(cardA.updated_at).getTime();
          const dateB = new Date(cardB.updated_at).getTime();

          // Base sort: most recently updated first (dateB - dateA), then apply direction
          return (dateB - dateA) * directionMultiplier;
        });
      }

      default:
        return partsToSort;
    }
  }, [filteredParts, sortBy, sortDirection, basecampCards, basecampColumns]);

  const error = validationError || (partsError ? String(partsError) : null);

  // Show loading screen while data is being fetched
  if (isLoadingParts && queryParams?.documentId) {
    return (
      <main className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-6xl space-y-6">
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
    <main className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Error Message */}
        {error && (
          <ErrorDisplay error={error} exampleUrl={exampleUrl || undefined} />
        )}

        {/* Search and Sort Controls */}
        {parts.length > 0 && !error && (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="relative flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                type="text"
                placeholder="Search parts by name or part number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-end gap-2">
              <div className="w-full space-y-2 sm:w-[200px]">
                <Label htmlFor="sort-select" className="text-sm">
                  Sort by
                </Label>
                <Select
                  value={sortBy}
                  onValueChange={(value: any) => setSortBy(value)}
                >
                  <SelectTrigger id="sort-select">
                    <SelectValue placeholder="No sorting" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No sorting</SelectItem>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="partNumber">Part Number</SelectItem>
                    <SelectItem value="mfgState">
                      Manufacturing State
                    </SelectItem>
                    <SelectItem value="createdAt">Date Created</SelectItem>
                    <SelectItem value="updatedAt">Last Updated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {sortBy !== "none" && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    setSortDirection((prev) =>
                      prev === "asc" ? "desc" : "asc"
                    )
                  }
                  title={`Sort ${sortDirection === "asc" ? "ascending" : "descending"}`}
                  className="h-10 w-10"
                >
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
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
            {sortedParts.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-muted-foreground text-center">
                    No parts match your search query.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {sortedParts.map((part) => (
                  <PartCard
                    key={
                      part.partId ||
                      part.id ||
                      part.partIdentity ||
                      JSON.stringify(part)
                    }
                    part={part}
                    queryParams={queryParams}
                    cards={basecampCards || []}
                    columns={basecampColumns || []}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
