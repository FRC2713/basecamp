import { isOnshapeAuthenticated } from "~/lib/session";
import { createOnshapeApiClient, getWmvepMetadata, updateWvepMetadata } from "~/lib/onshapeApi/generated-wrapper";
import type { ActionResponse } from "../utils/types";
import { createErrorResponse } from "../utils/errorHandling";

/**
 * Handle updating a part's part number in Onshape metadata
 */
export async function handlePartNumberUpdate(
  formData: FormData,
  request: Request
): Promise<ActionResponse> {
  console.log("[ACTION] Starting part number update");
  
  // Check Onshape authentication (required)
  const onshapeAuthenticated = await isOnshapeAuthenticated(request);
  if (!onshapeAuthenticated) {
    console.error("[ACTION] Not authenticated with Onshape");
    return { success: false, error: "Not authenticated with Onshape" };
  }

  try {
    const partId = formData.get("partId")?.toString();
    const partNumber = formData.get("partNumber")?.toString();
    const documentId = formData.get("documentId")?.toString();
    const instanceType = formData.get("instanceType")?.toString() || "w";
    const instanceId = formData.get("instanceId")?.toString();
    const elementId = formData.get("elementId")?.toString();

    console.log("[ACTION] Form data received:", {
      partId,
      partNumber,
      documentId,
      instanceType,
      instanceId,
      elementId,
    });

    if (!partId || !partNumber || !documentId || !instanceId || !elementId) {
      const missing = [];
      if (!partId) missing.push("partId");
      if (!partNumber) missing.push("partNumber");
      if (!documentId) missing.push("documentId");
      if (!instanceId) missing.push("instanceId");
      if (!elementId) missing.push("elementId");
      console.error("[ACTION] Missing required fields:", missing);
      return { success: false, error: `Missing required fields: ${missing.join(", ")}` };
    }

    const client = await createOnshapeApiClient(request);
    console.log("[ACTION] Client created successfully");

    // First, get the metadata to find the propertyId for "Part number"
    console.log("[ACTION] Fetching metadata for part:", { documentId, instanceType, instanceId, elementId, partId });
    const metadataResponse = await getWmvepMetadata({
      client,
      path: {
        did: documentId,
        wvm: instanceType as 'w' | 'v' | 'm',
        wvmid: instanceId,
        eid: elementId,
        iden: 'p',
        pid: partId,
      },
      query: {
        includeComputedProperties: true,
      },
    });

    console.log("[ACTION] Metadata response received:", {
      hasData: !!metadataResponse.data,
      jsonType: metadataResponse.data?.jsonType,
      propertiesCount: metadataResponse.data?.properties?.length || 0,
    });

    const metadata = metadataResponse.data;
    if (!metadata || !metadata.properties) {
      console.error("[ACTION] Failed to retrieve part metadata or properties missing");
      console.error("[ACTION] Metadata object:", JSON.stringify(metadata, null, 2));
      return { success: false, error: "Failed to retrieve part metadata or no properties found" };
    }

    // Log all available properties for debugging
    console.log("[ACTION] Available properties:", metadata.properties.map((prop: any) => ({
      name: prop.name,
      propertyId: prop.propertyId,
      value: prop.value,
      editable: prop.editable,
    })));

    // Find the "Part number" property (try multiple possible names)
    const partNumberProperty = metadata.properties.find(
      (prop: any) => {
        const name = prop.name?.toLowerCase();
        return name === "part number" || 
               name === "partnumber" || 
               name === "part_number" ||
               prop.propertyId?.includes("partnumber") ||
               prop.propertyId?.includes("part_number");
      }
    );

    console.log("[ACTION] Part number property search result:", {
      found: !!partNumberProperty,
      propertyName: partNumberProperty?.name,
      propertyId: partNumberProperty?.propertyId,
      editable: partNumberProperty?.editable,
    });

    if (!partNumberProperty || !partNumberProperty.propertyId) {
      console.error("[ACTION] Part number property not found in metadata");
      const availableNames = metadata.properties.map((p: any) => p.name).filter(Boolean);
      return { 
        success: false, 
        error: `Part number property not found. Available properties: ${availableNames.join(", ") || "none"}` 
      };
    }

    // Update the part number using the metadata API
    const updateBody = JSON.stringify({
      jsonType: "metadata-part",
      partId: partId,
      properties: [
        {
          value: partNumber.trim(),
          propertyId: partNumberProperty.propertyId,
        },
      ],
    });

    console.log("[ACTION] Sending update request with body:", updateBody);

    const updateResponse = await updateWvepMetadata({
      client,
      path: {
        did: documentId,
        wvm: instanceType as 'w' | 'v' | 'm',
        wvmid: instanceId,
        eid: elementId,
        iden: 'p',
        pid: partId,
      },
      body: updateBody,
    });

    console.log("[ACTION] Update response received:", {
      hasData: !!updateResponse.data,
      response: JSON.stringify(updateResponse.data, null, 2),
    });

    return { success: true };
  } catch (error: unknown) {
    console.error("[ACTION] Error updating part number:", error);
    return createErrorResponse(error, "Failed to update part number");
  }
}

