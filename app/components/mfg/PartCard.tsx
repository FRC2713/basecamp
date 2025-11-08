import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import type { BtPartMetadataInfo } from "~/lib/onshapeApi/generated-wrapper";
import type { CardTableColumn } from "~/lib/basecampApi/cardTables";
import type { CardWithColumn, PartsQueryParams } from "~/routes/mfg.parts/utils/types";
import { PartCardThumbnail } from "./PartCardThumbnail";
import { PartNumberInput } from "./PartNumberInput";
import { PartMfgState } from "./PartMfgState";
import { ManufacturingStateBadge } from "./ManufacturingStateBadge";

interface PartCardProps {
  part: BtPartMetadataInfo;
  queryParams: PartsQueryParams;
  cards: CardWithColumn[];
  columns: CardTableColumn[];
}

/**
 * Component to display a single part with thumbnail error handling
 */
export function PartCard({ part, queryParams, cards, columns }: PartCardProps) {
  // Find matching card for this part (if it has a part number)
  const matchingCard = part.partNumber 
    ? cards.find(card => card.title === part.partNumber)
    : null;

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

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-row items-center gap-2 flex-wrap">
            <CardTitle className="text-lg">
              {part.name || `Part ${part.partId || part.id || 'Unknown'}`}
            </CardTitle>
            {currentColumn && (
              <ManufacturingStateBadge column={currentColumn} />
            )}
          </div>
          {part.isHidden && (
            <Badge variant="secondary">Hidden</Badge>
          )}
        </div>
        <CardDescription>
          <PartNumberInput part={part} queryParams={queryParams} />
        </CardDescription>
      </CardHeader>
      <PartCardThumbnail part={part} />
      <CardContent className="space-y-4">
        <PartMfgState part={part} queryParams={queryParams} cards={cards} columns={columns} />
      </CardContent>
    </Card>
  );
}

