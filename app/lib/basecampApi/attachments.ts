/**
 * Basecamp Attachments API
 * Documentation: https://github.com/basecamp/bc3-api/blob/master/sections/attachments.md
 */

import type { BasecampClient, BasecampResponse } from "./client";

/**
 * Attachment creation response
 */
export interface AttachmentResponse {
  attachable_sgid: string;
}

/**
 * Create an attachment by uploading a file
 * POST /attachments.json
 * 
 * Note: Attachments are uploaded at the account level, not the bucket/project level.
 * Example: https://3.basecampapi.com/{account_id}/attachments.json?name=filename.png
 * 
 * Required request data: The request body should be the file's raw binary data.
 * Required request headers: Content-Type and Content-Length for the file.
 * Required URI query parameters: name as the file name.
 * 
 * @param client - BasecampClient instance
 * @param projectId - The project/bucket ID (unused, kept for API compatibility)
 * @param fileBuffer - The file's raw binary data as ArrayBuffer, Blob, or Uint8Array
 * @param filename - The filename (required query parameter)
 * @param contentType - The Content-Type header (e.g., "image/png", "image/jpeg")
 * @returns Promise resolving to the attachment response with attachable_sgid
 */
export async function createAttachment(
  client: BasecampClient,
  projectId: number | string,
  fileBuffer: ArrayBuffer | Blob | Uint8Array,
  filename: string,
  contentType: string
): Promise<BasecampResponse<AttachmentResponse>> {
  // Attachments are uploaded at account level, not bucket level
  return client.uploadBinary<AttachmentResponse>(
    `/attachments.json`,
    fileBuffer,
    contentType,
    filename
  );
}

