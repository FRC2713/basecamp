import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import type { BtPartMetadataInfo } from "~/lib/onshapeApi/generated-wrapper";
import type { CardTableColumn } from "~/lib/basecampApi/cardTables";
import type { CardWithColumn, PartsQueryParams } from "~/routes/mfg.parts/utils/types";
import { PartCardThumbnail } from "./PartCardThumbnail";
import { PartNumberInput } from "./PartNumberInput";
import { PartMfgState } from "./PartMfgState";

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
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg">
            {part.name || `Part ${part.partId || part.id || 'Unknown'}`}
          </CardTitle>
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

