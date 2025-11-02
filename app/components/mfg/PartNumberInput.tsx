import { useFetcher, useRevalidator } from "react-router";
import { useState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import type { BtPartMetadataInfo } from "~/lib/onshapeApi/generated-wrapper";
import type { PartsQueryParams } from "~/routes/mfg.parts/utils/types";

interface PartNumberInputProps {
  part: BtPartMetadataInfo;
  queryParams: PartsQueryParams;
}

/**
 * Component for setting/displaying part number
 */
export function PartNumberInput({ part, queryParams }: PartNumberInputProps) {
  const [partNumberInput, setPartNumberInput] = useState("");
  const fetcher = useFetcher();
  const revalidator = useRevalidator();

  // Handle successful part number update
  useEffect(() => {
    if (fetcher.data?.success) {
      setPartNumberInput("");
      revalidator.revalidate();
    }
  }, [fetcher.data, revalidator]);

  // If part number is already set, just display it
  if (part.partNumber) {
    return (
      <>Part Number: <code className="text-xs">{part.partNumber}</code></>
    );
  }

  // If we don't have required params, show "not set"
  if (!queryParams.documentId || !queryParams.instanceId || !queryParams.elementId) {
    return (
      <span className="text-xs text-muted-foreground">Part Number: Not set</span>
    );
  }

  // Show input form
  return (
    <div className="space-y-2">
      <Label htmlFor={`part-number-${part.partId || part.id}`} className="text-xs">
        Part Number:
      </Label>
      <fetcher.Form 
        method="post" 
        className="flex gap-2"
        onSubmit={(e) => {
          console.log("[PartNumberInput] Form submitted:", {
            partId: part.partId || part.id,
            partNumber: partNumberInput,
            documentId: queryParams.documentId,
            instanceType: queryParams.instanceType,
            instanceId: queryParams.instanceId,
            elementId: queryParams.elementId,
          });
        }}
      >
        <input type="hidden" name="partId" value={part.partId || part.id || ""} />
        <input type="hidden" name="documentId" value={queryParams.documentId} />
        <input type="hidden" name="instanceType" value={queryParams.instanceType} />
        <input type="hidden" name="instanceId" value={queryParams.instanceId} />
        <input type="hidden" name="elementId" value={queryParams.elementId} />
        <Input
          id={`part-number-${part.partId || part.id}`}
          name="partNumber"
          value={partNumberInput}
          onChange={(e) => {
            console.log("[PartNumberInput] Input changed:", e.target.value);
            setPartNumberInput(e.target.value);
          }}
          placeholder="Enter part number"
          className="h-8 text-xs flex-1"
          disabled={fetcher.state === "submitting"}
        />
        <Button
          type="submit"
          size="sm"
          className="h-8"
          disabled={fetcher.state === "submitting" || !partNumberInput.trim()}
        >
          {fetcher.state === "submitting" ? "Setting..." : "Set"}
        </Button>
      </fetcher.Form>
      {fetcher.data && !fetcher.data.success && fetcher.data.error && (
        <p className="text-xs text-destructive">
          Error: {fetcher.data.error}
        </p>
      )}
      {fetcher.data?.success && (
        <p className="text-xs text-green-600 dark:text-green-400">
          Part number updated successfully!
        </p>
      )}
    </div>
  );
}

