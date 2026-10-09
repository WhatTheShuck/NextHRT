"use client";

import { useState } from "react";
import Link from "next/link";
import { HelpCircle, Mail, Phone, Play, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { contactDetails } from "@/lib/data";
import { currentRelease, whatsNewItemsFor } from "@/lib/tours/whats-new";
import { useTutorials } from "./tutorial-provider";
import { TutorialModeSelect } from "./tutorial-mode-select";

const GENERAL_TIPS = [
  "Use the search box at the top of the page to jump anywhere.",
  "Click the HRT logo to get back to your dashboard.",
];

/**
 * The floating "?" in the bottom corner: what this page is for, a few tips,
 * and a button to be walked through it.
 */
export function HelpButton() {
  const tutorials = useTutorials();
  const [open, setOpen] = useState(false);
  if (!tutorials?.state) return null;

  const { pageTour, state } = tutorials;
  const tips = pageTour
    ? (pageTour.tips ?? []).filter((t) => !t.when || t.when(state.audience)).map((t) => t.text)
    : GENERAL_TIPS;
  const hasWhatsNew = whatsNewItemsFor(currentRelease, state.audience).length > 0;

  const run = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          data-tour="help-button"
          size="icon"
          aria-label="Help with this page"
          className="hrt-help-fab fixed right-4 bottom-4 z-40 size-12 rounded-full shadow-lg print:hidden md:right-6 md:bottom-6 [&_svg]:size-6"
        >
          <HelpCircle />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        sideOffset={10}
        className="w-[min(22rem,calc(100vw-2rem))] space-y-4 p-4"
      >
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Help with this page
          </p>
          <h2 className="text-base font-semibold">{pageTour?.title ?? "Need a hand?"}</h2>
          <p className="text-sm text-muted-foreground">
            {pageTour?.summary ??
              "There's no walkthrough for this page yet, but these might help."}
          </p>
        </div>

        {tips.length > 0 && (
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-2">
          {pageTour && (
            <Button onClick={() => run(tutorials.startPageTour)}>
              <Play className="size-4" />
              Show me around this page
            </Button>
          )}
          {hasWhatsNew && (
            <Button variant="outline" onClick={() => run(tutorials.openWhatsNew)}>
              <Sparkles className="size-4" />
              What&apos;s new in HRT
            </Button>
          )}
        </div>

        <Separator />

        <div className="space-y-1.5">
          <Label htmlFor="help-tutorial-mode" className="text-xs">
            Show page tips automatically
          </Label>
          <TutorialModeSelect id="help-tutorial-mode" />
          <p className="text-xs text-muted-foreground">
            More options on your{" "}
            <Link href="/profile#tutorials" className="underline" onClick={() => setOpen(false)}>
              profile
            </Link>
            .
          </p>
        </div>

        <Separator />

        <div className="space-y-1 text-xs text-muted-foreground">
          <p>
            Still stuck? Contact {contactDetails.name} ({contactDetails.role}).
          </p>
          <p className="flex flex-wrap gap-x-4 gap-y-1">
            <a
              href={`tel:${contactDetails.phoneNumber.replace(/[^\d+]/g, "")}`}
              className="inline-flex items-center gap-1 hover:underline"
            >
              <Phone className="size-3" />
              {contactDetails.phoneNumber}
            </a>
            <a
              href={`mailto:${contactDetails.emailAdress}`}
              className="inline-flex items-center gap-1 hover:underline"
            >
              <Mail className="size-3" />
              {contactDetails.emailAdress}
            </a>
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
