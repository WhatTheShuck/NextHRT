"use client";

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ThemePreview } from "@/components/theme-preview";

interface ThemePasteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type?: "COMPANY" | "USER";
  onSaved: () => void;
}

export function ThemePasteDialog({
  open,
  onOpenChange,
  type = "USER",
  onSaved,
}: ThemePasteDialogProps) {
  const [name, setName] = useState("");
  const [pasteInput, setPasteInput] = useState("");
  const [preview, setPreview] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function handlePasteChange(value: string) {
    setPasteInput(value);
    setSaveError(null);
    // Quick client-side extract for live preview only — server validates properly on save
    const vars: Record<string, string> = {};
    for (const match of value.matchAll(/(-{2}[\w-]+)\s*:\s*([^;]+);/g)) {
      vars[match[1].trim()] = match[2].trim();
    }
    setPreview(vars);
  }

  async function handleSave() {
    if (!name.trim() || !pasteInput.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/themes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), pasteInput, type }),
      });
      if (!res.ok) {
        const data = await res.json() as { message?: string };
        setSaveError(data.message ?? "Failed to save theme");
        return;
      }
      onSaved();
      onOpenChange(false);
      setName("");
      setPasteInput("");
      setPreview({});
    } catch {
      setSaveError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add custom theme</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="theme-name">Theme name</Label>
            <Input
              id="theme-name"
              placeholder="e.g. KSB Classic Blue"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="paste-input">
              Paste CSS or JSON from{" "}
              <a
                href="https://ui.shadcn.com/themes"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                shadcn/ui
              </a>{" "}
              or{" "}
              <a
                href="https://tweakcn.com"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                tweakcn.com
              </a>
            </Label>
            <Textarea
              id="paste-input"
              placeholder=":root { --primary: 217 91% 60%; ... }"
              value={pasteInput}
              onChange={(e) => handlePasteChange(e.target.value)}
              className="font-mono text-xs min-h-36"
            />
            {saveError && (
              <p className="text-destructive text-sm mt-1">{saveError}</p>
            )}
          </div>

          {Object.keys(preview).length > 0 && (
            <div>
              <Label>Preview</Label>
              <div className="max-w-32 mt-1">
                <ThemePreview cssVars={preview} name={name || "Preview"} />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !name.trim() || !pasteInput.trim()}
          >
            {saving ? "Saving..." : "Save theme"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
