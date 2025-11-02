import { createOnshapeApiClient, getPartsWmve, getElementsInDocument } from "~/lib/onshapeApi/generated-wrapper";
import type { PartsQueryParams } from "../utils/types";
import { formatOnshapeError } from "../utils/errorHandling";

export interface OnshapeLoaderResult {
  parts: any[];
  partStudioName: string | null;
  error: string | null;
  exampleUrl?: string;
}

/**
 * Load Onshape parts data
 */
export async function loadOnshapeData(
  request: Request,
  queryParams: PartsQueryParams
): Promise<OnshapeLoaderResult> {
  const { documentId, instanceType, instanceId, elementId } = queryParams;

  try {
    const client = await createOnshapeApiClient(request);
    
    // Run both API calls in parallel for better performance
    const [elementsResult, partsResult] = await Promise.allSettled([
      // Fetch the part studio name (optional - can fail gracefully)
      getElementsInDocument({
        client,
        path: {
          did: documentId!,
          wvm: instanceType as 'w' | 'v' | 'm',
          wvmid: instanceId!,
        },
        query: {
          elementId: elementId!,
        },
      }),
      // Fetch parts data (required - failure should propagate)
      getPartsWmve({
        client,
        path: {
          did: documentId!,
          wvm: instanceType as 'w' | 'v' | 'm',
          wvmid: instanceId!,
          eid: elementId!,
        },
        query: {
          withThumbnails: true,
        },
      }),
    ]);

    // Handle part studio name result (optional - continue if it fails)
    let partStudioName: string | null = null;
    if (elementsResult.status === 'fulfilled') {
      try {
        const elements = Array.isArray(elementsResult.value.data) ? elementsResult.value.data : [];
        const element = elements.find((el) => el.id === elementId);
        if (element?.name) {
          partStudioName = element.name;
        }
      } catch (error) {
        // If we can't process the element name, continue without it
        console.warn("Failed to process part studio name:", error);
      }
    } else {
      // If fetching the element name failed, continue without it
      console.warn("Failed to fetch part studio name:", elementsResult.reason);
    }

    // Handle parts result (required - failure should propagate)
    if (partsResult.status === 'rejected') {
      // Re-throw the error to be caught by outer catch block
      throw partsResult.reason;
    }

    // Extract parts from response (response.data is an array of BtPartMetadataInfo)
    const parts = partsResult.value.data || [];

    return {
      parts,
      partStudioName,
      error: null,
    };
  } catch (error: unknown) {
    console.error("Error fetching parts from Onshape:", error);
    
    const detailedError = formatOnshapeError(error);

    return {
      parts: [],
      partStudioName: null,
      error: detailedError,
      exampleUrl: "/mfg/parts?elementType=PARTSTUDIO&documentId={$documentId}&instanceType={$workspaceOrVersion}&instanceId={$workspaceOrVersionId}&elementId={$elementId}",
    };
  }
}

