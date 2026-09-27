"use client";
import { useId } from "react";
import { usePrefersReducedMotion } from "@/lib/client/hooks";

// The ReplyIQ mark: a miniature Reply Core. A glossy orb carrying a reply arrow, a tilted orbit that
// passes behind and in front of it, and a lime "reply" travelling the orbit.
const ORBIT = "M1.5 16a14.5 5.2 0 1 0 29 0a14.5 5.2 0 1 0 -29 0";

export function LogoMark({ size = 30 }: { size?: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const id = (name: string) => `rq-${name}-${uid}`;
  const reduced = usePrefersReducedMotion();
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <defs>
        <radialGradient id={id("core")} cx="0.36" cy="0.3" r="0.78">
          <stop offset="0" stopColor="#f1eeff" />
          <stop offset="0.28" stopColor="#a99bff" />
          <stop offset="0.66" stopColor="#5a45ef" />
          <stop offset="1" stopColor="#1b1354" />
        </radialGradient>
        <linearGradient id={id("ring")} x1="1" y1="16" x2="31" y2="16" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4fe3d1" />
          <stop offset="0.55" stopColor="#9b8cff" />
          <stop offset="1" stopColor="#d4ff4f" />
        </linearGradient>
        <radialGradient id={id("halo")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.45" stopColor="#7b68ff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#7b68ff" stopOpacity="0" />
        </radialGradient>
        {/* the front half of the orbit, in the orbit's own (tilted) frame */}
        <clipPath id={id("front")}>
          <rect x="0" y="16" width="32" height="16" />
        </clipPath>
      </defs>

      <circle cx="16" cy="16" r="13" fill={`url(#${id("halo")})`} />

      <g transform="rotate(-24 16 16)">
        <path d={ORBIT} stroke={`url(#${id("ring")})`} strokeWidth="1.1" strokeOpacity="0.45" />
      </g>

      <circle cx="16" cy="16" r="8.4" fill={`url(#${id("core")})`} />
      <circle cx="16" cy="16" r="8.4" stroke="#ffffff" strokeOpacity="0.18" strokeWidth="0.6" />
      <ellipse cx="13.2" cy="12.3" rx="3.1" ry="1.7" fill="#ffffff" fillOpacity="0.38" transform="rotate(-32 13.2 12.3)" />

      {/* reply arrow */}
      <path d="M19.8 19.2v-0.9c0-2.3-1.9-4.1-4.2-4.1h-4" stroke="#ffffff" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M13.6 11.9l-2.3 2.3 2.3 2.3" stroke="#ffffff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />

      <g transform="rotate(-24 16 16)">
        <path d={ORBIT} stroke={`url(#${id("ring")})`} strokeWidth="1.4" clipPath={`url(#${id("front")})`} />
        <circle r="1.9" fill="#d4ff4f" cx={reduced ? 30.5 : 0} cy={reduced ? 16 : 0}>
          {!reduced && <animateMotion dur="4.8s" repeatCount="indefinite" path={ORBIT} />}
        </circle>
        <circle r="3.2" fill="#d4ff4f" fillOpacity="0.25" cx={reduced ? 30.5 : 0} cy={reduced ? 16 : 0}>
          {!reduced && <animateMotion dur="4.8s" repeatCount="indefinite" path={ORBIT} />}
        </circle>
      </g>
    </svg>
  );
}
