/**
 * Utility for updating Basecamp card content with part thumbnails
 */

import type { BasecampClient } from "~/lib/basecampApi/client";
import { updateCardTableCard, getCardTableCard } from "~/lib/basecampApi/cardTableCards";
import { createAttachment } from "~/lib/basecampApi/attachments";
import { getPartsWmve } from "~/lib/onshapeApi/generated-wrapper";
import type { Client } from "~/lib/onshapeApi/generated/client/types.gen";

/**
 * Part metadata needed to fetch thumbnail
 */
export interface PartMetadata {
  documentId: string;
  instanceType: string;
  instanceId: string;
  elementId: string;
  partId: string;
}

/**
 * Update a card's content field with the part's thumbnail attachment
 * 
 * @param cardId - The Basecamp card ID to update
 * @param partMetadata - Part metadata to identify and fetch the part
 * @param basecampClient - BasecampClient instance
 * @param projectId - Basecamp project/bucket ID
 * @param onshapeClient - Onshape API client
 * @param onshapeAccessToken - Onshape access token for fetching thumbnail images
 * @returns Promise that resolves when update is complete (or throws if critical error)
 */
export async function updateCardContentWithThumbnail(
  cardId: number | string,
  partMetadata: PartMetadata,
  basecampClient: BasecampClient,
  projectId: number | string,
  onshapeClient: Client,
  onshapeAccessToken: string
): Promise<void> {
  try {
    // First, get the current card to preserve existing fields like due_on
    let currentCard;
    try {
      const cardResponse = await getCardTableCard(basecampClient, projectId, cardId);
      currentCard = cardResponse.data;
    } catch (error) {
      console.warn(`[CardContent] Failed to fetch current card data:`, error);
      // Continue anyway - we'll update without preserving due_on
    }

    // Fetch parts from Onshape to get the specific part
    const partsResponse = await getPartsWmve({
      client: onshapeClient,
      path: {
        did: partMetadata.documentId,
        wvm: partMetadata.instanceType as 'w' | 'v' | 'm',
        wvmid: partMetadata.instanceId,
        eid: partMetadata.elementId,
      },
      query: {
        withThumbnails: true,
      },
    });

    const parts = Array.isArray(partsResponse.data) ? partsResponse.data : [];
    
    // Find the specific part by partId
    const part = parts.find(
      (p) => p.partId === partMetadata.partId || p.id === partMetadata.partId
    );

    if (!part) {
      console.warn(`[CardContent] Part not found: ${partMetadata.partId}`);
      // Update content with empty string as per plan (option b), preserving due_on
      await updateCardTableCard(basecampClient, projectId, cardId, {
        content: "",
        ...(currentCard?.due_on !== undefined && { due_on: currentCard.due_on }),
      });
      return;
    }

    // Get thumbnail URL - prefer 300x300, fallback to first available
    const thumbnailUrl =
      part.thumbnailInfo?.sizes?.find((s) => s.size === "300x300")?.href ||
      part.thumbnailInfo?.sizes?.[0]?.href ||
      part.thumbnailInfo?.sizes?.find((s) => s.size === "600x340")?.href;

    if (!thumbnailUrl) {
      console.warn(`[CardContent] No thumbnail URL found for part ${partMetadata.partId}`);
      // Update content with empty string as per plan (option b), preserving due_on
      await updateCardTableCard(basecampClient, projectId, cardId, {
        content: "",
        ...(currentCard?.due_on !== undefined && { due_on: currentCard.due_on }),
      });
      return;
    }

    // Fetch the thumbnail image from Onshape
    const thumbnailResponse = await fetch(thumbnailUrl, {
      headers: {
        Authorization: `Bearer ${onshapeAccessToken}`,
      },
    });

    if (!thumbnailResponse.ok) {
      console.warn(`[CardContent] Failed to fetch thumbnail: ${thumbnailResponse.status}`);
      // Update content with empty string as per plan (option b), preserving due_on
      await updateCardTableCard(basecampClient, projectId, cardId, {
        content: "",
        ...(currentCard?.due_on !== undefined && { due_on: currentCard.due_on }),
      });
      return;
    }

    // Get image data
    const imageBuffer = await thumbnailResponse.arrayBuffer();
    const contentType = thumbnailResponse.headers.get("Content-Type") || "image/png";

    // Determine filename from part name or use default
    const partName = part.name || `part-${partMetadata.partId}`;
    const extension = contentType.includes("jpeg") ? "jpg" : 
                     contentType.includes("png") ? "png" : 
                     contentType.includes("gif") ? "gif" : "png";
    const filename = `${partName.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.${extension}`;

    // Upload attachment to Basecamp
    const attachmentResponse = await createAttachment(
      basecampClient,
      projectId,
      imageBuffer,
      filename,
      contentType
    );

    const attachableSgid = attachmentResponse.data.attachable_sgid;

    // Construct rich text content with <bc-attachment> tag
    const content = `<bc-attachment sgid="${attachableSgid}"></bc-attachment>`;

    // Update card's content field (replaces existing content entirely)
    // Preserve due_on field if it exists
    await updateCardTableCard(basecampClient, projectId, cardId, {
      content,
      ...(currentCard?.due_on !== undefined && { due_on: currentCard.due_on }),
    });

    console.log(`[CardContent] Successfully updated card ${cardId} with thumbnail attachment`);
  } catch (error) {
    console.warn(`[CardContent] Failed to update card content with thumbnail:`, error);
    // Update content with empty string on failure as per plan (option b)
    // Try to preserve due_on if we can fetch the current card
    try {
      let currentCard;
      try {
        const cardResponse = await getCardTableCard(basecampClient, projectId, cardId);
        currentCard = cardResponse.data;
      } catch {
        // If we can't fetch the card, continue without preserving due_on
      }
      
      await updateCardTableCard(basecampClient, projectId, cardId, {
        content: "",
        ...(currentCard?.due_on !== undefined && { due_on: currentCard.due_on }),
      });
    } catch (updateError) {
      console.error(`[CardContent] Failed to clear card content on error:`, updateError);
      // Don't throw - we don't want to fail the card operation
    }
  }
}

