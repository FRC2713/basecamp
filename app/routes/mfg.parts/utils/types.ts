import type { CardTableCard } from "~/lib/basecampApi/cardTableCards";
import type { CardTableColumn } from "~/lib/basecampApi/cardTables";

/**
 * Extended card type with list/column information
 */
export interface CardWithColumn extends CardTableCard {
  listTitle?: string;
  columnId?: number;
}

/**
 * Query parameters for the parts route
 */
export interface PartsQueryParams {
  documentId: string | null;
  instanceType: string;
  instanceId: string | null;
  elementId: string | null;
  elementType?: string | null;
}

/**
 * Action response type
 */
export interface ActionResponse {
  success: boolean;
  error?: string;
  redirect?: string;
  headers?: {
    "Set-Cookie": string;
  };
}

