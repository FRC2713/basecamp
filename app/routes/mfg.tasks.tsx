import type { Route } from "./+types/mfg.tasks";
import { redirect } from "react-router";
import { getSession } from "~/lib/session";
import { BasecampClient } from "~/lib/basecampApi/client";
import { getCardTable, type CardTableColumn } from "~/lib/basecampApi/cardTables";
import { getAllCardsInColumn, createCardTableCard } from "~/lib/basecampApi/cardTableCards";
import type { CardTableCard } from "~/lib/basecampApi/cardTableCards";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { AlertCircle, CheckSquare2, ChevronDown, ChevronUp, Plus } from "lucide-react";
import { useState, useEffect } from "react";
import { useFetcher, useRevalidator } from "react-router";

/**
 * Card with list information
 */
export interface CardWithList extends CardTableCard {
  listTitle?: string;
  columnId?: number;
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "MFG Tasks - Basecamp Integration" },
    { name: "description", content: "View tasks from the MFG card table" },
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
  // Note: The account ID must match the one in your Basecamp URL
  const sessionAccountId = session.get("accountId");
  const envAccountId = process.env.BASECAMP_ACCOUNT_ID;
  const accountId = sessionAccountId || envAccountId;

  if (!accountId) {
      return {
        error: "Account ID not found. Please ensure BASECAMP_ACCOUNT_ID is set or account ID is stored in session.",
        cards: [],
        cardTable: null,
        columns: [],
        triageColumnId: null,
      };
  }

  // Warn if session and env account IDs don't match
  if (sessionAccountId && envAccountId && sessionAccountId !== envAccountId) {
    console.warn("Account ID mismatch:", {
      session: sessionAccountId,
      env: envAccountId,
      using: accountId,
    });
  }

  // Get project ID and card table ID from environment variables
  const projectId = process.env.BASECAMP_PROJECT_ID;
  const cardTableId = process.env.BASECAMP_CARD_TABLE_ID;

  if (!projectId || !cardTableId) {
      return {
        error: "Project ID or Card Table ID not found. Please ensure BASECAMP_PROJECT_ID and BASECAMP_CARD_TABLE_ID are set in environment variables.",
        cards: [],
        cardTable: null,
        columns: [],
        triageColumnId: null,
      };
  }

  try {
    const client = new BasecampClient({
      accessToken,
      accountId: String(accountId),
      userAgent: "Basecamp Integration (your-email@example.com)",
    });

    // Debug: Log the IDs being used
    console.log("Fetching card table with:", {
      projectId,
      cardTableId,
      accountId,
    });
    
    // Construct the expected API URL for debugging
    const expectedUrl = `https://3.basecampapi.com/${accountId}/buckets/${projectId}/card_tables/${cardTableId}.json`;
    console.log("Expected API URL:", expectedUrl);

    // API Call #1: Get the card table (includes columns in the "lists" property)
    let cardTable;
    const cardTableEndpoint = `GET /buckets/${projectId}/card_tables/${cardTableId}.json`;
    console.log(`[API Call #1] Attempting: ${cardTableEndpoint}`);
    try {
      const cardTableResponse = await getCardTable(client, projectId, cardTableId);
      cardTable = cardTableResponse.data;
      console.log(`[API Call #1] ✅ Success - Card table found: "${cardTable.title}"`);
      
      // Columns are included in the card table response under the "lists" property
      if (cardTable.lists) {
        console.log(`[API Call #1] Found ${cardTable.lists.length} columns in card table response`);
      }
    } catch (error: unknown) {
      const errorMessage = error && typeof error === "object" && "message" in error
        ? String(error.message)
        : "Unknown error";
      
      const errorStatus = error && typeof error === "object" && "status" in error
        ? String(error.status)
        : "unknown";
      
      const errorReason = error && typeof error === "object" && "reason" in error
        ? String(error.reason)
        : undefined;
      
      console.error(`[API Call #1] ❌ FAILED: ${cardTableEndpoint}`, {
        message: errorMessage,
        status: errorStatus,
        reason: errorReason,
        accountId,
        projectId,
        cardTableId,
        fullUrl: expectedUrl,
      });
      
      let detailedError = `Failed to fetch card table (API Call #1: ${cardTableEndpoint}): ${errorMessage}`;
      if (errorReason) {
        detailedError += ` (Reason: ${errorReason})`;
      }
      detailedError += `. Verify the IDs match your Basecamp URL: https://3.basecamp.com/${accountId}/buckets/${projectId}/card_tables/${cardTableId}`;
      
      return {
        cards: [],
        cardTable: null,
        columns: [],
        triageColumnId: null,
        error: detailedError,
      };
    }

    // Extract columns from the card table's "lists" property
    // (They're columns but the API returns them as "lists")
    const allColumns = cardTable.lists || [];
    
    // Sort columns: those with position values first (sorted by position), then those without
    const columns = [...allColumns].sort((a, b) => {
      // If both have position, sort by position
      if (a.position !== undefined && b.position !== undefined) {
        return a.position - b.position;
      }
      // If only a has position, a comes first
      if (a.position !== undefined) {
        return -1;
      }
      // If only b has position, b comes first
      if (b.position !== undefined) {
        return 1;
      }
      // Neither has position, maintain original order
      return 0;
    });
    
    console.log(`Extracted ${columns.length} columns from card table lists property (sorted by position)`);

    // API Call #2: Get all cards from all columns
    const allCards: CardWithList[] = [];
    
    for (const column of columns) {
      const cardsEndpoint = `GET /buckets/${projectId}/card_tables/lists/${column.id}/cards.json`;
      console.log(`[API Call #2] Attempting: ${cardsEndpoint} (Column: "${column.title}")`);
      try {
        const cards = await getAllCardsInColumn(client, projectId, column.id);
        // Add column title and ID to each card for display
        const cardsWithList = cards.map(card => ({
          ...card,
          listTitle: column.title,
          columnId: column.id,
        }));
        allCards.push(...cardsWithList);
        console.log(`[API Call #2] ✅ Success - Fetched ${cards.length} cards from column "${column.title}"`);
      } catch (error) {
        console.error(`[API Call #2] ❌ FAILED: ${cardsEndpoint}`, {
          columnId: column.id,
          columnTitle: column.title,
          error,
        });
        // Continue with other columns even if one fails
      }
    }

    // Find the "Triage Column" (case-insensitive)
    const triageColumn = columns.find(
      col => col.title?.toLowerCase() === "triage column" || col.title?.toLowerCase() === "triage"
    );

    return {
      cards: allCards,
      cardTable,
      columns: columns || [],
      triageColumnId: triageColumn?.id ? String(triageColumn.id) : null,
      error: null,
    };
  } catch (error: unknown) {
    console.error("Unexpected error fetching card table cards:", error);
    
    const errorMessage = error && typeof error === "object" && "message" in error
      ? String(error.message)
      : "Failed to fetch cards from Basecamp API";

    return {
      cards: [],
      cardTable: null,
      columns: [],
      triageColumnId: null,
      error: `Unexpected error: ${errorMessage}`,
    };
  }
}

