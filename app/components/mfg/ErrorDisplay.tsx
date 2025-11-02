import { Card, CardContent } from "~/components/ui/card";
import { AlertCircle } from "lucide-react";

interface ErrorDisplayProps {
  error: string;
  exampleUrl?: string;
}

/**
 * Component to display error messages with optional example URL
 */
export function ErrorDisplay({ error, exampleUrl }: ErrorDisplayProps) {
  return (
    <Card className="border-destructive">
      <CardContent className="pt-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <p className="text-sm font-semibold">Error</p>
          </div>
          <p className="text-sm">{error}</p>
          {exampleUrl && (
            <div className="mt-4 p-3 bg-muted rounded-md text-xs space-y-2">
              <p className="font-semibold">Example URL format:</p>
              <code className="block bg-background px-2 py-1 rounded break-all">
                {exampleUrl}
              </code>
              <p className="text-muted-foreground">
                When used in Onshape, placeholders like {"{$documentId}"} are automatically replaced with actual values.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

