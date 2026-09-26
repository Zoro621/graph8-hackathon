"use client";
import {
  animate,
  m,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type HTMLMotionProps,
} from "motion/react";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";

/* ------------------------------- spotlight ------------------------------- */

export function useSpotlight<T extends HTMLElement>() {
  return useCallback((e: PointerEvent<T>) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  }, []);
}

/** Glass card with a cursor-following spotlight + edge light, and optional 3D tilt. */
export function SpotCard({
  children,
  className = "",
  color = "155,140,255",
  tilt = false,
  style,
  ...rest
}: { children: ReactNode; className?: string; color?: string; tilt?: boolean } & HTMLMotionProps<"div">) {
  const onMove = useSpotlight<HTMLDivElement>();
  const reduce = useReducedMotion();
  const rx = useSpring(0, { stiffness: 180, damping: 18 });
  const ry = useSpring(0, { stiffness: 180, damping: 18 });
  const enableTilt = tilt && !reduce;
  return (
    <m.div
      {...rest}
      onPointerMove={(e) => {
        onMove(e);
        if (!enableTilt) return;
        const r = e.currentTarget.getBoundingClientRect();
        ry.set(((e.clientX - r.left) / r.width - 0.5) * 9);
        rx.set(-((e.clientY - r.top) / r.height - 0.5) * 9);
      }}
      onPointerLeave={() => {
        rx.set(0);
        ry.set(0);
      }}
      style={
        {
          ...(style as object),
          rotateX: enableTilt ? rx : 0,
          rotateY: enableTilt ? ry : 0,
          transformPerspective: 900,
          "--spot": `rgba(${color},0.13)`,
          "--spot-edge": `rgba(${color},0.7)`,
        } as never
      }
      className={`spotlight surface rounded-2xl ${className}`}
    >
      {children}
    </m.div>
  );
}

/* -------------------------------- magnetic -------------------------------- */

export function Magnetic({ children, strength = 0.28, className = "" }: { children: ReactNode; strength?: number; className?: string }) {
  const x = useSpring(0, { stiffness: 220, damping: 15, mass: 0.4 });
  const y = useSpring(0, { stiffness: 220, damping: 15, mass: 0.4 });
  const reduce = useReducedMotion();
  return (
    <m.div
      className={`inline-block ${className}`}
      style={{ x, y }}
      onPointerMove={(e) => {
        if (reduce) return;
        const r = e.currentTarget.getBoundingClientRect();
        x.set((e.clientX - (r.left + r.width / 2)) * strength);
        y.set((e.clientY - (r.top + r.height / 2)) * strength);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </m.div>
  );
}

type BtnVariant = "primary" | "ghost" | "iris" | "danger";
const btnStyles: Record<BtnVariant, string> = {
  primary:
    "bg-lime text-ink shadow-[0_0_0_1px_rgba(212,255,79,0.4),0_10px_40px_-8px_rgba(212,255,79,0.55)] hover:shadow-[0_0_0_1px_rgba(212,255,79,0.7),0_14px_50px_-6px_rgba(212,255,79,0.75)]",
  iris: "bg-iris-deep text-white shadow-[0_0_0_1px_rgba(155,140,255,0.5),0_10px_40px_-8px_rgba(109,92,255,0.7)]",
  ghost: "bg-white/[0.04] text-text border border-line hover:border-line-2 hover:bg-white/[0.07]",
  danger: "bg-rose/15 text-rose border border-rose/30",
};

export function Button({
  children,
  variant = "ghost",
  className = "",
  magnetic = false,
  ...rest
}: { children: ReactNode; variant?: BtnVariant; magnetic?: boolean } & HTMLMotionProps<"button">) {
  const btn = (
    <m.button
      whileTap={{ scale: 0.96 }}
      {...rest}
      className={`relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full px-5 py-2.5 text-sm font-medium transition-[box-shadow,background-color,border-color] duration-300 disabled:cursor-not-allowed disabled:opacity-40 ${btnStyles[variant]} ${className}`}
    >
      {children}
    </m.button>
  );
  return magnetic ? <Magnetic className={/\bw-full\b/.test(className) ? "w-full" : ""}>{btn}</Magnetic> : btn;
}

/* ----------------------------- animated number ----------------------------- */

export function Counter({ value, className = "", decimals = 0, suffix = "" }: { value: number; className?: string; decimals?: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const prev = useRef(0);
  useEffect(() => {
    if (!inView || !ref.current) return;
    const ctrl = animate(prev.current, value, {
      duration: 1.1,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        if (ref.current) ref.current.textContent = v.toFixed(decimals) + suffix;
      },
    });
    prev.current = value;
    return () => ctrl.stop();
  }, [value, inView, decimals, suffix]);
  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {(0).toFixed(decimals)}
      {suffix}
    </span>
  );
}

/* ------------------------------ decoding text ------------------------------ */

const GLYPHS = "▚▞▖▗▘▝░▒#%&*+<>/\\=01";
export function Decode({ text, className = "", speed = 22 }: { text: string; className?: string; speed?: number }) {
  const [out, setOut] = useState(text);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) return;
    let frame = 0;
    const total = text.length;
    const id = setInterval(() => {
      frame += 1;
      const revealed = Math.floor(frame * 1.6);
      setOut(
        text
          .split("")
          .map((ch, i) => (i < revealed || ch === " " ? ch : GLYPHS[(i * 7 + frame) % GLYPHS.length]))
          .join(""),
      );
      if (revealed >= total) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed, reduce]);
  return <span className={className}>{reduce ? text : out}</span>;
}

