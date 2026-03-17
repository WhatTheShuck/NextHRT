"use client";

import { useState } from "react";
import { useMediaQuery } from "usehooks-ts";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter,
} from "@/components/ui/drawer";
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

interface ContentProps {
  type: "COMPANY" | "USER";
  onSaved: () => void;
  onClose: () => void;
  footer: "dialog" | "drawer";
}

function ThemePasteContent({ type, onSaved, onClose, footer }: ContentProps) {
  const [name, setName] = useState("");
  const [pasteInput, setPasteInput] = useState("");
  const [preview, setPreview] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function handlePasteChange(value: string) {
    setPasteInput(value);
    setSaveError(null);
    const vars: Record<string, string> = {};
    for (const match of value.matchAll(/(-{2}[\w-]+)\s*:\s*([^;]+);/g)) {
      let val = match[2].trim();
      const hslMatch = val.match(
        /^hsl\(\s*(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%(?:\s*\/\s*[\d.]+%?)?\s*\)/
      );
      if (hslMatch) val = `${hslMatch[1]} ${hslMatch[2]}% ${hslMatch[3]}%`;
      vars[match[1].trim()] = val;
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
      onClose();
      setName("");
      setPasteInput("");
      setPreview({});
    } catch {
      setSaveError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  }

  const fields = (
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
          <a href="https://ui.shadcn.com/themes" target="_blank" rel="noreferrer" className="underline">
            shadcn/ui
          </a>{" "}
          or{" "}
          <a href="https://tweakcn.com" target="_blank" rel="noreferrer" className="underline">
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
        {saveError && <p className="text-destructive text-sm mt-1">{saveError}</p>}
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
  );

  const actions = (
    <>
      <Button variant="outline" onClick={onClose}>Cancel</Button>
      <Button onClick={handleSave} disabled={saving || !name.trim() || !pasteInput.trim()}>
        {saving ? "Saving..." : "Save theme"}
      </Button>
    </>
  );

  if (footer === "dialog") {
    return (
      <>
        {fields}
        <DialogFooter className="mt-4">{actions}</DialogFooter>
      </>
    );
  }

  return (
    <>
      {fields}
      <DrawerFooter className="pt-4 flex-row justify-end gap-2">{actions}</DrawerFooter>
    </>
  );
}

export function ThemePasteDialog({ open, onOpenChange, type = "USER", onSaved }: ThemePasteDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add custom theme</DialogTitle>
          </DialogHeader>
          <ThemePasteContent
            type={type}
            onSaved={onSaved}
            onClose={() => onOpenChange(false)}
            footer="dialog"
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>Add custom theme</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 overflow-y-auto">
          <ThemePasteContent
            type={type}
            onSaved={onSaved}
            onClose={() => onOpenChange(false)}
            footer="drawer"
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
