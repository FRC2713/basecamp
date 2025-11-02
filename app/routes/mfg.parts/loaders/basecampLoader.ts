import { getSession, isBasecampAuthenticated } from "~/lib/session";
import { refreshBasecampTokenIfNeededWithSession } from "~/lib/tokenRefresh";
import { BasecampClient } from "~/lib/basecampApi/client";
import { getCardTable, type CardTableColumn } from "~/lib/basecampApi/cardTables";
import { getAllCardsInColumn, type CardTableCard } from "~/lib/basecampApi/cardTableCards";
import type { CardWithColumn } from "../utils/types";

export interface BasecampLoaderResult {
  cards: CardWithColumn[];
  columns: CardTableColumn[];
  error: string | null;
}

/**
 * Load Basecamp card table data (optional - page works without it)
 */
export async function loadBasecampData(request: Request): Promise<BasecampLoaderResult> {
  const session = await getSession(request);
  
  let basecampCards: CardWithColumn[] = [];
  let basecampColumns: CardTableColumn[] = [];
  let basecampError: string | null = null;
  
  const basecampAuthenticated = await isBasecampAuthenticated(request);
  if (!basecampAuthenticated) {
    return { cards: basecampCards, columns: basecampColumns, error: null };
  }

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

  return { cards: basecampCards, columns: basecampColumns, error: basecampError };
}