export async function action({ request }: Route.ActionArgs) {
  const session = await getSession(request);
  const accessToken = session.get("accessToken");

  if (!accessToken) {
    return { success: false, error: "Not authenticated" };
  }

  const sessionAccountId = session.get("accountId");
  const envAccountId = process.env.BASECAMP_ACCOUNT_ID;
  const accountId = sessionAccountId || envAccountId;

  if (!accountId) {
    return { success: false, error: "Account ID not found" };
  }

  const projectId = process.env.BASECAMP_PROJECT_ID;
  if (!projectId) {
    return { success: false, error: "Project ID not found" };
  }

  try {
    const formData = await request.formData();
    const title = formData.get("title")?.toString();
    const description = formData.get("description")?.toString();

    if (!title) {
      return { success: false, error: "Title is required" };
    }

    // Get the Triage Column ID from the loader data
    // We need to fetch the card table again to find the Triage Column
    const client = new BasecampClient({
      accessToken,
      accountId: String(accountId),
      userAgent: "Basecamp Integration (your-email@example.com)",
    });

    const cardTableId = process.env.BASECAMP_CARD_TABLE_ID;
    if (!cardTableId) {
      return { success: false, error: "Card Table ID not found" };
    }

    // Fetch the card table to get columns
    const cardTableResponse = await getCardTable(client, projectId, cardTableId);
    const allColumns = cardTableResponse.data.lists || [];
    
    // Find the "Triage Column" (case-insensitive)
    const triageColumn = allColumns.find(
      col => col.title?.toLowerCase() === "triage column" || col.title?.toLowerCase() === "triage"
    );

    if (!triageColumn) {
      return { success: false, error: "Triage Column not found. Please ensure a column named 'Triage Column' or 'Triage' exists." };
    }

    const response = await createCardTableCard(client, projectId, triageColumn.id, {
      title,
      description: description || undefined,
    });

    return { success: true, card: response.data };
  } catch (error: unknown) {
    const errorMessage = error && typeof error === "object" && "message" in error
      ? String(error.message)
      : "Failed to create card";
    
    return { success: false, error: errorMessage };
  }
}

