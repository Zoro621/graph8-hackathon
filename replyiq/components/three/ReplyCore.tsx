"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { SceneProps } from "./ReplyCoreScene";
import { usePrefersReducedMotion } from "@/lib/client/hooks";

export type { Orb, ClusterMark, OrbState } from "./ReplyCoreScene";

// three.js stays out of the server bundle and out of first paint.
const Scene = dynamic(() => import("./ReplyCoreScene"), {
  ssr: false,
  loading: () => <CoreFallback />,
});

function CoreFallback() {
  return (
    <div className="absolute inset-0 grid place-items-center" aria-hidden>
      <div className="size-56 animate-pulse rounded-full bg-[radial-gradient(circle,rgba(155,140,255,0.35),rgba(79,227,209,0.08)_55%,transparent_70%)] blur-xl" />
    </div>
  );
}

const noop = () => () => {};
function detectQuality(): "high" | "low" {
  const cores = navigator.hardwareConcurrency ?? 8;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  const small = window.innerWidth < 640;
  return cores <= 4 || mem <= 4 || small ? "low" : "high";
}

/** Renders only while on screen and the tab is visible; renders a single frame under reduced motion. */
export default function ReplyCore(props: Omit<SceneProps, "quality"> & { className?: string; label: string }) {
  const { className, label, ...scene } = props;
  const ref = useRef<HTMLDivElement>(null);
  const [onScreen, setOnScreen] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);
  const quality = useSyncExternalStore(noop, detectQuality, () => "high" as const);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { rootMargin: "100px" });
    io.observe(el);
    const onVis = () => setTabVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const frameloop = reduced ? "demand" : onScreen && tabVisible ? "always" : "never";
  return (
    <div ref={ref} className={className} role="img" aria-label={label}>
      <Scene {...scene} quality={quality} frameloop={frameloop} />
    </div>
  );
}
