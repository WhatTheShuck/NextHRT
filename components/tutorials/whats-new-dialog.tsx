"use client";

import { useRef } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { currentRelease, whatsNewItemsFor } from "@/lib/tours/whats-new";
import type { Audience, WhatsNewItem } from "@/lib/tours/types";
import { TutorialModeSelect } from "./tutorial-mode-select";

const GROUP_HEADINGS: Record<WhatsNewItem["group"], string> = {
  everyone: "For everyone",
  managers: "For managers",
  admins: "For admins",
};

/** The once-per-release popup for people who were already using HRT. */
export function WhatsNewDialog({
  open,
  audience,
  onClose,
  onShowMe,
}: {
  open: boolean;
  audience: Audience;
  onClose: () => void;
  onShowMe: (href: string) => void;
}) {
  const gotIt = useRef<HTMLButtonElement>(null);
  const items = whatsNewItemsFor(currentRelease, audience);
  const groups = (Object.keys(GROUP_HEADINGS) as WhatsNewItem["group"][])
    .map((group) => ({ group, items: items.filter((i) => i.group === group) }))
    .filter((g) => g.items.length > 0);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="flex max-h-[90dvh] flex-col gap-4 sm:max-w-xl"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          gotIt.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{currentRelease.title}</DialogTitle>
          <DialogDescription>
            HRT has had a big update. Here&apos;s what&apos;s changed for you.
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-6 flex-1 space-y-6 overflow-y-auto px-6">
          {groups.map(({ group, items }) => (
            <section key={group} className="space-y-3">
              {groups.length > 1 && (
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {GROUP_HEADINGS[group]}
                </h3>
              )}
              <ul className="space-y-3">
                {items.map((item) => (
                  <li key={item.title} className="rounded-lg border p-3">
                    <p className="font-medium">{item.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
                    {item.href && (
                      <Button
                        variant="link"
                        className="mt-1 h-auto p-0 text-sm"
                        onClick={() => onShowMe(item.href!)}
                      >
                        Show me
                        <ArrowRight className="size-3.5" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <DialogFooter className="flex-col gap-3 border-t pt-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1.5 sm:w-64">
            <Label htmlFor="whats-new-tutorial-mode" className="text-xs">
              Walk me through each page
            </Label>
            <TutorialModeSelect id="whats-new-tutorial-mode" />
          </div>
          <Button ref={gotIt} onClick={onClose}>
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
