/**
 * Basecamp Card Tables API
 * Documentation: https://github.com/basecamp/bc3-api/blob/master/sections/card_tables.md
 */

import type { BasecampClient } from "./client";
import type { BasecampResponse } from "./client";

/**
 * Card Table interface based on Basecamp API structure
 */
export interface CardTable {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
  url: string;
  app_url: string;
  position: number;
  bucket: {
    id: number;
    name: string;
    type: string;
  };
  creator: {
    id: number;
    name: string;
    email_address: string;
  };
  board?: {
    id: number;
    name: string;
    position: number;
  };
  status?: string;
  /**
   * Columns are returned in the "lists" property
   * (They're columns but the API calls them lists in the response)
   */
  lists?: CardTableColumn[];
}

/**
 * Get a specific card table by ID
 * GET /buckets/{project_id}/card_tables/{card_table_id}.json
 * 
 * @param client - BasecampClient instance
 * @param projectId - The project/bucket ID
 * @param cardTableId - The card table ID
 * @returns Promise resolving to the card table data
 */
export async function getCardTable(
  client: BasecampClient,
  projectId: number | string,
  cardTableId: number | string
): Promise<BasecampResponse<CardTable>> {
  return client.get<CardTable>(
    `/buckets/${projectId}/card_tables/${cardTableId}.json`
  );
}

/**
 * Get all card tables for a project
 * GET /buckets/{project_id}/card_tables.json
 * 
 * @param client - BasecampClient instance
 * @param projectId - The project/bucket ID
 * @returns Promise resolving to an array of card tables
 */
export async function getCardTables(
  client: BasecampClient,
  projectId: number | string
): Promise<BasecampResponse<CardTable[]>> {
  return client.get<CardTable[]>(
    `/buckets/${projectId}/card_tables.json`
  );
}

/**
 * Get all card tables for a project (paginated - retrieves all pages)
 * 
 * @param client - BasecampClient instance
 * @param projectId - The project/bucket ID
 * @returns Promise resolving to an array of all card tables across all pages
 */
export async function getAllCardTables(
  client: BasecampClient,
  projectId: number | string
): Promise<CardTable[]> {
  return client.getAllPages<CardTable>(
    `/buckets/${projectId}/card_tables.json`
  );
}

/**
 * Card Table Column interface
 * Documentation: https://github.com/basecamp/bc3-api/blob/master/sections/card_table_columns.md
 */
export interface CardTableColumn {
  id: number;
  title: string;
  position: number;
  created_at: string;
  updated_at: string;
  url: string;
  app_url: string;
  cards_count: number;
}

/**
 * Get all columns for a card table
 * GET /buckets/{project_id}/card_tables/{card_table_id}/columns.json
 * Documentation: https://github.com/basecamp/bc3-api/blob/master/sections/card_table_columns.md
 * 
 * @param client - BasecampClient instance
 * @param projectId - The project/bucket ID
 * @param cardTableId - The card table ID
 * @returns Promise resolving to an array of columns
 */
export async function getCardTableColumns(
  client: BasecampClient,
  projectId: number | string,
  cardTableId: number | string
): Promise<BasecampResponse<CardTableColumn[]>> {
  return client.get<CardTableColumn[]>(
    `/buckets/${projectId}/card_tables/${cardTableId}/columns.json`
  );
}

/**
 * @deprecated Use getCardTableColumns instead
 * Kept for backwards compatibility
 */
export const getCardTableLists = getCardTableColumns;

