import type { CardTableColumn } from "~/lib/basecampApi/cardTables";
import { Badge } from "~/components/ui/badge";
import { getColumnColorClasses } from "~/routes/mfg.parts/utils/columnColors";

/**
 * Reusable component for displaying a manufacturing state badge
 */
export function ManufacturingStateBadge({ column }: { column: CardTableColumn }) {
  const { bg, text } = getColumnColorClasses(column.color);
  
  return (
    <Badge
      className={`${bg} ${text} border-transparent`}
    >
      {column.title}
    </Badge>
  );
}

