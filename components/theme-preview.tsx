"use client";

import type { CSSProperties } from "react";

interface ThemePreviewProps {
  cssVars: Record<string, string>;
  name: string;
  selected?: boolean;
  onClick?: () => void;
}

export function ThemePreview({ cssVars, name, selected, onClick }: ThemePreviewProps) {
  const style = Object.fromEntries(
    Object.entries(cssVars).map(([k, v]) => [k, v])
  ) as CSSProperties;

  return (
    <button
      type="button"
      onClick={onClick}
      style={style}
      className={`relative rounded-lg border-2 p-3 text-left transition-all w-full cursor-pointer ${
        selected
          ? "border-[hsl(var(--ring))] ring-2 ring-[hsl(var(--ring))] ring-offset-1"
          : "border-[hsl(var(--border))] hover:border-[hsl(var(--ring))]"
      }`}
    >
      {selected && (
        <span className="absolute top-1 right-1 text-[9px] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded px-1 leading-4">
          ✓
        </span>
      )}
      <div className="space-y-1.5 pointer-events-none">
        <div className="h-2.5 w-full rounded-sm bg-[hsl(var(--primary))]" />
        <div className="rounded-sm bg-[hsl(var(--card,_var(--background)))] border border-[hsl(var(--border))] p-1.5 space-y-1">
          <div className="h-1.5 w-3/4 rounded-sm bg-[hsl(var(--foreground))] opacity-60" />
          <div className="h-1.5 w-1/2 rounded-sm bg-[hsl(var(--foreground))] opacity-30" />
        </div>
        <div className="h-3.5 w-12 rounded-sm bg-[hsl(var(--primary))] opacity-90" />
      </div>
      <p className="mt-2 text-[10px] font-medium text-[hsl(var(--foreground))] truncate leading-tight">
        {name}
      </p>
    </button>
  );
}