/* ------------------------------- hold button ------------------------------- */

/** Press and hold to confirm. Keyboard: hold Space/Enter. */
export function HoldButton({
  onConfirm,
  children,
  duration = 1400,
  disabled,
  className = "",
}: {
  onConfirm: () => void;
  children: ReactNode;
  duration?: number;
  disabled?: boolean;
  className?: string;
}) {
  const p = useMotionValue(0);
  const width = useTransform(p, (v) => `${v * 100}%`);
  const ctrl = useRef<ReturnType<typeof animate> | null>(null);
  const [done, setDone] = useState(false);
  const start = () => {
    if (disabled || done) return;
    ctrl.current?.stop();
    ctrl.current = animate(p, 1, {
      duration: ((1 - p.get()) * duration) / 1000,
      ease: "linear",
      onComplete: () => {
        setDone(true);
        onConfirm();
      },
    });
  };
  const cancel = () => {
    if (done) return;
    ctrl.current?.stop();
    ctrl.current = animate(p, 0, { duration: 0.35, ease: "easeOut" });
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onKeyDown={(e) => {
        if ((e.key === " " || e.key === "Enter") && !e.repeat) {
          e.preventDefault();
          start();
        }
      }}
      onKeyUp={(e) => (e.key === " " || e.key === "Enter") && cancel()}
      className={`relative select-none overflow-hidden rounded-full border border-lime/40 bg-lime/10 px-6 py-3 text-sm font-semibold text-lime transition-colors hover:bg-lime/15 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      <m.span className="absolute inset-y-0 left-0 bg-lime" style={{ width }} aria-hidden />
      <m.span
        className="relative z-10 mix-blend-difference"
        style={{ color: "#d4ff4f" } as CSSProperties}
      >
        {children}
      </m.span>
    </button>
  );
}

/* ---------------------------------- bits ---------------------------------- */

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-md border border-line-2 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-muted">{children}</kbd>
  );
}

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-muted ${className}`}>
      <span className="h-px w-6 bg-gradient-to-r from-iris to-transparent" />
      {children}
    </div>
  );
}

export function Dot({ color, pulse = false }: { color: string; pulse?: boolean }) {
  return (
    <span className="relative inline-flex size-2">
      {pulse && <span className="absolute inset-0 animate-ping rounded-full opacity-60" style={{ background: color }} />}
      <span className="relative inline-flex size-2 rounded-full" style={{ background: color, boxShadow: `0 0 12px ${color}` }} />
    </span>
  );
}

export function Chip({ children, color, className = "" }: { children: ReactNode; color?: string; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${className}`}
      style={
        color
          ? { borderColor: `${color}40`, background: `${color}14`, color }
          : { borderColor: "var(--line-2)", background: "rgba(255,255,255,0.04)", color: "var(--muted)" }
      }
    >
      {children}
    </span>
  );
}
