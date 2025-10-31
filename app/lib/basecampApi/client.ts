/**
 * Basecamp 4 API Client
 * Documentation: https://github.com/basecamp/bc3-api
 */

const BASECAMP_API_BASE = "https://3.basecampapi.com";

export interface BasecampClientConfig {
  accessToken: string;
  accountId: string | number;
  userAgent: string; // Format: "AppName (contact@example.com)" or "AppName (https://example.com/contact)"
}

export interface BasecampRequestOptions extends RequestInit {
  /**
   * Custom headers to add to the request
   */
  headers?: HeadersInit;
  /**
   * ETag value for conditional requests (If-None-Match)
   */
  etag?: string;
  /**
   * Last-Modified value for conditional requests (If-Modified-Since)
   */
  lastModified?: string;
}

export interface BasecampResponse<T = unknown> {
  data: T;
  headers: Headers;
  status: number;
  /**
   * Link header for pagination
   */
  link?: {
    next?: string;
    prev?: string;
    first?: string;
    last?: string;
  };
  /**
   * Total count from X-Total-Count header
   */
  totalCount?: number;
}

export interface BasecampError {
  message: string;
  status: number;
  reason?: string; // From Reason header (e.g., "Account Inactive")
  retryAfter?: number; // From Retry-After header (for 429 errors)
}

/**
 * Parse Link header for pagination
 */
function parseLinkHeader(linkHeader: string | null): BasecampResponse["link"] {
  if (!linkHeader) return undefined;

  const links: NonNullable<BasecampResponse["link"]> = {};
  const linkEntries = linkHeader.split(",");

  for (const entry of linkEntries) {
    const match = entry.match(/<([^>]+)>;\s*rel="([^"]+)"/);
    if (match) {
      const url = match[1];
      const rel = match[2];
      if (rel === "next" || rel === "prev" || rel === "first" || rel === "last") {
        links[rel] = url;
      }
    }
  }

  return Object.keys(links).length > 0 ? links : undefined;
}

/**
 * Sleep utility for retries
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 */
function exponentialBackoff(attempt: number, baseDelay: number = 1000): number {
  return baseDelay * Math.pow(2, attempt);
}

/**
 * Basecamp API Client
 */
export class BasecampClient {
  private accessToken: string;
  private accountId: string;
  private userAgent: string;
  private baseUrl: string;

  constructor(config: BasecampClientConfig) {
    this.accessToken = config.accessToken;
    this.accountId = String(config.accountId);
    this.userAgent = config.userAgent;
    this.baseUrl = `${BASECAMP_API_BASE}/${this.accountId}`;
  }

  /**
   * Make a request to the Basecamp API with automatic retry logic
   */
  private async request<T = unknown>(
    endpoint: string,
    options: BasecampRequestOptions = {},
    retryAttempt: number = 0
  ): Promise<BasecampResponse<T>> {
    const url = endpoint.startsWith("http") ? endpoint : `${this.baseUrl}${endpoint}`;
    
    // Ensure endpoint ends with .json if it's a relative path
    const finalUrl = endpoint.startsWith("http") 
      ? url 
      : url.endsWith(".json") 
        ? url 
        : `${url}.json`;

    const headers = new Headers({
      "Authorization": `Bearer ${this.accessToken}`,
      "User-Agent": this.userAgent,
      "Accept": "application/json",
      ...options.headers,
    });

    // Add Content-Type for requests with body
    if (options.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json; charset=utf-8");
    }

    // Add conditional request headers
    if (options.etag) {
      headers.set("If-None-Match", options.etag);
    }
    if (options.lastModified) {
      headers.set("If-Modified-Since", options.lastModified);
    }

    const response = await fetch(finalUrl, {
      ...options,
      headers,
    });

    // Handle 304 Not Modified (caching)
    if (response.status === 304) {
      return {
        data: null as T,
        headers: response.headers,
        status: 304,
      };
    }

    // Handle rate limiting (429) with retry
    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      const delay = retryAfter 
        ? parseInt(retryAfter, 10) * 1000 
        : exponentialBackoff(retryAttempt);
      
      if (retryAttempt < 5) {
        await sleep(delay);
        return this.request<T>(endpoint, options, retryAttempt + 1);
      }

      throw {
        message: "Rate limit exceeded",
        status: 429,
        retryAfter: delay / 1000,
      } as BasecampError;
    }

