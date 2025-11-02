import { useFetcher, useRevalidator } from "react-router";
import { useEffect, useState, useMemo, useRef } from "react";
import { format, parseISO } from "date-fns";
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
/**
 * Parse a date string from Basecamp (ISO 8601) as a local date
 * Basecamp returns dates like "2024-01-15" which should be treated as local dates, not UTC
 */
function parseLocalDate(dateString: string): Date {
  // If it's just a date (YYYY-MM-DD), parse it as local time to avoid timezone issues
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  // If it has time information, parse it normally
  return parseISO(dateString);
}

export function PartDueDate({ card }: PartDueDateProps) {
  const fetcher = useFetcher();
  const revalidator = useRevalidator();
  const [open, setOpen] = useState(false);
  
  // Parse the card's due_on date only when it actually changes
  const cardDueDate = useMemo(() => {
    if (!card.due_on) return undefined;
    try {
      return parseLocalDate(card.due_on);
    } catch (e) {
      console.error("Error parsing due date:", card.due_on, e);
      return undefined;
    }
  }, [card.due_on]);
  
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(cardDueDate);
  const hasRevalidatedRef = useRef(false);
  const lastSubmittedDateRef = useRef<string | null>(null);

  // Update selectedDate only when cardDueDate actually changes (but not during user edits)
  useEffect(() => {
    // Don't update if we just submitted a date (let it come back from the server)
    if (lastSubmittedDateRef.current !== null) {
      const submittedDateStr = lastSubmittedDateRef.current;
      const cardDateStr = cardDueDate ? format(cardDueDate, "yyyy-MM-dd") : "";
      
      // Only update if the card date matches what we submitted (update complete)
      // Handle both cases: clearing (empty string) and setting a date
      if (submittedDateStr === cardDateStr) {
        lastSubmittedDateRef.current = null;
        hasRevalidatedRef.current = false;
      } else {
        // Still waiting for the update to propagate
        return;
      }
    }
    
    if (fetcher.state !== "idle") {
      return;
    }
    
    // Compare dates by their date-only values to avoid unnecessary updates
    const currentDateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : "";
    const cardDateStr = cardDueDate ? format(cardDueDate, "yyyy-MM-dd") : "";
    
    if (currentDateStr !== cardDateStr) {
      setSelectedDate(cardDueDate);
    }
  }, [cardDueDate, selectedDate, fetcher.state]);

  // Handle successful due date updates
  useEffect(() => {
    if (fetcher.data?.success && fetcher.state === "idle" && !hasRevalidatedRef.current) {
      hasRevalidatedRef.current = true;
      setOpen(false);
      // Only revalidate once after successful submission
      setTimeout(() => {
        revalidator.revalidate();
      }, 100);
    }
  }, [fetcher.data?.success, fetcher.state, revalidator]);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      // Format date as ISO 8601 (YYYY-MM-DD)
      const isoDate = format(date, "yyyy-MM-dd");
      
      // Track what we're submitting to avoid race conditions
      lastSubmittedDateRef.current = isoDate;
      hasRevalidatedRef.current = false;
      
      const formData = new FormData();
      formData.append("action", "updateDueDate");
      formData.append("cardId", String(card.id));
      formData.append("dueOn", isoDate);
      
      fetcher.submit(formData, { method: "post" });
    }
  };

  const handleClearDate = () => {
    setSelectedDate(undefined);
    
    // Track that we're clearing the date
    lastSubmittedDateRef.current = "";
    hasRevalidatedRef.current = false;
    
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

