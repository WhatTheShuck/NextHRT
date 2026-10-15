"use client";

import type { KeyboardEvent } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSearch } from "./search-provider";
import { useModKey } from "./use-mod-key";

/**
 * The always-visible search box in the header, for people who'd never think
 * to press Ctrl+K. It looks like a text field; clicking it (or just starting
 * to type while it's focused) opens the full search window.
 */
export function SearchTrigger() {
  const { enabled, openSearch, prefetch } = useSearch();
  const mod = useModKey();
  if (!enabled) return null;

  const onKeyDown = (e: KeyboardEvent) => {
    // Typing on the focused box carries the first letter into the search window.
    if (
      e.key.length === 1 &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      e.key !== " "
    ) {
      e.preventDefault();
      openSearch(e.key);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => openSearch()}
        onKeyDown={onKeyDown}
        onPointerEnter={prefetch}
        onFocus={prefetch}
        aria-label="Search"
        aria-keyshortcuts="Control+K Meta+K /"
        className="hidden h-10 w-full max-w-md items-center gap-2 rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground shadow-xs transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring md:flex"
      >
        <Search className="size-4 shrink-0" />
        <span className="flex-1 truncate text-left">
          Search pages, people, training…
        </span>
        {mod && (
          <kbd className="pointer-events-none hidden h-5 items-center gap-0.5 rounded border bg-background px-1.5 font-sans text-[10px] font-medium lg:inline-flex">
            {mod === "⌘" ? <span className="text-xs">⌘</span> : "Ctrl"}K
          </kbd>
        )}
      </button>
      <Button
        variant="outline"
        size="icon"
        onClick={() => openSearch()}
        onPointerEnter={prefetch}
        className="md:hidden"
        aria-label="Search"
      >
        <Search className="h-[1.2rem] w-[1.2rem]" />
      </Button>
    </>
  );
}
