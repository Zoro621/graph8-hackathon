"use client";
import { useSyncExternalStore } from "react";

const noop = () => () => {};
/** True after hydration; avoids reading browser-only state during SSR. */
export const useHydrated = () => useSyncExternalStore(noop, () => true, () => false);

export function useMediaQuery(query: string, serverValue = false) {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

export const usePrefersReducedMotion = () => useMediaQuery("(prefers-reduced-motion: reduce)");

/** A clock that ticks every `ms` while `active`. */
export function useNow(active: boolean, ms = 1000) {
  return useSyncExternalStore(
    (cb) => {
      if (!active) return () => {};
      const id = setInterval(cb, ms);
      return () => clearInterval(id);
    },
    () => (active ? Math.floor(Date.now() / ms) * ms : 0),
    () => 0,
  );
}
