import { createCookieSessionStorage } from "react-router";
import { getValidOnshapeToken, getValidBasecampToken } from "./tokenRefresh";

// Create session storage for storing OAuth tokens
const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__basecamp_session",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
    sameSite: "lax",
    secrets: [process.env.SESSION_SECRET || "basecamp-session-secret-change-in-production"],
    secure: process.env.NODE_ENV === "production",
  },
});

export async function getSession(request: Request) {
  return sessionStorage.getSession(request.headers.get("Cookie"));
}

export async function commitSession(session: any) {
  return sessionStorage.commitSession(session);
}

export async function destroySession(session: any) {
  return sessionStorage.destroySession(session);
}

/**
 * Check if Onshape is authenticated (has valid access token)
 */
export async function isOnshapeAuthenticated(request: Request): Promise<boolean> {
  const session = await getSession(request);
  const accessToken = session.get("onshapeAccessToken");
  return !!accessToken;
}

/**
 * Check if Basecamp is authenticated (has valid access token)
 */
export async function isBasecampAuthenticated(request: Request): Promise<boolean> {
  const session = await getSession(request);
  const accessToken = session.get("accessToken");
  return !!accessToken;
}

/**
 * Get Onshape access token, refreshing if needed
 */
export async function getOnshapeToken(request: Request): Promise<string | null> {
  try {
    return await getValidOnshapeToken(request);
  } catch (error) {
    console.error("Error getting Onshape token:", error);
    return null;
  }
}

/**
 * Get Basecamp access token, refreshing if needed
 */
export async function getBasecampToken(request: Request): Promise<string | null> {
  try {
    return await getValidBasecampToken(request);
  } catch (error) {
    console.error("Error getting Basecamp token:", error);
    return null;
  }
}


