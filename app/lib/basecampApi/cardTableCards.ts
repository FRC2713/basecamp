/**
 * Basecamp Card Table Cards API
 * Documentation: https://github.com/basecamp/bc3-api/blob/master/sections/card_table_cards.md
 */

import type { BasecampClient, BasecampResponse } from "./client";

/**
 * Card Table Card interface based on Basecamp API structure
 */
export interface CardTableCard {
  id: number;
  status: string;
  visible_to_clients: boolean;
  created_at: string;
  updated_at: string;
  title: string;
  inherits_status: boolean;
  type: string;
  url: string;
  app_url: string;
  bookmark_url: string;
  subscription_url: string;
  comments_count: number;
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
  parent: {
    id: number;
    type: string;
  };
  comments_url?: string;
  position?: number;
  due_on?: string;
}

/**
 * Create Card request payload
 */
export interface CreateCardPayload {
  title: string;
  description?: string;
}

/**
 * Update Card request payload
 */
export interface UpdateCardPayload {
  title?: string;
  description?: string;
  due_on?: string | null;
}

/**
 * Move Card request payload
 */
export interface MoveCardPayload {
  column_id: number; // Column ID (destination column)
}

/**
 * Get a specific card table card by ID
 * GET /buckets/{project_id}/card_tables/cards/{card_id}.json
 * 
 * @param client - BasecampClient instance
 * @param projectId - The project/bucket ID
 * @param cardId - The card ID
 * @returns Promise resolving to the card data
 */
export async function getCardTableCard(
  client: BasecampClient,
  projectId: number | string,
  cardId: number | string
): Promise<BasecampResponse<CardTableCard>> {
  return client.get<CardTableCard>(
    `/buckets/${projectId}/card_tables/cards/${cardId}.json`
  );
}

/**
 * Get all cards in a specific column of a card table
 * GET /buckets/{project_id}/card_tables/lists/{column_id}/cards.json
 * Note: Even though columns are called "columns", cards use "/lists/" in the endpoint
 * Documentation: https://github.com/basecamp/bc3-api/blob/master/sections/card_table_cards.md
 * 
 * @param client - BasecampClient instance
 * @param projectId - The project/bucket ID
 * @param columnId - The column ID (note: endpoint uses "lists" not "columns")
 * @returns Promise resolving to an array of cards
 */
export async function getCardsInColumn(
  client: BasecampClient,
  projectId: number | string,
  columnId: number | string
): Promise<BasecampResponse<CardTableCard[]>> {
  return client.get<CardTableCard[]>(
    `/buckets/${projectId}/card_tables/lists/${columnId}/cards.json`
  );
}

/**
 * Get all cards in a column (paginated - retrieves all pages)
 * GET /buckets/{project_id}/card_tables/lists/{column_id}/cards.json
 * Note: Even though columns are called "columns", cards use "/lists/" in the endpoint
 * 
 * @param client - BasecampClient instance
 * @param projectId - The project/bucket ID
 * @param columnId - The column ID (note: endpoint uses "lists" not "columns")
 * @returns Promise resolving to an array of all cards across all pages
 */
export async function getAllCardsInColumn(
  client: BasecampClient,
  projectId: number | string,
  columnId: number | string
): Promise<CardTableCard[]> {
  return client.getAllPages<CardTableCard>(
    `/buckets/${projectId}/card_tables/lists/${columnId}/cards.json`
  );
}

/**
 * Create a new card in a specific column
 * POST /buckets/{project_id}/card_tables/lists/{column_id}/cards.json
 * Note: Even though columns are called "columns", cards use "/lists/" in the endpoint
 * Documentation: https://github.com/basecamp/bc3-api/blob/master/sections/card_table_cards.md
 * 
 * @param client - BasecampClient instance
 * @param projectId - The project/bucket ID
 * @param columnId - The column ID where the card will be created (note: endpoint uses "lists" not "columns")
 * @param payload - Card data (title and optional description)
 * @returns Promise resolving to the created card data
 */
export async function createCardTableCard(
  client: BasecampClient,
  projectId: number | string,
  columnId: number | string,
  payload: CreateCardPayload
): Promise<BasecampResponse<CardTableCard>> {
  return client.post<CardTableCard>(
    `/buckets/${projectId}/card_tables/lists/${columnId}/cards.json`,
    payload
  );
}

/**
 * Update an existing card table card
 * PUT /buckets/{project_id}/card_tables/cards/{card_id}.json
 * 
 * @param client - BasecampClient instance
 * @param projectId - The project/bucket ID
 * @param cardId - The card ID to update
 * @param payload - Updated card data
 * @returns Promise resolving to the updated card data
 */
export async function updateCardTableCard(
  client: BasecampClient,
  projectId: number | string,
  cardId: number | string,
  payload: UpdateCardPayload
): Promise<BasecampResponse<CardTableCard>> {
  return client.put<CardTableCard>(
    `/buckets/${projectId}/card_tables/cards/${cardId}.json`,
    payload
  );
}

/**
 * Delete a card table card
 * DELETE /buckets/{project_id}/card_tables/cards/{card_id}.json
 * 
 * @param client - BasecampClient instance
 * @param projectId - The project/bucket ID
 * @param cardId - The card ID to delete
 * @returns Promise resolving to the delete response
 */
export async function deleteCardTableCard(
  client: BasecampClient,
  projectId: number | string,
  cardId: number | string
): Promise<BasecampResponse<void>> {
  return client.delete<void>(
    `/buckets/${projectId}/card_tables/cards/${cardId}.json`
  );
}

/**
 * Move a card to a different column
 * POST /buckets/{project_id}/card_tables/cards/{card_id}/moves.json
 * Documentation: https://github.com/basecamp/bc3-api/blob/master/sections/card_table_cards.md
 * 
 * @param client - BasecampClient instance
 * @param projectId - The project/bucket ID
 * @param cardId - The card ID to move
 * @param destinationColumnId - The destination column ID
 * @returns Promise resolving to the moved card data
 */
export async function moveCardTableCard(
  client: BasecampClient,
  projectId: number | string,
  cardId: number | string,
  destinationColumnId: number | string
): Promise<BasecampResponse<CardTableCard>> {
  return client.post<CardTableCard>(
    `/buckets/${projectId}/card_tables/cards/${cardId}/moves.json`,
    { column_id: Number(destinationColumnId) }
  );
}

