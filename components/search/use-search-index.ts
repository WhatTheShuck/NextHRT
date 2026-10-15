"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import api from "@/lib/axios";
import type { SearchIndexPayload } from "@/lib/search/types";

// One index per tab, shared by every palette open. Reopening within STALE_MS
// is instant; after that the old index shows while a fresh one loads.
const STALE_MS = 2 * 60_000;

interface State {
  userId: string;
  data: SearchIndexPayload | null;
  at: number;
  error: boolean;
}

let state: State | null = null;
let inflight: { userId: string; promise: Promise<void> } | null = null;
const listeners = new Set<() => void>();

function set(next: State) {
  state = next;
  listeners.forEach((l) => l());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

function load(userId: string): Promise<void> {
  if (inflight?.userId === userId) return inflight.promise;
  const previous = state?.userId === userId ? state : null;
  if (previous?.error) set({ ...previous, error: false });
  const promise = api
    .get<SearchIndexPayload>("/api/search")
    .then((res) =>
      set({ userId, data: res.data, at: Date.now(), error: false }),
    )
    .catch(() =>
      set({
        userId,
        data: previous?.data ?? null,
        at: previous?.at ?? 0,
        error: true,
      }),
    )
    .finally(() => {
      if (inflight?.promise === promise) inflight = null;
    });
  inflight = { userId, promise };
  return promise;
}

/** Load the index unless a fresh one is already cached, e.g. when the search bar is hovered. */
export function prefetchSearchIndex(userId: string) {
  if (
    state?.userId === userId &&
    state.data &&
    Date.now() - state.at < STALE_MS
  )
    return;
  void load(userId);
}

export function useSearchIndex(userId: string, active: boolean) {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => state,
    () => null,
  );
  const mine = snapshot?.userId === userId ? snapshot : null;

  useEffect(() => {
    if (active) prefetchSearchIndex(userId);
  }, [active, userId]);

  const refresh = useCallback(() => load(userId), [userId]);

  return {
    data: mine?.data ?? null,
    loading: !mine?.data && !mine?.error,
    // Stale results beat an error message, so only report one when there's nothing to show.
    error: !!mine?.error && !mine.data,
    refresh,
  };
}
