import { useFetcher, useRevalidator } from "react-router";
import { useEffect } from "react";
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

interface PartMfgStateProps {
  part: BtPartMetadataInfo;
  cards: CardWithColumn[];
  columns: CardTableColumn[];
}

/**
 * Component to display manufacturing tracking state for a part
 */
export function PartMfgState({ part, cards, columns }: PartMfgStateProps) {
  const fetcher = useFetcher();
  const revalidator = useRevalidator();

  // Handle successful card operations
  useEffect(() => {
    if (fetcher.data?.success) {
      revalidator.revalidate();
    }
  }, [fetcher.data, revalidator]);

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
      {fetcher.data && !fetcher.data.success && fetcher.data.error && (
        <p className="text-xs text-destructive">{fetcher.data.error}</p>
      )}
    </div>
  );
}

