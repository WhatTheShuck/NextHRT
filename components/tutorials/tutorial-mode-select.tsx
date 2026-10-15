"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TutorialMode } from "@/lib/tours/types";
import { useTutorials } from "./tutorial-provider";

export const TUTORIAL_MODE_OPTIONS: {
  value: TutorialMode;
  label: string;
  description: string;
}[] = [
  {
    value: "FirstVisit",
    label: "The first time I open a page",
    description: "Each page walks you through itself once.",
  },
  {
    value: "Always",
    label: "Every time I open a page",
    description: "Handy if you only use HRT now and then.",
  },
  {
    value: "Off",
    label: "Only when I ask",
    description: "Click the ? button whenever you want a walkthrough.",
  },
];

/** Compact picker for when page tips start on their own. */
export function TutorialModeSelect({ id }: { id: string }) {
  const tutorials = useTutorials();
  if (!tutorials?.state) return null;

  return (
    <Select
      value={tutorials.state.mode}
      onValueChange={(mode) => tutorials.setMode(mode as TutorialMode).catch(() => {})}
    >
      <SelectTrigger id={id} className="h-8 w-full text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {TUTORIAL_MODE_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value} className="text-xs">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
