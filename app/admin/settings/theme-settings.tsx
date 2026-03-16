"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
}

export function ThemeSettings() {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [defaultSlug, setDefaultSlug] = useState("default");
  const [locked, setLocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);

  const loadData = useCallback(async () => {
    const [themesRes, settingsRes] = await Promise.all([
      fetch("/api/themes"),
      fetch("/api/settings"),
    ]);
    if (themesRes.ok) setThemes(await themesRes.json() as Theme[]);
    if (settingsRes.ok) {
      const s = await settingsRes.json() as Record<string, string>;
      setDefaultSlug(s["theme.default"] ?? "default");
      setLocked(s["theme.lock"] === "true");
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  async function setDefault(slug: string) {
    setSaving(true);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates: [{ key: "theme.default", value: slug }] }),
    });
    setDefaultSlug(slug);
    setSaving(false);
  }

  async function toggleLock(checked: boolean) {
    setSaving(true);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        updates: [{ key: "theme.lock", value: checked ? "true" : "false" }],
      }),
    });
    setLocked(checked);
    setSaving(false);
  }

  async function deleteTheme(id: string) {
    await fetch(`/api/themes/${id}`, { method: "DELETE" });
    setThemes((prev) => prev.filter((t) => t.id !== id));
  }

  const builtins = themes.filter((t) => t.type === "BUILTIN");
  const company = themes.filter((t) => t.type === "COMPANY");

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <Switch
          id="theme-lock"
          checked={locked}
          onCheckedChange={toggleLock}
          disabled={saving}
        />
        <Label htmlFor="theme-lock">
          Lock theme — prevent users from choosing their own
        </Label>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Company themes</h3>
          <Button size="sm" onClick={() => setPasteOpen(true)}>
            Add theme
          </Button>
        </div>
        {company.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No company themes yet. Add one by pasting from shadcn/ui or tweakcn.com.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {company.map((theme) => (
              <div key={theme.id} className="relative">
                <ThemePreview
                  cssVars={theme.cssVars}
                  name={theme.name}
                  selected={defaultSlug === theme.slug}
                  onClick={() => setDefault(theme.slug)}
                />
                <button
                  type="button"
                  className="absolute top-1 left-1 text-destructive/70 hover:text-destructive"
                  onClick={() => deleteTheme(theme.id)}
                  aria-label={`Delete ${theme.name}`}
                >
                  <Trash2 size={12} />
                </button>
                {defaultSlug === theme.slug && (
                  <Badge className="absolute bottom-7 left-1 text-[9px] px-1 py-0">
                    Org default
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold">Built-in themes</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {builtins.map((theme) => (
            <div key={theme.id} className="relative">
              <ThemePreview
                cssVars={theme.cssVars}
                name={theme.name}
                selected={defaultSlug === theme.slug}
                onClick={() => setDefault(theme.slug)}
              />
              {defaultSlug === theme.slug && (
                <Badge className="absolute bottom-7 left-1 text-[9px] px-1 py-0">
                  Org default
                </Badge>
              )}
            </div>
          ))}
        </div>
      </div>

      <ThemePasteDialog
        open={pasteOpen}
        onOpenChange={setPasteOpen}
        type="COMPANY"
        onSaved={loadData}
      />
    </div>
  );
}
