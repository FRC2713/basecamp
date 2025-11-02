import type { Route } from "../../+types/mfg.parts";
import { getSession } from "~/lib/session";
import { isBasecampAuthenticated } from "~/lib/session";
import { refreshBasecampTokenIfNeededWithSession } from "~/lib/tokenRefresh";
import { handleAddCard, handleMoveCard } from "./cardOperations";
import { handlePartNumberUpdate } from "./partNumberUpdate";
import { createErrorResponse } from "../utils/errorHandling";

/**
 * Main action handler that routes to specific action handlers
 */
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

      if (actionType === "addCard") {
        return await handleAddCard(formData, session);
      } else if (actionType === "moveCard") {
        return await handleMoveCard(formData, session);
      }
    } catch (error: unknown) {
      console.error("Error in Basecamp card operation:", error);
      return createErrorResponse(error, "Failed to perform card operation");
    }
  }

  // Handle part number update (default/fallback)
  return await handlePartNumberUpdate(formData, request);
}

