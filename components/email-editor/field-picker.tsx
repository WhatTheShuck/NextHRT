"use client";

import { useRef, useState } from "react";
import { Braces, SquareDashed } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TOKEN_DESCRIPTIONS, sampleFor } from "@/lib/email-templates/tokens";

/**
 * Searchable picker for the fields (`{token}`s) a template may use.
 *
 * The chips below the editor stay the fastest way to insert a field you already
 * know; this is the discoverable one — it names each field, explains it, and
 * shows what it renders as, so an author can find "the date they start" without
 * knowing it is spelled `startDate`.
 *
 * `open`/`onOpenChange` are optional so the editor can also drive it from a
 * keystroke (typing `{`) rather than only from its own trigger button.
 */
export function FieldPicker({
  tokens,
  onSelect,
  disabled,
  variant = "token",
  open,
  onOpenChange,
}: {
  tokens: readonly string[];
  onSelect: (token: string) => void;
  disabled?: boolean;
  /** "token" inserts `{token}`; "conditional" wraps in `{#token}…{/token}`. */
  variant?: "token" | "conditional";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isOpen = open ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  if (tokens.length === 0) return null;

  const conditional = variant === "conditional";

  return (
    <Popover open={isOpen} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          className="h-7 gap-1.5 px-2 text-xs"
          title={
            conditional
              ? "Wrap the selection in an optional block"
              : "Insert a field (or just type { in the editor)"
          }
        >
          {conditional ? (
            <SquareDashed className="h-3.5 w-3.5" />
          ) : (
            <Braces className="h-3.5 w-3.5" />
          )}
          {conditional ? "Optional block" : "Insert field"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command>
          <CommandInput
            placeholder={
              conditional ? "Show this part only if…" : "Search fields..."
            }
          />
          <CommandList>
            <CommandEmpty>No matching field.</CommandEmpty>
            <CommandGroup
              heading={
                conditional
                  ? "Drop the wrapped text when this field is empty"
                  : "Replaced with a real value when the email is sent"
              }
            >
              {tokens.map((token) => {
                const description = TOKEN_DESCRIPTIONS[token];
                const sample = sampleFor(token);
                return (
                  <CommandItem
                    key={token}
                    // cmdk filters on `value`, so the description has to be part
                    // of it for "start date" to find `startDate`.
                    value={`${token} ${description ?? ""}`}
                    onSelect={() => {
                      onSelect(token);
                      setOpen(false);
                    }}
                    className="flex-col items-start gap-0.5"
                  >
                    <span className="font-mono text-xs">
                      {conditional ? `{#${token}}…{/${token}}` : `{${token}}`}
                    </span>
                    {description !== undefined && (
                      <span className="text-xs text-muted-foreground">
                        {description}
                      </span>
                    )}
                    {sample !== undefined && !conditional && (
                      <span className="truncate text-xs text-muted-foreground/80">
                        e.g. {sample}
                      </span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Opens the field picker from a keystroke instead of the toolbar button.
 *
 * The trigger is `{` — the character an author would type anyway to start a
 * token by hand. Dismissing the picker without choosing puts the literal `{`
 * back, so hijacking the key never loses a keystroke; `insertLiteral` is how the
 * caller does that for whichever surface it owns.
 */
export function useBraceTrigger(insertLiteral: () => void) {
  const [open, setOpen] = useState(false);
  // Whether this opening came from the keystroke, and whether a field was
  // chosen. Only a keystroke that was then dismissed owes the author their `{`
  // back — opening the picker from the toolbar and changing your mind should
  // leave the copy alone.
  const viaKey = useRef(false);
  const chose = useRef(false);

  return {
    open,
    /** Pass to FieldPicker's onOpenChange. */
    onOpenChange: (next: boolean) => {
      if (next) {
        chose.current = false;
      } else if (viaKey.current && !chose.current) {
        insertLiteral();
      }
      if (!next) viaKey.current = false;
      setOpen(next);
    },
    /** Call from the surface's key handler when `{` is typed. */
    trigger: () => {
      viaKey.current = true;
      chose.current = false;
      setOpen(true);
    },
    /** Wrap the insert callback so a choice is not mistaken for a dismissal. */
    wrapSelect:
      (onSelect: (token: string) => void) =>
      (token: string): void => {
        chose.current = true;
        onSelect(token);
      },
  };
}
