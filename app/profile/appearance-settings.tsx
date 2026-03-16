"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemePreview } from "@/components/theme-preview";
import { ThemePasteDialog } from "@/components/theme-paste-dialog";
import { Trash2 } from "lucide-react";

interface Theme {
  id: string;
  name: string;
  slug: string;
  type: "BUILTIN" | "COMPANY" | "USER";
  cssVars: Record<string, string>;
  darkCssVars: Record<string, string>;
  userId: string | null;
}

interface AppearanceSettingsProps {
  currentThemeId: string | null;
  locked: boolean;
}

export function AppearanceSettings({ currentThemeId: initialThemeId, locked }: AppearanceSettingsProps) {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [activeThemeId, setActiveThemeId] = useState<string | null>(initialThemeId);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadThemes = useCallback(async () => {
    const res = await fetch("/api/themes");
    if (res.ok) setThemes(await res.json() as Theme[]);
  }, []);

  useEffect(() => { void loadThemes(); }, [loadThemes]);

  async function selectTheme(id: string | null) {
    if (locked) return;
    setSaving(true);
    try {
      const res = await fetch("/api/themes/active", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ themeId: id }),
      });
      if (res.ok) setActiveThemeId(id);
    } finally {
      setSaving(false);
    }
  }

  async function deleteUserTheme(id: string) {
    if (locked || deletingId !== null) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/themes/${id}`, { method: "DELETE" });
      if (!res.ok) return;
      setThemes((prev) => prev.filter((t) => t.id !== id));
      if (activeThemeId === id) await selectTheme(null);
    } finally {
      setDeletingId(null);
    }
  }

  const builtins = themes.filter((t) => t.type === "BUILTIN");
  const company = themes.filter((t) => t.type === "COMPANY");
  const userThemes = themes.filter((t) => t.type === "USER");

  return (
    <div className="space-y-8">
      {locked && (
        <p className="text-sm text-muted-foreground bg-muted rounded-md px-3 py-2">
          Theme selection is locked by your organisation.
        </p>
      )}

      {/* Built-in themes first */}
      <div className="space-y-3">
        <h3 className="font-semibold">Built-in themes</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {builtins.map((theme) => (
            <ThemePreview
              key={theme.id}
              cssVars={theme.cssVars}
              name={theme.name}
              selected={activeThemeId === theme.id}
              onClick={locked ? undefined : () => selectTheme(theme.id)}
            />
          ))}
        </div>
      </div>

      {/* Company themes second */}
      {company.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold">Company themes</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {company.map((theme) => (
              <ThemePreview
                key={theme.id}
                cssVars={theme.cssVars}
                name={theme.name}
                selected={activeThemeId === theme.id}
                onClick={locked ? undefined : () => selectTheme(theme.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* User's own custom themes third */}
      {(!locked || userThemes.length > 0) && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Custom themes</h3>
            {!locked && (
              <Button size="sm" onClick={() => setPasteOpen(true)}>
                + Custom theme
              </Button>
            )}
          </div>
          {userThemes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No custom themes yet. Paste CSS or JSON from{" "}
              <a
                href="https://ui.shadcn.com/themes"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                shadcn/ui
              </a>{" "}
              or{" "}
              <a
                href="https://tweakcn.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                tweakcn.com
              </a>
              .
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {userThemes.map((theme) => (
                <div key={theme.id} className="relative">
                  <ThemePreview
                    cssVars={theme.cssVars}
                    name={theme.name}
                    selected={activeThemeId === theme.id}
                    onClick={locked ? undefined : () => selectTheme(theme.id)}
                  />
                  <button
                    type="button"
                    className="absolute top-1 left-1 text-destructive/70 hover:text-destructive disabled:opacity-30 disabled:cursor-not-allowed"
                    disabled={locked || deletingId !== null}
                    onClick={() => deleteUserTheme(theme.id)}
                    aria-label={`Delete ${theme.name}`}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!locked && (
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={saving || activeThemeId === null}
            onClick={() => selectTheme(null)}
          >
            Reset to org default
          </Button>
          {activeThemeId === null && (
            <Badge variant="secondary" className="text-xs">
              Using org default
            </Badge>
          )}
        </div>
      )}

      <ThemePasteDialog
        open={pasteOpen}
        onOpenChange={setPasteOpen}
        type="USER"
        onSaved={loadThemes}
      />
    </div>
  );
}
