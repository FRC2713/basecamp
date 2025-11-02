import { useFetcher, useRevalidator } from "react-router";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Calendar } from "~/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { cn } from "~/lib/utils";
import type { CardWithColumn } from "~/routes/mfg.parts/utils/types";
import type { CardTableColumn } from "~/lib/basecampApi/cardTables";

interface PartDueDateProps {
  card: CardWithColumn;
  columns: CardTableColumn[];
}

/**
 * Component to display and edit the due date for a card
 */
export function PartDueDate({ card }: PartDueDateProps) {
  const fetcher = useFetcher();
  const revalidator = useRevalidator();
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    card.due_on ? new Date(card.due_on) : undefined
  );

  // Handle successful due date updates
  useEffect(() => {
    if (fetcher.data?.success) {
      revalidator.revalidate();
      setOpen(false);
    }
  }, [fetcher.data, revalidator]);

  // Update selectedDate when card.due_on changes
  useEffect(() => {
    setSelectedDate(card.due_on ? new Date(card.due_on) : undefined);
  }, [card.due_on]);

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    
    if (date) {
      // Format date as ISO 8601 (YYYY-MM-DD)
      const isoDate = format(date, "yyyy-MM-dd");
      
      const formData = new FormData();
      formData.append("action", "updateDueDate");
      formData.append("cardId", String(card.id));
      formData.append("dueOn", isoDate);
      
      fetcher.submit(formData, { method: "post" });
    }
  };

  const handleClearDate = () => {
    setSelectedDate(undefined);
    
    const formData = new FormData();
    formData.append("action", "updateDueDate");
    formData.append("cardId", String(card.id));
    formData.append("dueOn", "");
    
    fetcher.submit(formData, { method: "post" });
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs">Due Date:</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "w-full justify-start text-left font-normal h-8",
              !selectedDate && "text-muted-foreground"
            )}
            disabled={fetcher.state === "submitting"}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {selectedDate ? format(selectedDate, "PPP") : <span>Set due date</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            disabled={fetcher.state === "submitting"}
            initialFocus
          />
          {selectedDate && (
            <div className="p-3 border-t">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleClearDate}
                disabled={fetcher.state === "submitting"}
              >
                Clear date
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
      {fetcher.data && !fetcher.data.success && fetcher.data.error && (
        <p className="text-xs text-destructive">{fetcher.data.error}</p>
      )}
    </div>
  );
}

