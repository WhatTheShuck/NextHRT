"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useTutorials } from "@/components/tutorials/tutorial-provider";
import { TUTORIAL_MODE_OPTIONS } from "@/components/tutorials/tutorial-mode-select";
import type { TutorialMode } from "@/lib/tours/types";

export function TutorialSettings() {
  const tutorials = useTutorials();
  const [resetting, setResetting] = useState(false);
  if (!tutorials?.state) return null;

  async function handleChange(mode: string) {
    try {
      await tutorials!.setMode(mode as TutorialMode);
    } catch {
      toast.error("Couldn't save that. Please try again.");
    }
  }

  async function handleReplay() {
    setResetting(true);
    try {
      await tutorials!.replayAll();
      toast.success("Page tips will show again", {
        description: "Each page will walk you through itself the next time you open it.",
      });
    } catch {
      toast.error("Couldn't reset your tips. Please try again.");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Page tips highlight each part of a page and explain what it does. You
          can always start them yourself from the ? button in the bottom corner.
        </p>
        <RadioGroup
          value={tutorials.state.mode}
          onValueChange={handleChange}
          aria-label="When should page tips start on their own?"
          className="gap-3"
        >
          {TUTORIAL_MODE_OPTIONS.map((o) => (
            <div key={o.value} className="flex items-start gap-3">
              <RadioGroupItem value={o.value} id={`tutorial-mode-${o.value}`} className="mt-0.5" />
              <Label htmlFor={`tutorial-mode-${o.value}`} className="flex flex-col items-start gap-0.5">
                <span className="text-sm font-medium">{o.label}</span>
                <span className="text-sm font-normal text-muted-foreground">{o.description}</span>
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={handleReplay} disabled={resetting}>
          Show all page tips again
        </Button>
        <Button variant="ghost" onClick={tutorials.openWhatsNew}>
          What&apos;s new in HRT
        </Button>
      </div>
    </div>
  );
}
