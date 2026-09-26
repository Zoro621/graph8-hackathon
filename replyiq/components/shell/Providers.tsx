"use client";
import { LazyMotion, MotionConfig, domMax } from "motion/react";
import type { ReactNode } from "react";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domMax} strict>
      <MotionConfig reducedMotion="user" transition={{ type: "spring", stiffness: 260, damping: 28 }}>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
