/**
 * Meridian Motion System
 * Framer Motion variants, spring configs, and animation primitives.
 */

import type { Variants, Transition } from "framer-motion";

/* ═══════════════════════════════════════════════
   Spring Physics — reusable transition configs
   ═══════════════════════════════════════════════ */

export const springs = {
  gentle: { type: "spring", stiffness: 120, damping: 20, mass: 1 } as Transition,
  snappy: { type: "spring", stiffness: 300, damping: 30, mass: 0.8 } as Transition,
  bouncy: { type: "spring", stiffness: 400, damping: 25, mass: 0.5 } as Transition,
  smooth: { type: "spring", stiffness: 100, damping: 25, mass: 1.2 } as Transition,
};

/* ═══════════════════════════════════════════════
   Variant Presets
   ═══════════════════════════════════════════════ */

/** Fade up from below — standard card/section entrance */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
  },
};

/** Fade in — simple opacity transition */
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.4, ease: "easeOut" },
  },
};

/** Scale in — used for badges, indicators */
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.85 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
  },
};

/** Slide in from left — sidebar items */
export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -12 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
  },
};

/* ═══════════════════════════════════════════════
   Container Variants — stagger children
   ═══════════════════════════════════════════════ */

/** Stagger container — delays children sequentially */
export const staggerContainer: Variants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.1,
    },
  },
};

/** Stagger with longer delay — for page sections */
export const staggerSections: Variants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.15,
    },
  },
};

/* ═══════════════════════════════════════════════
   Hover / Tap Interactions
   ═══════════════════════════════════════════════ */

/** Card hover — subtle lift + glow */
export const cardHover = {
  rest: {
    scale: 1,
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" },
  },
  hover: {
    scale: 1.01,
    y: -2,
    transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] },
  },
};

/** Button tap — subtle press */
export const tapScale = {
  tap: { scale: 0.97 },
};

/* ═══════════════════════════════════════════════
   Page Transition
   ═══════════════════════════════════════════════ */

export const pageTransition: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.16, 1, 0.3, 1],
      staggerChildren: 0.08,
    },
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: { duration: 0.2, ease: "easeIn" },
  },
};