export default function MfgTasks({ loaderData }: Route.ComponentProps) {
  const { cards, cardTable, columns, error, triageColumnId } = loaderData;
  const fetcher = useFetcher();
  const revalidator = useRevalidator();
  
  // Track which columns are expanded (default all to collapsed)
  const [expandedColumns, setExpandedColumns] = useState<Set<number>>(new Set());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formTitle, setFormTitle] = useState<string>("");
  const [formDescription, setFormDescription] = useState<string>("");
  
  // Handle successful card creation
  useEffect(() => {
    if (fetcher.data?.success) {
      setIsDialogOpen(false);
      setFormTitle("");
      setFormDescription("");
      // Reload data to show the new card
      revalidator.revalidate();
    }
  }, [fetcher.data, revalidator]);
  
  const toggleColumn = (columnId: number) => {
    setExpandedColumns(prev => {
      const next = new Set(prev);
      if (next.has(columnId)) {
        next.delete(columnId);
      } else {
        next.add(columnId);
      }
      return next;
    });
  };
  
  // Debug: Log what we received
  if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
    console.log('MfgTasks received:', {
      cardsCount: cards.length,
      columnsCount: columns.length,
      sampleCard: cards[0] ? {
        id: cards[0].id,
        title: cards[0].title,
        columnId: cards[0].columnId,
        parentId: cards[0].parent?.id,
        parentType: cards[0].parent?.type,
      } : null,
      columnIds: columns.map(c => ({ id: c.id, title: c.title, type: typeof c.id })),
      allCardColumnIds: cards.map(c => ({ id: c.id, columnId: c.columnId, parentId: c.parent?.id })),
    });
  }

  return (
    <main className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <CheckSquare2 className="h-8 w-8" />
              MFG Tasks
            </h1>
            {cardTable && (
              <p className="text-muted-foreground mt-1">
                {cardTable.title} • {columns.length} {columns.length === 1 ? "column" : "columns"} • {cards.length} {cards.length === 1 ? "card" : "cards"}
              </p>
            )}
          </div>
          {columns.length > 0 && triageColumnId && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4" />
                  Add Task
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Task</DialogTitle>
                  <DialogDescription>
                    Create a new card in the Triage Column
                  </DialogDescription>
                </DialogHeader>
                <fetcher.Form method="post">
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Title *</Label>
                      <Input
                        id="title"
                        name="title"
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        placeholder="Enter task title"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        name="description"
                        value={formDescription}
                        onChange={(e) => setFormDescription(e.target.value)}
                        placeholder="Enter task description (optional)"
                        rows={4}
                      />
                    </div>
                    {fetcher.data && fetcher.data.success && (
                      <div className="text-sm text-green-600 dark:text-green-400">
                        Task created successfully!
                      </div>
                    )}
                    {fetcher.data && !fetcher.data.success && (
                      <div className="text-sm text-destructive">
                        {fetcher.data.error}
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsDialogOpen(false);
                        setFormTitle("");
                        setFormDescription("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={fetcher.state === "submitting"}
                    >
                      {fetcher.state === "submitting" ? "Creating..." : "Create Task"}
                    </Button>
                  </DialogFooter>
                </fetcher.Form>
              </DialogContent>
            </Dialog>
          )}
          {columns.length > 0 && !triageColumnId && (
            <Button disabled>
              <Plus className="h-4 w-4" />
              Add Task
            </Button>
          )}
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
                <div className="mt-4 p-3 bg-muted rounded-md text-xs space-y-2">
                  <p className="font-semibold">How to find the correct IDs:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>In Basecamp, "buckets" and "projects" are the same thing - the API uses "buckets"</li>
                    <li>From your Basecamp URL: <code className="bg-background px-1 rounded">https://3.basecamp.com/[ACCOUNT_ID]/buckets/[PROJECT_ID]/card_tables/[CARD_TABLE_ID]</code></li>
                    <li>Extract the IDs from the URL:
                      <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                        <li><code className="bg-background px-1 rounded">ACCOUNT_ID</code> → use for <code className="bg-background px-1 rounded">BASECAMP_ACCOUNT_ID</code></li>
                        <li><code className="bg-background px-1 rounded">PROJECT_ID</code> (after /buckets/) → use for <code className="bg-background px-1 rounded">BASECAMP_PROJECT_ID</code></li>
                        <li><code className="bg-background px-1 rounded">CARD_TABLE_ID</code> (after /card_tables/) → use for <code className="bg-background px-1 rounded">BASECAMP_CARD_TABLE_ID</code></li>
                      </ul>
                    </li>
                    <li>Example: For URL <code className="bg-background px-1 rounded">...buckets/39558018/card_tables/7927478670</code>:
                      <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                        <li><code className="bg-background px-1 rounded">BASECAMP_PROJECT_ID=39558018</code></li>
                        <li><code className="bg-background px-1 rounded">BASECAMP_CARD_TABLE_ID=7927478670</code></li>
                      </ul>
                    </li>
                    <li>Visit <code className="bg-background px-1 rounded">/projects</code> route to see all your projects and verify IDs</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Columns List with Cards - Displayed Vertically */}
        {columns.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Columns</h2>
            <div className="space-y-6">
              {columns.map((column) => {
                // Get cards for this column
                // Match by parent.id first (from Basecamp API), then by columnId (that we set)
                const columnIdNum = Number(column.id);
                const columnCards = cards.filter(card => {
                  // Primary match: use parent.id from Basecamp API
                  const cardParentId = card.parent?.id;
                  const matchesParentId = cardParentId !== undefined && Number(cardParentId) === columnIdNum;
                  
                  // Fallback: use columnId we set
                  const cardColumnId = card.columnId;
                  const matchesColumnId = cardColumnId !== undefined && Number(cardColumnId) === columnIdNum;
                  
                  const matches = matchesParentId || matchesColumnId;
                  
                  // Debug each card for this column
                  if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
                    if (!matches && cards.length > 0) {
                      // Only log mismatches to reduce noise
                      if (cards.indexOf(card) < 3) { // Only first 3 for debugging
                        console.log(`❌ Card "${card.title}" does NOT match column "${column.title}"`, {
                          cardId: card.id,
                          cardColumnId,
                          cardParentId,
                          cardParentType: card.parent?.type,
                          columnId: column.id,
                          columnIdType: typeof column.id,
                          matchesParentId,
                          matchesColumnId,
                        });
                      }
                    }
                  }
                  
                  return matches;
                });
                
                // Debug logging for this column
                if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
                  console.log(`Column "${column.title}" (id: ${column.id}, type: ${typeof column.id}): Found ${columnCards.length} cards`, {
                    totalCards: cards.length,
                    cardsWithColumnId: cards.filter(c => c.columnId !== undefined && Number(c.columnId) === Number(column.id)).length,
                    cardsWithParentId: cards.filter(c => c.parent?.id !== undefined && Number(c.parent.id) === Number(column.id)).length,
                    sampleCardColumnId: cards[0]?.columnId,
                    sampleCardParentId: cards[0]?.parent?.id,
                  });
                }
                
                const isExpanded = expandedColumns.has(column.id);
                
                return (
                  <Card key={column.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div 
                        className="flex items-start justify-between cursor-pointer"
                        onClick={() => toggleColumn(column.id)}
                      >
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronUp className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          )}
                          <CardTitle className="text-lg">{column.title}</CardTitle>
                        </div>
                        <Badge variant="secondary">
                          {columnCards.length} / {column.cards_count} {columnCards.length === 1 ? "card" : "cards"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {column.app_url && (
                        <a
                          href={column.app_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline inline-block text-sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Open in Basecamp →
                        </a>
                      )}
                      
                      {/* Cards in this column - only show when expanded */}
                      {isExpanded && (
                        <>
                          {columnCards.length > 0 ? (
                            <div className="space-y-3 pt-2 border-t">
                              {columnCards.map((card) => (
                                <Card key={card.id} className="bg-muted/50">
                                  <CardHeader className="pb-3">
                                    <div className="flex items-start justify-between">
                                      <CardTitle className="text-base">{card.title}</CardTitle>
                                      <Badge variant={card.status === "active" ? "default" : "secondary"} className="text-xs">
                                        {card.status}
                                      </Badge>
                                    </div>
                                  </CardHeader>
                                  <CardContent className="pt-0">
                                    <div className="space-y-1 text-xs text-muted-foreground">
                                      <div>
                                        Created: {new Date(card.created_at).toLocaleDateString()}
                                      </div>
                                      <div>
                                        Updated: {new Date(card.updated_at).toLocaleDateString()}
                                      </div>
                                      {card.comments_count > 0 && (
                                        <div>
                                          Comments: {card.comments_count}
                                        </div>
                                      )}
                                      {card.app_url && (
                                        <a
                                          href={card.app_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-primary hover:underline inline-block mt-1"
                                        >
                                          Open in Basecamp →
                                        </a>
                                      )}
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground pt-2 border-t">
                              No cards in this column
                            </p>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

