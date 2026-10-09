import { driver, type DriveStep, type Driver } from "driver.js";
import type { TourStep } from "@/lib/tours/types";

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const selectorOf = (step: TourStep) =>
  step.selector ?? (step.target ? `[data-tour="${step.target}"]` : null);

/** The first matching element that's actually on screen (some come in desktop and mobile pairs). */
function findVisible(selector: string): Element | null {
  for (const el of document.querySelectorAll(selector)) {
    if (el.getClientRects().length > 0) return el;
  }
  return null;
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(t);
      reject(signal.reason);
    });
  });

/**
 * Pages load their data after they render, so wait until at least one of the
 * tour's elements is on screen, then give the rest a moment to settle.
 * Resolves false if nothing turned up (an error page, an empty list).
 */
export async function waitForTargets(
  steps: TourStep[],
  signal: AbortSignal,
  { timeout = 6000, settle = 500 } = {},
): Promise<boolean> {
  const selectors = steps.map(selectorOf).filter((s): s is string => !!s);
  if (selectors.length === 0) return true;

  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (selectors.some((s) => findVisible(s))) {
      await sleep(settle, signal);
      return true;
    }
    await sleep(150, signal);
  }
  return false;
}

export interface RunTourOptions {
  steps: TourStep[];
  /** Called once the tour closes, however it closed. */
  onClose: () => void;
  /** Adds a "don't show these automatically" link (for tours that started on their own). */
  onTurnOff?: () => void;
}

/** Starts a tour over whatever steps' elements are on screen now. Null if there's nothing to show. */
export function runTour({ steps, onClose, onTurnOff }: RunTourOptions): Driver | null {
  const driveSteps: DriveStep[] = [];
  for (const step of steps) {
    const selector = selectorOf(step);
    const element = selector ? findVisible(selector) : undefined;
    if (selector && !element) continue; // not on the page for this person, or not loaded

    const badge = step.isNew ? '<span class="hrt-tour-new">New</span>' : "";
    driveSteps.push({
      element: element ?? undefined,
      popover: {
        title: `${badge}${escapeHtml(step.title)}`,
        description: escapeHtml(step.body),
        side: step.side,
        align: "start",
      },
    });
  }
  if (driveSteps.length === 0) return null;

  const tour = driver({
    steps: driveSteps,
    showProgress: driveSteps.length > 1,
    progressText: "{{current}} of {{total}}",
    nextBtnText: "Next",
    prevBtnText: "Back",
    doneBtnText: "Done",
    popoverClass: "hrt-tour",
    overlayOpacity: 0.65,
    stagePadding: 6,
    stageRadius: 8,
    smoothScroll: true,
    // People click the highlighted thing to "try it" and get taken off the page
    // mid-tour; and a stray click on the dimmed page shouldn't end it either.
    disableActiveInteraction: true,
    overlayClickBehavior: () => {},
    onPopoverRender: (popover) => {
      if (!onTurnOff) return;
      const off = document.createElement("button");
      off.type = "button";
      off.className = "hrt-tour-off";
      off.textContent = "Don't show tips automatically";
      off.addEventListener("click", () => {
        onTurnOff();
        tour.destroy();
      });
      popover.description.after(off);
    },
    onDestroyed: () => onClose(),
  });
  tour.drive();
  return tour;
}
