import { useFetcher, useRevalidator } from "react-router";
import { useEffect, useRef } from "react";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { BtPartMetadataInfo } from "~/lib/onshapeApi/generated-wrapper";
import type { CardTableColumn } from "~/lib/basecampApi/cardTables";
import type { CardWithColumn } from "~/routes/mfg.parts/utils/types";
import { ManufacturingStateBadge } from "./ManufacturingStateBadge";
import { PartDueDate } from "./PartDueDate";

import type { PartsQueryParams } from "~/routes/mfg.parts/utils/types";

interface PartMfgStateProps {
  part: BtPartMetadataInfo;
  queryParams: PartsQueryParams;
  cards: CardWithColumn[];
  columns: CardTableColumn[];
}

/**
 * Component to display manufacturing tracking state for a part
 */
export function PartMfgState({ part, queryParams, cards, columns }: PartMfgStateProps) {
  const fetcher = useFetcher();
  const revalidator = useRevalidator();
  const hasRevalidatedRef = useRef(false);

  // Reset revalidation flag when starting a new operation
  useEffect(() => {
    if (fetcher.state === "submitting") {
      hasRevalidatedRef.current = false;
    }
  }, [fetcher.state]);

  // Handle successful card operations
  useEffect(() => {
    if (fetcher.data?.success && fetcher.state === "idle" && !hasRevalidatedRef.current) {
      hasRevalidatedRef.current = true;
      // Only revalidate once after successful submission
      setTimeout(() => {
        revalidator.revalidate();
      }, 100);
    }
  }, [fetcher.data?.success, fetcher.state, revalidator]);

  // Don't show anything if part has no part number
  if (!part.partNumber) {
    return null;
  }

  // Find card with matching title (exact match)
  const matchingCard = cards.find(card => card.title === part.partNumber);

  // Find current column if card exists
  const currentColumn = matchingCard 
    ? columns.find(col => {
        const columnIdNum = Number(col.id);
        const cardParentId = matchingCard.parent?.id;
        const cardColumnId = matchingCard.columnId;
        return (cardParentId !== undefined && Number(cardParentId) === columnIdNum) ||
               (cardColumnId !== undefined && Number(cardColumnId) === columnIdNum);
      })
    : null;

  // If card not found, show "Add to manufacturing tracker" button
  if (!matchingCard) {
    return (
      <div className="space-y-2">
        <fetcher.Form method="post">
          <input type="hidden" name="action" value="addCard" />
          <input type="hidden" name="partNumber" value={part.partNumber} />
          {queryParams.documentId && (
            <>
              <input type="hidden" name="documentId" value={queryParams.documentId} />
              <input type="hidden" name="instanceType" value={queryParams.instanceType} />
              <input type="hidden" name="instanceId" value={queryParams.instanceId || ""} />
              <input type="hidden" name="elementId" value={queryParams.elementId || ""} />
              <input type="hidden" name="partId" value={part.partId || part.id || ""} />
            </>
          )}
          <Button
            type="submit"
            size="sm"
            variant="outline"
            className="w-full"
            disabled={fetcher.state === "submitting"}
          >
            {fetcher.state === "submitting" ? "Adding..." : "Add to manufacturing tracker"}
          </Button>
        </fetcher.Form>
        {fetcher.data && !fetcher.data.success && fetcher.data.error && (
          <p className="text-xs text-destructive">{fetcher.data.error}</p>
        )}
      </div>
    );
  }

  // If card found, show dropdown with column selection and badge
  const handleColumnChange = (newColumnId: string) => {
    console.log("[PartMfgState] Column change:", {
      cardId: matchingCard.id,
      cardIdType: typeof matchingCard.id,
      newColumnId,
      newColumnIdType: typeof newColumnId,
      matchingCard,
    });

    const formData = new FormData();
    formData.append("action", "moveCard");
    formData.append("cardId", String(matchingCard.id));
    formData.append("columnId", String(newColumnId));
    
    // Add part metadata for thumbnail update
    if (queryParams.documentId) {
      formData.append("documentId", queryParams.documentId);
      formData.append("instanceType", queryParams.instanceType);
      formData.append("instanceId", queryParams.instanceId || "");
      formData.append("elementId", queryParams.elementId || "");
      formData.append("partId", part.partId || part.id || "");
    }
    
    fetcher.submit(formData, { method: "post" });
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs">Manufacturing State:</Label>
      {currentColumn && (
        <ManufacturingStateBadge column={currentColumn} />
      )}
      <Select
        value={currentColumn?.id.toString() || ""}
        onValueChange={handleColumnChange}
        disabled={fetcher.state === "submitting"}
      >
        <SelectTrigger className="w-full h-8">
          <SelectValue placeholder="Select column...">
            {currentColumn?.title || "Select column..."}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {columns.map((column) => (
            <SelectItem key={column.id} value={column.id.toString()}>
              {column.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <PartDueDate card={matchingCard} part={part} queryParams={queryParams} columns={columns} />
      {fetcher.data && !fetcher.data.success && fetcher.data.error && (
        <p className="text-xs text-destructive">{fetcher.data.error}</p>
      )}
    </div>
  );
}

