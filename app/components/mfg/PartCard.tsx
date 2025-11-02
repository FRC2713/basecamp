import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Code } from "lucide-react";
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
  const [isJsonDialogOpen, setIsJsonDialogOpen] = useState(false);
  const jsonString = JSON.stringify(part, null, 2);

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg">
            {part.name || `Part ${part.partId || part.id || 'Unknown'}`}
          </CardTitle>
          <div className="flex items-center gap-2">
            {part.isHidden && (
              <Badge variant="secondary">Hidden</Badge>
            )}
            <Dialog open={isJsonDialogOpen} onOpenChange={setIsJsonDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-8">
                  <Code className="h-4 w-4 mr-1" />
                  JSON
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader>
                  <DialogTitle>
                    {part.name || `Part ${part.partId || part.id || 'Unknown'}`} - JSON
                  </DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-auto bg-muted rounded-md p-4">
                  <pre className="text-xs font-mono whitespace-pre-wrap wrap-break-word">
                    {jsonString}
                  </pre>
                </div>
              </DialogContent>
            </Dialog>
          </div>
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

