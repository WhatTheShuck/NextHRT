"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TOKEN_DESCRIPTIONS } from "@/lib/email-templates/tokens";

/**
 * Click-to-insert chips for the tokens a template may use.
 *
 * Only the tokens that template's send site actually supplies are offered —
 * an SOP email has no {ticketList} to reference — so the list doubles as
 * documentation of what is available here.
 */
export function TokenChips({
  tokens,
  onInsert,
  disabled,
}: {
  tokens: readonly string[];
  onInsert: (token: string) => void;
  disabled?: boolean;
}) {
  if (tokens.length === 0) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-wrap gap-1.5">
        {tokens.map((token) => (
          <Tooltip key={token}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={disabled}
                onClick={() => onInsert(token)}
                className="h-6 px-2 font-mono text-xs font-normal"
              >
                {`{${token}}`}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              {TOKEN_DESCRIPTIONS[token] ?? "Inserts this value when sent."}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
