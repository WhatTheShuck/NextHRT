"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Driver } from "driver.js";
import { toast } from "sonner";
import api from "@/lib/axios";
import { stepsFor, tourKey, whatsNewKey } from "@/lib/tours/audience";
import { tourById, tourForPath } from "@/lib/tours/registry";
import { currentRelease } from "@/lib/tours/whats-new";
import type { PageTour, TutorialMode } from "@/lib/tours/types";
import type { TutorialState } from "@/lib/services/tutorialService";
import { runTour, waitForTargets } from "./run-tour";
import { HelpButton } from "./help-button";
import { WhatsNewDialog } from "./whats-new-dialog";

interface TutorialContextValue {
  state: TutorialState | null;
  /** The tour for the current page, if this person can take it. */
  pageTour: PageTour | undefined;
  startPageTour: () => void;
  setMode: (mode: TutorialMode) => Promise<void>;
  replayAll: () => Promise<void>;
  openWhatsNew: () => void;
}

const TutorialContext = createContext<TutorialContextValue | null>(null);

/** Null outside the provider (signed-out pages). */
export function useTutorials() {
  return useContext(TutorialContext);
}

/**
 * Page tours, the help button and the one-time What's new popup. Wraps the
 * whole app from the root layout; does nothing until someone is signed in.
 */
export function TutorialProvider({
  signedIn,
  children,
}: {
  signedIn: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [state, setState] = useState<TutorialState | null>(null);
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  const activeTour = useRef<Driver | null>(null);
  // The tour that's waiting for its page to load, if any. Only one may wait at a time.
  const waiting = useRef<AbortController | null>(null);
  // A tour asked for from another page ("Show me" in What's new), run on arrival.
  const pendingTourId = useRef<string | null>(null);
  // The path we last decided about, so saving progress doesn't re-trigger the auto tour.
  const handledPath = useRef<string | null>(null);

  useEffect(() => {
    if (!signedIn) return; // signing in or out reloads the page, so this never flips mid-session
    api
      .get<TutorialState>("/api/tutorials")
      .then((res) => {
        setState(res.data);
        if (res.data.showWhatsNew) setWhatsNewOpen(true);
      })
      .catch(() => {}); // no help button is better than a broken one
  }, [signedIn]);

  const markSeen = useCallback((key: string) => {
    setState((s) => (s && !s.seen.includes(key) ? { ...s, seen: [...s.seen, key] } : s));
    api.post("/api/tutorials/seen", { key }).catch(() => {});
  }, []);

  const setMode = useCallback(async (mode: TutorialMode) => {
    setState((s) => (s ? { ...s, mode } : s));
    await api.put("/api/tutorials", { mode });
  }, []);

  const pageTour = useMemo(() => {
    const tour = tourForPath(pathname);
    if (!tour || !state) return undefined;
    if (tour.when && !tour.when(state.audience)) return undefined;
    return stepsFor(tour, state.audience).length > 0 ? tour : undefined;
  }, [pathname, state]);

  /** Rejects if superseded by another start, or the page changes, before the tour begins. */
  const start = useCallback(
    async (tour: PageTour, { auto }: { auto: boolean }) => {
      if (!state) return;
      waiting.current?.abort();
      const controller = new AbortController();
      waiting.current = controller;

      const steps = stepsFor(tour, state.audience);
      const ready = await waitForTargets(steps, controller.signal);
      if (waiting.current === controller) waiting.current = null;
      if (!ready && auto) return; // the page didn't load as expected; don't tour an error
      if (activeTour.current?.isActive()) return;
      activeTour.current = runTour({
        steps,
        onClose: () => {
          activeTour.current = null;
          markSeen(tourKey(tour));
        },
        onTurnOff: auto
          ? () => {
              setMode("Off").catch(() => {});
              toast("Tips won't start on their own any more", {
                description: "Click the ? button whenever you'd like a walkthrough.",
              });
            }
          : undefined,
      });
    },
    [state, markSeen, setMode],
  );

  // Leaving the page ends its tour, or stops one waiting to start.
  useEffect(() => {
    return () => {
      waiting.current?.abort();
      waiting.current = null;
      activeTour.current?.destroy();
      activeTour.current = null;
    };
  }, [pathname]);

  // Start the page's tour on arrival, per the user's setting.
  useEffect(() => {
    if (!state || whatsNewOpen || handledPath.current === pathname) return;

    let tour: PageTour | undefined;
    let auto = true;
    if (pendingTourId.current) {
      tour = tourById(pendingTourId.current);
      auto = false;
      if (!tour?.path.test(pathname)) tour = undefined;
      pendingTourId.current = null;
    }
    if (!tour && pageTour && state.mode !== "Off") {
      const seen = state.seen.includes(tourKey(pageTour));
      if (state.mode === "Always" || !seen) tour = pageTour;
    }
    if (!tour) {
      handledPath.current = pathname;
      return;
    }

    start(tour, { auto })
      .then(() => {
        handledPath.current = pathname;
      })
      .catch(() => {}); // superseded: the page changed, or settings did — decide again
    return () => {
      // Settings changed while this was still waiting: stop it, and this effect
      // decides afresh. (A tour started by hand marks the page handled, so it's left alone.)
      if (handledPath.current !== pathname) waiting.current?.abort();
    };
  }, [pathname, state, whatsNewOpen, pageTour, start]);

  const startPageTour = useCallback(() => {
    if (!pageTour) return;
    handledPath.current = pathname; // asked for by hand; don't also auto-start
    activeTour.current?.destroy();
    start(pageTour, { auto: false }).catch(() => {});
  }, [pageTour, pathname, start]);

  const replayAll = useCallback(async () => {
    setState((s) => (s ? { ...s, seen: s.seen.filter((k) => k.startsWith("whats-new@")) } : s));
    await api.delete("/api/tutorials/seen");
  }, []);

  const closeWhatsNew = useCallback(() => {
    setWhatsNewOpen(false);
    markSeen(whatsNewKey(currentRelease.id));
  }, [markSeen]);

  /** "Show me" in What's new: go to the page and walk through it. */
  const showMe = useCallback(
    (href: string) => {
      closeWhatsNew();
      const target = tourForPath(href);
      if (!target) {
        router.push(href);
        return;
      }
      handledPath.current = pathname; // don't start this page's own tour on the way out
      if (target === tourForPath(pathname)) {
        start(target, { auto: false }).catch(() => {});
        return;
      }
      pendingTourId.current = target.id;
      router.push(href);
    },
    [closeWhatsNew, pathname, router, start],
  );

  const value = useMemo<TutorialContextValue>(
    () => ({
      state,
      pageTour,
      startPageTour,
      setMode,
      replayAll,
      openWhatsNew: () => setWhatsNewOpen(true),
    }),
    [state, pageTour, startPageTour, setMode, replayAll],
  );

  return (
    <TutorialContext.Provider value={value}>
      {children}
      {signedIn && state && (
        <>
          <HelpButton />
          <WhatsNewDialog
            open={whatsNewOpen}
            audience={state.audience}
            onClose={closeWhatsNew}
            onShowMe={showMe}
          />
        </>
      )}
    </TutorialContext.Provider>
  );
}
