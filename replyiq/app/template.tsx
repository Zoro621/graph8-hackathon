"use client";
import { m } from "motion/react";

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <m.div
      className="flex flex-1 flex-col"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </m.div>
  );
}
