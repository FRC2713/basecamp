import type { Route } from "./+types/api.onshape.thumbnail";
import { getValidOnshapeToken } from "~/lib/tokenRefresh";

/**
 * Proxy endpoint for Onshape thumbnails
 * This allows us to fetch thumbnails with authentication
 */
export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const thumbnailUrl = url.searchParams.get("url");

  if (!thumbnailUrl) {
    return new Response("Missing thumbnail URL", { status: 400 });
  }

  try {
    // Get valid Onshape token
    const accessToken = await getValidOnshapeToken(request);
    if (!accessToken) {
      return new Response("Not authenticated", { status: 401 });
    }

    // Fetch the thumbnail with authentication
    const response = await fetch(thumbnailUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      return new Response("Failed to fetch thumbnail", { status: response.status });
    }

    // Get the image data
    const imageData = await response.arrayBuffer();
    const contentType = response.headers.get("Content-Type") || "image/png";

    // Return the image with appropriate headers
    return new Response(imageData, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600", // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error("Error fetching thumbnail:", error);
    return new Response("Internal server error", { status: 500 });
  }
}

