/**
 * Basecamp OAuth 2.0 Authentication Utilities
 * Documentation: https://github.com/basecamp/api/blob/master/sections/authentication.md
 */

const BASECAMP_AUTHORIZATION_URL = "https://launchpad.37signals.com/authorization/new";
const BASECAMP_TOKEN_URL = "https://launchpad.37signals.com/authorization/token";

export interface BasecampTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface BasecampAuthState {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
}

/**
 * Generate authorization URL for Basecamp OAuth flow
 */
export function getAuthorizationUrl(redirectUri: string, clientId: string, state?: string): string {
  const params = new URLSearchParams({
    type: "web_server",
    client_id: clientId,
    redirect_uri: redirectUri,
  });

  if (state) {
    params.append("state", state);
  }

  return `${BASECAMP_AUTHORIZATION_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string
): Promise<BasecampTokenResponse> {
  const response = await fetch(BASECAMP_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Basecamp Integration (your-email@example.com)",
    },
    body: JSON.stringify({
      type: "web_server",
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  return await response.json();
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<BasecampTokenResponse> {
  const response = await fetch(BASECAMP_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Basecamp Integration (your-email@example.com)",
    },
    body: JSON.stringify({
      type: "refresh",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${error}`);
  }

  return await response.json();
}

/**
 * Make authenticated request to Basecamp API
 */
export async function basecampApiRequest(
  accessToken: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(`https://3.basecampapi.com${endpoint}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "User-Agent": "Basecamp Integration (your-email@example.com)",
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
}

