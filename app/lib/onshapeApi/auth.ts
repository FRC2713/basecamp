/**
 * Onshape OAuth 2.0 Authentication Utilities
 * Documentation: https://onshape-public.github.io/docs/auth/
 */

const ONSHAPE_AUTHORIZATION_URL = "https://oauth.onshape.com/oauth/authorize";
const ONSHAPE_TOKEN_URL = "https://oauth.onshape.com/oauth/token";

export interface OnshapeTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface OnshapeAuthState {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
}

/**
 * Generate authorization URL for Onshape OAuth flow
 */
export function getAuthorizationUrl(redirectUri: string, clientId: string, state?: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "OAuth2ReadUserInfo OAuth2ReadDocuments", // Request necessary scopes
  });

  if (state) {
    params.append("state", state);
  }

  return `${ONSHAPE_AUTHORIZATION_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string
): Promise<OnshapeTokenResponse> {
  const response = await fetch(ONSHAPE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    }).toString(),
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
): Promise<OnshapeTokenResponse> {
  const response = await fetch(ONSHAPE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${error}`);
  }

  return await response.json();
}

/**
 * Make authenticated request to Onshape API
 */
export async function onshapeApiRequest(
  accessToken: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  // Onshape API base URL
  const baseUrl = endpoint.startsWith("http") ? "" : "https://cad.onshape.com/api";
  const url = endpoint.startsWith("http") ? endpoint : `${baseUrl}${endpoint}`;

  return fetch(url, {
    ...options,
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...options.headers,
    },
  });
}

