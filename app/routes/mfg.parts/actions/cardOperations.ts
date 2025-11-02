import { getSession, isBasecampAuthenticated, commitSession } from "~/lib/session";
import { refreshBasecampTokenIfNeededWithSession, refreshOnshapeTokenIfNeededWithSession } from "~/lib/tokenRefresh";
import { BasecampClient } from "~/lib/basecampApi/client";
import { getCardTable } from "~/lib/basecampApi/cardTables";
import { createCardTableCard, moveCardTableCard, updateCardTableCard } from "~/lib/basecampApi/cardTableCards";
import { updateCardContentWithThumbnail, type PartMetadata } from "../utils/cardContentUpdate";
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

  const cardResponse = await createCardTableCard(client, projectId, targetColumn.id, {
    title: partNumber,
  });

  const createdCardId = cardResponse.data.id;

  // Update card content with thumbnail if part metadata is provided
  const documentId = formData.get("documentId")?.toString();
  const instanceType = formData.get("instanceType")?.toString();
  const instanceId = formData.get("instanceId")?.toString();
  const elementId = formData.get("elementId")?.toString();
  const partId = formData.get("partId")?.toString();

  if (documentId && instanceType && instanceId && elementId && partId) {
    try {
      // Get Onshape token and client
      await refreshOnshapeTokenIfNeededWithSession(session);
      const onshapeAccessToken = session.get("onshapeAccessToken");
      
      if (onshapeAccessToken) {
        // Create Onshape client using the token from session
        const { getOnshapeApiClient } = await import("~/lib/onshapeApi/generated-wrapper");
        const onshapeClientWithToken = getOnshapeApiClient(onshapeAccessToken);

        const partMetadata: PartMetadata = {
          documentId,
          instanceType,
          instanceId,
          elementId,
          partId,
        };

        // Update content with thumbnail (non-blocking - if it fails, card creation still succeeds)
        updateCardContentWithThumbnail(
          createdCardId,
          partMetadata,
          client,
          projectId,
          onshapeClientWithToken,
          onshapeAccessToken
        ).catch((error) => {
          console.warn("[ACTION] Failed to update card content with thumbnail:", error);
        });
      }
    } catch (error) {
      console.warn("[ACTION] Failed to prepare thumbnail update:", error);
      // Don't fail the card creation if thumbnail update fails
    }
  }

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

    // Update card content with thumbnail if part metadata is provided
    const documentId = formData.get("documentId")?.toString();
    const instanceType = formData.get("instanceType")?.toString();
    const instanceId = formData.get("instanceId")?.toString();
    const elementId = formData.get("elementId")?.toString();
    const partId = formData.get("partId")?.toString();

    if (documentId && instanceType && instanceId && elementId && partId) {
      try {
        // Get Onshape token and client
        await refreshOnshapeTokenIfNeededWithSession(session);
        const onshapeAccessToken = session.get("onshapeAccessToken");
        
        if (onshapeAccessToken) {
          const { getOnshapeApiClient } = await import("~/lib/onshapeApi/generated-wrapper");
          const onshapeClientWithToken = getOnshapeApiClient(onshapeAccessToken);

          const partMetadata: PartMetadata = {
            documentId,
            instanceType,
            instanceId,
            elementId,
            partId,
          };

          // Update content with thumbnail (non-blocking)
          updateCardContentWithThumbnail(
            cardIdNum,
            partMetadata,
            client,
            projectId,
            onshapeClientWithToken,
            onshapeAccessToken
          ).catch((error) => {
            console.warn("[ACTION] Failed to update card content with thumbnail:", error);
          });
        }
      } catch (error) {
        console.warn("[ACTION] Failed to prepare thumbnail update:", error);
        // Don't fail the card move if thumbnail update fails
      }
    }
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

/**
 * Handle updating a card's due date
 */
export async function handleUpdateDueDate(
  formData: FormData,
  session: any
): Promise<ActionResponse> {
  const cardId = formData.get("cardId")?.toString();
  const dueOn = formData.get("dueOn")?.toString();

  if (!cardId) {
    return { success: false, error: "Card ID is required" };
  }

  // Ensure ID is a valid number
  const cardIdNum = Number(cardId);

  if (isNaN(cardIdNum)) {
    console.error("[ACTION] Invalid card ID format:", cardId);
    return { success: false, error: `Invalid card ID format: ${cardId}` };
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

  if (!accountId || !projectId) {
    return { success: false, error: "Basecamp configuration not found" };
  }

  const client = new BasecampClient({
    accessToken,
    accountId: String(accountId),
    userAgent: "Basecamp Integration",
  });

  try {
    // If dueOn is empty or null, we'll send null to clear the due date
    const payload = dueOn && dueOn.trim() !== "" ? { due_on: dueOn } : { due_on: null };
    
    await updateCardTableCard(client, projectId, cardIdNum, payload);
    console.log("[ACTION] Update due date successful:", { cardId: cardIdNum, dueOn });

    // Update card content with thumbnail if part metadata is provided
    const documentId = formData.get("documentId")?.toString();
    const instanceType = formData.get("instanceType")?.toString();
    const instanceId = formData.get("instanceId")?.toString();
    const elementId = formData.get("elementId")?.toString();
    const partId = formData.get("partId")?.toString();

    if (documentId && instanceType && instanceId && elementId && partId) {
      try {
        // Get Onshape token and client
        await refreshOnshapeTokenIfNeededWithSession(session);
        const onshapeAccessToken = session.get("onshapeAccessToken");
        
        if (onshapeAccessToken) {
          const { getOnshapeApiClient } = await import("~/lib/onshapeApi/generated-wrapper");
          const onshapeClientWithToken = getOnshapeApiClient(onshapeAccessToken);

          const partMetadata: PartMetadata = {
            documentId,
            instanceType,
            instanceId,
            elementId,
            partId,
          };

          // Update content with thumbnail (non-blocking)
          updateCardContentWithThumbnail(
            cardIdNum,
            partMetadata,
            client,
            projectId,
            onshapeClientWithToken,
            onshapeAccessToken
          ).catch((error) => {
            console.warn("[ACTION] Failed to update card content with thumbnail:", error);
          });
        }
      } catch (error) {
        console.warn("[ACTION] Failed to prepare thumbnail update:", error);
        // Don't fail the card update if thumbnail update fails
      }
    }
  } catch (updateError: unknown) {
    console.error("[ACTION] Update due date API error:", updateError);
    
    // Log detailed error information
    if (updateError && typeof updateError === "object") {
      if ("response" in updateError && updateError.response) {
        console.error("[ACTION] Error response:", updateError.response);
        if (typeof updateError.response === "object" && "data" in updateError.response) {
          console.error("[ACTION] Error response data:", updateError.response.data);
        }
        if (typeof updateError.response === "object" && "status" in updateError.response) {
          console.error("[ACTION] Error status:", updateError.response.status);
        }
      }
      if ("status" in updateError) {
        console.error("[ACTION] Error status:", updateError.status);
      }
      if ("message" in updateError) {
        console.error("[ACTION] Error message:", updateError.message);
      }
    }
    
    throw updateError; // Re-throw to be caught by outer catch
  }

  return { 
    success: true,
    headers: {
      "Set-Cookie": cookie,
    },
  };
}

