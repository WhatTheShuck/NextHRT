"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const isApple = () => /Mac|iPhone|iPad/.test(navigator.userAgent);

/** "⌘" on Apple devices, "Ctrl" elsewhere; null during SSR so hydration matches. */
export function useModKey(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => (isApple() ? "⌘" : "Ctrl"),
    () => null,
  );
}
