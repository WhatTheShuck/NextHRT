"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { CommandPalette } from "./command-palette";
import { prefetchSearchIndex } from "./use-search-index";

interface SearchContextValue {
  /** False when signed out: the search bar and shortcuts stay hidden. */
  enabled: boolean;
  openSearch: (query?: string) => void;
  prefetch: () => void;
}

const SearchContext = createContext<SearchContextValue>({
  enabled: false,
  openSearch: () => {},
  prefetch: () => {},
});

export const useSearch = () => useContext(SearchContext);

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}

/**
 * Owns the one command palette for the app and its global shortcuts:
 * Ctrl/⌘+K from anywhere, and "/" when not already typing in a field.
 */
export function SearchProvider({
  userId,
  children,
}: {
  userId: string | null;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [initialQuery, setInitialQuery] = useState("");
  // Bumped on every open so the palette starts fresh, even when reopened
  // mid-way through its close animation (when its content is still mounted).
  const [openCount, setOpenCount] = useState(0);
  const enabled = userId !== null;

  const openSearch = useCallback((query = "") => {
    setInitialQuery(query);
    setOpenCount((c) => c + 1);
    setOpen(true);
  }, []);

  const prefetch = useCallback(() => {
    if (userId) prefetchSearchIndex(userId);
  }, [userId]);

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() === "k" &&
        (e.metaKey || e.ctrlKey) &&
        !e.altKey &&
        !e.shiftKey
      ) {
        e.preventDefault();
        if (open) setOpen(false);
        else openSearch();
      } else if (
        e.key === "/" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !isTypingTarget(e.target)
      ) {
        e.preventDefault();
        openSearch();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, open, openSearch]);

  const value = useMemo(
    () => ({ enabled, openSearch, prefetch }),
    [enabled, openSearch, prefetch],
  );

  return (
    <SearchContext.Provider value={value}>
      {children}
      {userId && (
        <CommandPalette
          open={open}
          onOpenChange={setOpen}
          userId={userId}
          initialQuery={initialQuery}
          openCount={openCount}
        />
      )}
    </SearchContext.Provider>
  );
}
