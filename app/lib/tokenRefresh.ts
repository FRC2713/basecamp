/**
 * Token Refresh Middleware
 * Provides utilities for automatically refreshing tokens before expiration
 */

import { getSession } from "./session";
import { refreshAccessToken as refreshOnshapeToken } from "./onshapeApi/auth";
import { refreshAccessToken as refreshBasecampToken } from "./basecampApi/auth";

const REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes before expiration

/**
 * Check if a token needs to be refreshed (within 5 minutes of expiration)
 */
export function needsRefresh(expiresAt: number | null): boolean {
  if (!expiresAt) return true;
  const now = Date.now();
  const expirationTime = expiresAt - REFRESH_BUFFER_MS;
  return now >= expirationTime;
}

/**
 * Refresh Onshape token if needed (accepts session object)
 */
export async function refreshOnshapeTokenIfNeededWithSession(session: any): Promise<string | null> {
  const accessToken = session.get("onshapeAccessToken");
  const refreshToken = session.get("onshapeRefreshToken");
  const expiresAt = session.get("onshapeExpiresAt");

  if (!accessToken || !refreshToken) {
    return null;
  }

  // Check if token needs refresh
  if (!needsRefresh(expiresAt)) {
    return accessToken;
  }

  // Refresh token
  const clientId = process.env.ONSHAPE_CLIENT_ID;
  const clientSecret = process.env.ONSHAPE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing Onshape OAuth credentials");
  }

  try {
    const tokenResponse = await refreshOnshapeToken(refreshToken, clientId, clientSecret);
    
    // Update session
    session.set("onshapeAccessToken", tokenResponse.access_token);
    session.set("onshapeRefreshToken", tokenResponse.refresh_token);
    session.set("onshapeExpiresAt", Date.now() + tokenResponse.expires_in * 1000);
    
    return tokenResponse.access_token;
  } catch (error) {
    console.error("Failed to refresh Onshape token:", error);
    // Clear invalid tokens
    session.unset("onshapeAccessToken");
    session.unset("onshapeRefreshToken");
    session.unset("onshapeExpiresAt");
    throw error;
  }
}

/**
 * Refresh Onshape token if needed (accepts request)
 */
export async function refreshOnshapeTokenIfNeeded(request: Request): Promise<string | null> {
  const session = await getSession(request);
  return refreshOnshapeTokenIfNeededWithSession(session);
}

/**
 * Refresh Basecamp token if needed (accepts session object)
 */
export async function refreshBasecampTokenIfNeededWithSession(session: any): Promise<string | null> {
  const accessToken = session.get("accessToken");
  const refreshToken = session.get("refreshToken");
  const expiresAt = session.get("expiresAt");

  if (!accessToken || !refreshToken) {
    return null;
  }

  // Check if token needs refresh
  if (!needsRefresh(expiresAt)) {
    return accessToken;
  }

  // Refresh token
  const clientId = process.env.BASECAMP_CLIENT_ID;
  const clientSecret = process.env.BASECAMP_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing Basecamp OAuth credentials");
  }

  try {
    const tokenResponse = await refreshBasecampToken(refreshToken, clientId, clientSecret);
    
    // Update session
    session.set("accessToken", tokenResponse.access_token);
    session.set("refreshToken", tokenResponse.refresh_token);
    session.set("expiresAt", Date.now() + tokenResponse.expires_in * 1000);

    return tokenResponse.access_token;
  } catch (error) {
    console.error("Failed to refresh Basecamp token:", error);
    // Clear invalid tokens
    session.unset("accessToken");
    session.unset("refreshToken");
    session.unset("expiresAt");
    throw error;
  }
}

/**
 * Refresh Basecamp token if needed (accepts request)
 */
export async function refreshBasecampTokenIfNeeded(request: Request): Promise<string | null> {
  const session = await getSession(request);
  return refreshBasecampTokenIfNeededWithSession(session);
}

/**
 * Get valid Onshape token, refreshing if necessary
 */
export async function getValidOnshapeToken(request: Request): Promise<string | null> {
  return refreshOnshapeTokenIfNeeded(request);
}

/**
 * Get valid Basecamp token, refreshing if necessary
 */
export async function getValidBasecampToken(request: Request): Promise<string | null> {
  return refreshBasecampTokenIfNeeded(request);
}

