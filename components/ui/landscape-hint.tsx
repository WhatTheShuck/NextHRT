"use client";

import { useState, useEffect } from "react";
import { RotateCcw, X } from "lucide-react";
import { useMediaQuery } from "usehooks-ts";

const STORAGE_KEY = "landscape-hint-dismissed";

export function LandscapeHint() {
  const isMobile = useMediaQuery("(max-width: 767px)");
  // Start as dismissed so there's no flash while localStorage is checked
  const [dismissed, setDismissed] = useState(true);
  const [isPortrait, setIsPortrait] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) !== "true") {
      setDismissed(false);
    }

    const mq = window.matchMedia("(orientation: portrait)");
    const update = () => setIsPortrait(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(STORAGE_KEY, "true");
  };

  if (!isMobile || !isPortrait || dismissed) return null;

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/60 border rounded-md px-3 py-2 mb-3">
      <RotateCcw className="h-3.5 w-3.5 shrink-0" />
      <span>Rotate to landscape for a better table view</span>
      <button
        onClick={handleDismiss}
        className="ml-auto p-0.5 rounded hover:text-foreground transition-colors"
        aria-label="Dismiss tip"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
