import { getSession, isBasecampAuthenticated, commitSession } from "~/lib/session";
import { refreshBasecampTokenIfNeededWithSession } from "~/lib/tokenRefresh";
import { BasecampClient } from "~/lib/basecampApi/client";
import { getCardTable } from "~/lib/basecampApi/cardTables";
import { createCardTableCard, moveCardTableCard } from "~/lib/basecampApi/cardTableCards";
import type { ActionResponse } from "../utils/types";

/**
 * Handle adding a card to the Basecamp card table
 */
export async function handleAddCard(
  formData: FormData,
  session: any
): Promise<ActionResponse> {
  const partNumber = formData.get("partNumber")?.toString();
  if (!partNumber) {
    return { success: false, error: "Part number is required" };
  }

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
}

/**
 * Handle moving a card between columns
 */
export async function handleMoveCard(
  formData: FormData,
  session: any
): Promise<ActionResponse> {
  const cardId = formData.get("cardId")?.toString();
  const columnId = formData.get("columnId")?.toString();

  if (!cardId || !columnId) {
    return { success: false, error: "Card ID and column ID are required" };
  }

  // Ensure IDs are valid numbers
  const cardIdNum = Number(cardId);
  const columnIdNum = Number(columnId);

  if (isNaN(cardIdNum) || isNaN(columnIdNum)) {
    console.error("[ACTION] Invalid ID format:", { cardIdNum, columnIdNum });
    return { success: false, error: `Invalid ID format: cardId=${cardId}, columnId=${columnId}` };
  }

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

  console.log("[ACTION] Calling moveCardTableCard with:", {
    projectId,
    cardId: cardIdNum,
    destinationColumnId: columnIdNum,
  });

  try {
    const result = await moveCardTableCard(client, projectId, cardIdNum, columnIdNum);
    console.log("[ACTION] Move card successful:", result);
  } catch (moveError: unknown) {
    console.error("[ACTION] Move card API error:", moveError);
    
    // Log detailed error information
    if (moveError && typeof moveError === "object") {
      if ("response" in moveError && moveError.response) {
        console.error("[ACTION] Error response:", moveError.response);
        if (typeof moveError.response === "object" && "data" in moveError.response) {
          console.error("[ACTION] Error response data:", moveError.response.data);
        }
        if (typeof moveError.response === "object" && "status" in moveError.response) {
          console.error("[ACTION] Error status:", moveError.response.status);
        }
      }
      if ("status" in moveError) {
        console.error("[ACTION] Error status:", moveError.status);
      }
      if ("message" in moveError) {
        console.error("[ACTION] Error message:", moveError.message);
      }
    }
    
    throw moveError; // Re-throw to be caught by outer catch
  }

  return { 
    success: true,
    headers: {
      "Set-Cookie": cookie,
    },
  };
}

