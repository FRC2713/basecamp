import type { Route } from "./+types/mfg.parts";
import { redirect, useNavigation, useFetcher, useRevalidator } from "react-router";
import { getSession, isOnshapeAuthenticated, isBasecampAuthenticated, commitSession } from "~/lib/session";
import { refreshBasecampTokenIfNeededWithSession } from "~/lib/tokenRefresh";
import { BasecampClient } from "~/lib/basecampApi/client";
import { getCardTable, type CardTableColumn } from "~/lib/basecampApi/cardTables";
import { getAllCardsInColumn, createCardTableCard, moveCardTableCard, type CardTableCard } from "~/lib/basecampApi/cardTableCards";
import { createOnshapeApiClient, getPartsWmve, getElementsInDocument, getWmvepMetadata, updateWvepMetadata, type BtPartMetadataInfo } from "~/lib/onshapeApi/generated-wrapper";
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
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { AlertCircle, Box, Code } from "lucide-react";
import { useState, useEffect } from "react";

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
 * Component to display manufacturing tracking state for a part
 */
function PartMfgState({ 
  part, 
  cards, 
  columns 
}: { 
  part: BtPartMetadataInfo; 
  cards: Array<CardTableCard & { listTitle?: string; columnId?: number }>; 
  columns: CardTableColumn[];
}) {
  const fetcher = useFetcher();
  const revalidator = useRevalidator();

  // Handle successful card operations
  useEffect(() => {
    if (fetcher.data?.success) {
      revalidator.revalidate();
    }
  }, [fetcher.data, revalidator]);

  // Don't show anything if part has no part number
  if (!part.partNumber) {
    return null;
  }

  // Find card with matching title (exact match)
  const matchingCard = cards.find(card => card.title === part.partNumber);

  // Find current column if card exists
  const currentColumn = matchingCard 
    ? columns.find(col => {
        const columnIdNum = Number(col.id);
        const cardParentId = matchingCard.parent?.id;
        const cardColumnId = matchingCard.columnId;
        return (cardParentId !== undefined && Number(cardParentId) === columnIdNum) ||
               (cardColumnId !== undefined && Number(cardColumnId) === columnIdNum);
      })
    : null;

  // If card not found, show "Add to manufacturing tracker" button
  if (!matchingCard) {
    return (
      <div className="space-y-2">
        <fetcher.Form method="post">
          <input type="hidden" name="action" value="addCard" />
          <input type="hidden" name="partNumber" value={part.partNumber} />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            className="w-full"
            disabled={fetcher.state === "submitting"}
          >
            {fetcher.state === "submitting" ? "Adding..." : "Add to manufacturing tracker"}
          </Button>
        </fetcher.Form>
        {fetcher.data && !fetcher.data.success && fetcher.data.error && (
          <p className="text-xs text-destructive">{fetcher.data.error}</p>
        )}
      </div>
    );
  }

  // If card found, show dropdown with column selection
  const handleColumnChange = (newColumnId: string) => {
    const formData = new FormData();
    formData.append("action", "moveCard");
    formData.append("cardId", matchingCard.id.toString());
    formData.append("columnId", newColumnId);
    fetcher.submit(formData, { method: "post" });
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs">Manufacturing State:</Label>
      <Select
        value={currentColumn?.id.toString() || ""}
        onValueChange={handleColumnChange}
        disabled={fetcher.state === "submitting"}
      >
        <SelectTrigger className="w-full h-8">
          <SelectValue placeholder="Select column...">
            {currentColumn?.title || "Select column..."}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {columns.map((column) => (
            <SelectItem key={column.id} value={column.id.toString()}>
              {column.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {fetcher.data && !fetcher.data.success && fetcher.data.error && (
        <p className="text-xs text-destructive">{fetcher.data.error}</p>
      )}
    </div>
  );
}

/**
 * Component to display a single part with thumbnail error handling
 */
function PartCard({ 
  part, 
  queryParams,
  cards,
  columns
}: { 
  part: BtPartMetadataInfo; 
  queryParams: { documentId: string | null; instanceType: string; instanceId: string | null; elementId: string | null; elementType?: string | null };
  cards: Array<CardTableCard & { listTitle?: string; columnId?: number }>;
  columns: CardTableColumn[];
}) {
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
  const [partNumberInput, setPartNumberInput] = useState("");
  const fetcher = useFetcher();
  const revalidator = useRevalidator();
  const jsonString = JSON.stringify(part, null, 2);

  // Handle successful part number update
  useEffect(() => {
    console.log("[PartCard] Fetcher state changed:", {
      state: fetcher.state,
      data: fetcher.data,
      formData: fetcher.formData,
    });
    
    if (fetcher.data?.success) {
      console.log("[PartCard] Part number update successful, revalidating...");
      setPartNumberInput("");
      revalidator.revalidate();
    } else if (fetcher.data && !fetcher.data.success) {
      console.error("[PartCard] Part number update failed:", fetcher.data.error);
    }
  }, [fetcher.data, fetcher.state, revalidator]);

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
          {part.partNumber ? (
            <>Part Number: <code className="text-xs">{part.partNumber}</code></>
          ) : queryParams.documentId && queryParams.instanceId && queryParams.elementId ? (
            <div className="space-y-2">
              <Label htmlFor={`part-number-${part.partId || part.id}`} className="text-xs">
                Part Number:
              </Label>
              <fetcher.Form 
                method="post" 
                className="flex gap-2"
                onSubmit={(e) => {
                  console.log("[PartCard] Form submitted:", {
                    partId: part.partId || part.id,
                    partNumber: partNumberInput,
                    documentId: queryParams.documentId,
                    instanceType: queryParams.instanceType,
                    instanceId: queryParams.instanceId,
                    elementId: queryParams.elementId,
                  });
                }}
              >
                <input type="hidden" name="partId" value={part.partId || part.id || ""} />
                <input type="hidden" name="documentId" value={queryParams.documentId} />
                <input type="hidden" name="instanceType" value={queryParams.instanceType} />
                <input type="hidden" name="instanceId" value={queryParams.instanceId} />
                <input type="hidden" name="elementId" value={queryParams.elementId} />
                <Input
                  id={`part-number-${part.partId || part.id}`}
                  name="partNumber"
                  value={partNumberInput}
                  onChange={(e) => {
                    console.log("[PartCard] Input changed:", e.target.value);
                    setPartNumberInput(e.target.value);
                  }}
                  placeholder="Enter part number"
                  className="h-8 text-xs flex-1"
                  disabled={fetcher.state === "submitting"}
                />
                <Button
                  type="submit"
                  size="sm"
                  className="h-8"
                  disabled={fetcher.state === "submitting" || !partNumberInput.trim()}
                >
                  {fetcher.state === "submitting" ? "Setting..." : "Set"}
                </Button>
              </fetcher.Form>
              {fetcher.data && !fetcher.data.success && fetcher.data.error && (
                <p className="text-xs text-destructive">
                  Error: {fetcher.data.error}
                </p>
              )}
              {fetcher.data?.success && (
                <p className="text-xs text-green-600 dark:text-green-400">
                  Part number updated successfully!
                </p>
              )}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">Part Number: Not set</span>
          )}
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
      <CardContent className="space-y-4">
        <PartMfgState part={part} cards={cards} columns={columns} />
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

export async function action({ request }: Route.ActionArgs) {
  const session = await getSession(request);
  const formData = await request.formData();
  const actionType = formData.get("action")?.toString();

  // Handle Basecamp card operations (addCard, moveCard)
  if (actionType === "addCard" || actionType === "moveCard") {
    // Check Basecamp authentication
    const basecampAuthenticated = await isBasecampAuthenticated(request);
    if (!basecampAuthenticated) {
      return { success: false, error: "Please authenticate with Basecamp first", redirect: "/auth" };
    }

    try {
      await refreshBasecampTokenIfNeededWithSession(session);
      const accessToken = session.get("accessToken");
      if (!accessToken) {
        return { success: false, error: "Not authenticated", redirect: "/auth" };
      }

      const cookie = await commitSession(session);
      const sessionAccountId = session.get("accountId");
      const envAccountId = process.env.BASECAMP_ACCOUNT_ID;
      const accountId = sessionAccountId || envAccountId;
      const projectId = process.env.BASECAMP_PROJECT_ID;
      const cardTableId = process.env.BASECAMP_CARD_TABLE_ID;

      if (!accountId || !projectId || !cardTableId) {
        return { success: false, error: "Basecamp configuration not found" };
      }

      const client = new BasecampClient({
        accessToken,
        accountId: String(accountId),
        userAgent: "Basecamp Integration",
      });

      if (actionType === "addCard") {
        // Add card to tracker
        const partNumber = formData.get("partNumber")?.toString();
        if (!partNumber) {
          return { success: false, error: "Part number is required" };
        }

        // Get card table to find columns
        const cardTableResponse = await getCardTable(client, projectId, cardTableId);
        const allColumns = cardTableResponse.data.lists || [];
        
        // Find column with lowest position value
        const columnsWithPosition = allColumns.filter(col => col.position !== undefined);
        let targetColumn;
        
        if (columnsWithPosition.length > 0) {
          // Sort by position and take the one with lowest position
          targetColumn = columnsWithPosition.sort((a, b) => 
            (a.position || Infinity) - (b.position || Infinity)
          )[0];
        } else {
          // Fallback: try to find Triage column, otherwise use first column
          targetColumn = allColumns.find(
            col => col.title?.toLowerCase() === "triage column" || col.title?.toLowerCase() === "triage"
          ) || allColumns[0];
        }

        if (!targetColumn) {
          return { success: false, error: "No columns found in card table" };
        }

        await createCardTableCard(client, projectId, targetColumn.id, {
          title: partNumber,
        });

        return { 
          success: true,
          headers: {
            "Set-Cookie": cookie,
          },
        };
      } else if (actionType === "moveCard") {
        // Move card to different column
        const cardId = formData.get("cardId")?.toString();
        const columnId = formData.get("columnId")?.toString();

        if (!cardId || !columnId) {
          return { success: false, error: "Card ID and column ID are required" };
        }

        await moveCardTableCard(client, projectId, cardId, columnId);

        return { 
          success: true,
          headers: {
            "Set-Cookie": cookie,
          },
        };
      }
    } catch (error: unknown) {
      console.error("Error in Basecamp card operation:", error);
      const errorMessage = error && typeof error === "object" && "message" in error
        ? String(error.message)
        : "Failed to perform card operation";
      return { success: false, error: errorMessage };
    }
  }

  // Handle part number update (original functionality)
  console.log("[ACTION] Starting part number update");
  
  // Check Onshape authentication (required)
  const onshapeAuthenticated = await isOnshapeAuthenticated(request);
  if (!onshapeAuthenticated) {
    console.error("[ACTION] Not authenticated with Onshape");
    return { success: false, error: "Not authenticated with Onshape" };
  }

  try {
    const partId = formData.get("partId")?.toString();
    const partNumber = formData.get("partNumber")?.toString();
    const documentId = formData.get("documentId")?.toString();
    const instanceType = formData.get("instanceType")?.toString() || "w";
    const instanceId = formData.get("instanceId")?.toString();
    const elementId = formData.get("elementId")?.toString();

    console.log("[ACTION] Form data received:", {
      partId,
      partNumber,
      documentId,
      instanceType,
      instanceId,
      elementId,
    });

    if (!partId || !partNumber || !documentId || !instanceId || !elementId) {
      const missing = [];
      if (!partId) missing.push("partId");
      if (!partNumber) missing.push("partNumber");
      if (!documentId) missing.push("documentId");
      if (!instanceId) missing.push("instanceId");
      if (!elementId) missing.push("elementId");
      console.error("[ACTION] Missing required fields:", missing);
      return { success: false, error: `Missing required fields: ${missing.join(", ")}` };
    }

    const client = await createOnshapeApiClient(request);
    console.log("[ACTION] Client created successfully");

    // First, get the metadata to find the propertyId for "Part number"
    console.log("[ACTION] Fetching metadata for part:", { documentId, instanceType, instanceId, elementId, partId });
    const metadataResponse = await getWmvepMetadata({
      client,
      path: {
        did: documentId,
        wvm: instanceType as 'w' | 'v' | 'm',
        wvmid: instanceId,
        eid: elementId,
        iden: 'p',
        pid: partId,
      },
      query: {
        includeComputedProperties: true,
      },
    });

    console.log("[ACTION] Metadata response received:", {
      hasData: !!metadataResponse.data,
      jsonType: metadataResponse.data?.jsonType,
      propertiesCount: metadataResponse.data?.properties?.length || 0,
    });

    const metadata = metadataResponse.data;
    if (!metadata || !metadata.properties) {
      console.error("[ACTION] Failed to retrieve part metadata or properties missing");
      console.error("[ACTION] Metadata object:", JSON.stringify(metadata, null, 2));
      return { success: false, error: "Failed to retrieve part metadata or no properties found" };
    }

    // Log all available properties for debugging
    console.log("[ACTION] Available properties:", metadata.properties.map((prop: any) => ({
      name: prop.name,
      propertyId: prop.propertyId,
      value: prop.value,
      editable: prop.editable,
    })));

    // Find the "Part number" property (try multiple possible names)
    const partNumberProperty = metadata.properties.find(
      (prop: any) => {
        const name = prop.name?.toLowerCase();
        return name === "part number" || 
               name === "partnumber" || 
               name === "part_number" ||
               prop.propertyId?.includes("partnumber") ||
               prop.propertyId?.includes("part_number");
      }
    );

    console.log("[ACTION] Part number property search result:", {
      found: !!partNumberProperty,
      propertyName: partNumberProperty?.name,
      propertyId: partNumberProperty?.propertyId,
      editable: partNumberProperty?.editable,
    });

    if (!partNumberProperty || !partNumberProperty.propertyId) {
      console.error("[ACTION] Part number property not found in metadata");
      const availableNames = metadata.properties.map((p: any) => p.name).filter(Boolean);
      return { 
        success: false, 
        error: `Part number property not found. Available properties: ${availableNames.join(", ") || "none"}` 
      };
    }

    // Update the part number using the metadata API
    const updateBody = JSON.stringify({
      jsonType: "metadata-part",
      partId: partId,
      properties: [
        {
          value: partNumber.trim(),
          propertyId: partNumberProperty.propertyId,
        },
      ],
    });

    console.log("[ACTION] Sending update request with body:", updateBody);

    const updateResponse = await updateWvepMetadata({
      client,
      path: {
        did: documentId,
        wvm: instanceType as 'w' | 'v' | 'm',
        wvmid: instanceId,
        eid: elementId,
        iden: 'p',
        pid: partId,
      },
      body: updateBody,
    });

    console.log("[ACTION] Update response received:", {
      hasData: !!updateResponse.data,
      response: JSON.stringify(updateResponse.data, null, 2),
    });

    return { success: true };
  } catch (error: unknown) {
    console.error("[ACTION] Error updating part number:", error);
    
    let errorMessage = "Failed to update part number";
    let errorDetails: any = {};
    
    if (error && typeof error === "object") {
      if ("message" in error) {
        errorMessage = String(error.message);
      }
      if ("status" in error) {
        errorDetails.status = error.status;
      }
      if ("response" in error && error.response) {
        errorDetails.response = error.response;
        try {
          if (typeof error.response === "object" && "data" in error.response) {
            errorDetails.responseData = error.response.data;
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }
    }

    console.error("[ACTION] Error details:", errorDetails);

    return { 
      success: false, 
      error: `${errorMessage}${errorDetails.status ? ` (Status: ${errorDetails.status})` : ""}` 
    };
  }
}

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSession(request);
  
  // Check Onshape authentication (required)
  const onshapeAuthenticated = await isOnshapeAuthenticated(request);
  if (!onshapeAuthenticated) {
    return redirect("/auth/onshape?redirect=/mfg/parts");
  }

  // Check Basecamp authentication (optional - page still works without it)
  let basecampCards: Array<CardTableCard & { listTitle?: string; columnId?: number }> = [];
  let basecampColumns: CardTableColumn[] = [];
  let basecampError: string | null = null;
  
  const basecampAuthenticated = await isBasecampAuthenticated(request);
  if (basecampAuthenticated) {
    try {
      await refreshBasecampTokenIfNeededWithSession(session);
      const accessToken = session.get("accessToken");
      const sessionAccountId = session.get("accountId");
      const envAccountId = process.env.BASECAMP_ACCOUNT_ID;
      const accountId = sessionAccountId || envAccountId;
      const projectId = process.env.BASECAMP_PROJECT_ID;
      const cardTableId = process.env.BASECAMP_CARD_TABLE_ID;

      if (accessToken && accountId && projectId && cardTableId) {
        const client = new BasecampClient({
          accessToken,
          accountId: String(accountId),
          userAgent: "Basecamp Integration",
        });

        // Get card table and columns
        const cardTableResponse = await getCardTable(client, projectId, cardTableId);
        const cardTable = cardTableResponse.data;
        
        // Extract and sort columns
        const allColumns = cardTable.lists || [];
        const columns = [...allColumns].sort((a, b) => {
          if (a.position !== undefined && b.position !== undefined) {
            return a.position - b.position;
          }
          if (a.position !== undefined) return -1;
          if (b.position !== undefined) return 1;
          return 0;
        });
        basecampColumns = columns;

        // Get all cards from all columns
        for (const column of columns) {
          try {
            const cards = await getAllCardsInColumn(client, projectId, column.id);
            const cardsWithList = cards.map(card => ({
              ...card,
              listTitle: column.title,
              columnId: column.id,
            }));
            basecampCards.push(...cardsWithList);
          } catch (error) {
            console.warn(`Failed to fetch cards from column "${column.title}":`, error);
          }
        }
      }
    } catch (error) {
      console.warn("Failed to fetch Basecamp card data:", error);
      basecampError = error && typeof error === "object" && "message" in error
        ? String(error.message)
        : "Unknown error";
    }
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

    const cookie = await commitSession(session);

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
      basecampCards,
      basecampColumns,
      basecampError,
      headers: {
        "Set-Cookie": cookie,
      },
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
      basecampCards: [],
      basecampColumns: [],
      basecampError: null,
    };
  }
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

