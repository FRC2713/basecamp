import type { PartsQueryParams } from "../utils/types";

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  queryParams?: PartsQueryParams;
  exampleUrl?: string;
}

const EXAMPLE_URL = "/mfg/parts?elementType=PARTSTUDIO&documentId={$documentId}&instanceType={$workspaceOrVersion}&instanceId={$workspaceOrVersionId}&elementId={$elementId}";

/**
 * Validate and extract query parameters from request URL
 */
export function validateQueryParams(request: Request): ValidationResult {
  const url = new URL(request.url);
  const documentId = url.searchParams.get("documentId");
  const instanceType = url.searchParams.get("instanceType") || "w"; // Default to workspace
  const instanceId = url.searchParams.get("instanceId");
  const elementId = url.searchParams.get("elementId");
  const elementType = url.searchParams.get("elementType");

  const queryParams: PartsQueryParams = {
    documentId,
    instanceType,
    instanceId,
    elementId,
    elementType: elementType || undefined,
  };

  // Validate required parameters
  if (!documentId || !instanceId || !elementId) {
    return {
      isValid: false,
      error: "Missing required query parameters. Required: documentId, instanceId, elementId. Optional: instanceType (defaults to 'w'), elementType.",
      queryParams,
      exampleUrl: EXAMPLE_URL,
    };
  }

  // Validate elementType if provided
  if (elementType && elementType !== "PARTSTUDIO") {
    return {
      isValid: false,
      error: `Invalid elementType: "${elementType}". Expected "PARTSTUDIO" or omit this parameter.`,
      queryParams,
      exampleUrl: EXAMPLE_URL,
    };
  }

  return {
    isValid: true,
    queryParams,
  };
}

