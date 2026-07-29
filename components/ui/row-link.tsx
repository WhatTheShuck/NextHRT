import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Stretches a real anchor across the whole table row so navigation uses genuine
 * link semantics — Ctrl/Cmd+click and middle-click open a new tab, right-click
 * offers "Open in new tab", and the URL previews on hover.
 *
 * Usage: mark the `<TableRow>` `relative` and drop a single `<RowLink>` inside
 * the first cell. The anchor is transparent and covers the entire row via
 * `absolute inset-0`. Any other interactive element in the row (buttons, menus)
 * must be given `relative z-10` so it sits above the overlay and stays clickable.
 */
export function RowLink({
  href,
  label,
  className,
}: {
  /** Destination href. */
  href: string;
  /** Accessible name for the link (e.g. the row's primary text). */
  label: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn("absolute inset-0", className)}
      // Row content lives in normal flow; the overlay only needs to catch clicks.
      tabIndex={0}
    />
  );
}