    // Handle 5xx server errors with exponential backoff retry
    if (response.status >= 500 && response.status < 600) {
      if (retryAttempt < 3) {
        const delay = exponentialBackoff(retryAttempt);
        await sleep(delay);
        return this.request<T>(endpoint, options, retryAttempt + 1);
      }

      throw {
        message: `Server error: ${response.status}`,
        status: response.status,
      } as BasecampError;
    }

    // Handle 404 Not Found
    if (response.status === 404) {
      const reason = response.headers.get("Reason");
      throw {
        message: reason === "Account Inactive" 
          ? "Account is inactive (expired trial or suspended)"
          : "Resource not found (deleted, missing permissions, or invalid ID)",
        status: 404,
        reason: reason || undefined,
      } as BasecampError;
    }

    // Handle other errors
    if (!response.ok) {
      let errorMessage = `Request failed with status ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.message || errorData.error) {
          errorMessage = errorData.message || errorData.error;
        }
      } catch {
        // If response isn't JSON, use default message
      }

      throw {
        message: errorMessage,
        status: response.status,
      } as BasecampError;
    }

    // Parse response
    let data: T;
    const contentType = response.headers.get("Content-Type");
    if (contentType?.includes("application/json")) {
      data = await response.json();
    } else {
      data = (await response.text()) as unknown as T;
    }

    // Parse pagination headers
    const linkHeader = response.headers.get("Link");
    const totalCountHeader = response.headers.get("X-Total-Count");

    return {
      data,
      headers: response.headers,
      status: response.status,
      link: parseLinkHeader(linkHeader),
      totalCount: totalCountHeader ? parseInt(totalCountHeader, 10) : undefined,
    };
  }

  /**
   * GET request
   */
  async get<T = unknown>(
    endpoint: string,
    options?: BasecampRequestOptions
  ): Promise<BasecampResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: "GET",
    });
  }

  /**
   * POST request
   */
  async post<T = unknown>(
    endpoint: string,
    body?: unknown,
    options?: BasecampRequestOptions
  ): Promise<BasecampResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * PUT request
   */
  async put<T = unknown>(
    endpoint: string,
    body?: unknown,
    options?: BasecampRequestOptions
  ): Promise<BasecampResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * PATCH request
   */
  async patch<T = unknown>(
    endpoint: string,
    body?: unknown,
    options?: BasecampRequestOptions
  ): Promise<BasecampResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * DELETE request
   */
  async delete<T = unknown>(
    endpoint: string,
    options?: BasecampRequestOptions
  ): Promise<BasecampResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: "DELETE",
    });
  }

  /**
   * Get all pages of a paginated endpoint
   */
  async getAllPages<T = unknown>(
    endpoint: string,
    options?: BasecampRequestOptions
  ): Promise<T[]> {
    const allItems: T[] = [];
    let currentEndpoint: string | undefined = endpoint;
    let currentOptions = options;

    while (currentEndpoint) {
      const response: BasecampResponse<T[]> = await this.get<T[]>(currentEndpoint, currentOptions);
      
      if (response.data && Array.isArray(response.data)) {
        allItems.push(...response.data);
      }

      // Follow next link if available
      if (response.link?.next) {
        currentEndpoint = response.link.next;
        // Remove endpoint from options since we're using absolute URL
        const { etag, lastModified, ...restOptions } = currentOptions || {};
        currentOptions = restOptions;
      } else {
        currentEndpoint = undefined;
      }
    }

    return allItems;
  }
}

