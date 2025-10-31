/**
 * Onshape API Client
 * Documentation: https://onshape-public.github.io/docs/
 */

import { onshapeApiRequest } from "./auth";
import { getValidOnshapeToken } from "../tokenRefresh";

export interface OnshapeUser {
  id: string;
  name: string;
  email?: string;
  href: string;
}

export interface OnshapeDocument {
  id: string;
  name: string;
  href: string;
  owner?: {
    id: string;
    name: string;
    href: string;
  };
  createdBy?: {
    id: string;
    name: string;
    href: string;
  };
  modifiedAt?: string;
  thumbnail?: {
    href: string;
  };
}

export interface OnshapeError {
  message: string;
  status: number;
  reason?: string;
}

/**
 * Onshape API Client
 */
export class OnshapeClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  /**
   * Make a request to the Onshape API
   */
  private async request<T = unknown>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await onshapeApiRequest(this.accessToken, endpoint, options);

    if (!response.ok) {
      let errorMessage = `Request failed with status ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.message || errorData.error || errorData.errorMessage) {
          errorMessage = errorData.message || errorData.error || errorData.errorMessage;
        }
      } catch {
        // If response isn't JSON, use default message
      }

      throw {
        message: errorMessage,
        status: response.status,
      } as OnshapeError;
    }

    const contentType = response.headers.get("Content-Type");
    if (contentType?.includes("application/json")) {
      return await response.json();
    } else {
      return (await response.text()) as unknown as T;
    }
  }

  /**
   * GET request
   */
  async get<T = unknown>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "GET" });
  }

  /**
   * POST request
   */
  async post<T = unknown>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * PUT request
   */
  async put<T = unknown>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * DELETE request
   */
  async delete<T = unknown>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "DELETE" });
  }

  /**
   * Get current logged-in user information
   */
  async getCurrentUser(): Promise<OnshapeUser> {
    return this.get<OnshapeUser>("/users/sessioninfo");
  }

  /**
   * Get document details by document ID
   */
  async getDocumentDetails(documentId: string): Promise<OnshapeDocument> {
    return this.get<OnshapeDocument>(`/documents/${documentId}`);
  }

  /**
   * Get all documents accessible to the user
   */
  async getDocuments(): Promise<OnshapeDocument[]> {
    const response = await this.get<{ items: OnshapeDocument[] }>("/documents");
    return response.items || [];
  }
}

/**
 * Create an Onshape client with automatic token refresh
 * This should be used in server-side loaders/actions
 */
export async function createOnshapeClient(request: Request): Promise<OnshapeClient> {
  const accessToken = await getValidOnshapeToken(request);
  if (!accessToken) {
    throw new Error("Not authenticated with Onshape");
  }
  return new OnshapeClient(accessToken);
}

