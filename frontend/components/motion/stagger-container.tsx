"use client";

import { motion } from "framer-motion";
import { staggerContainer, fadeUp } from "@/lib/motion";

interface StaggerContainerProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export function StaggerContainer({ children, className, delay }: StaggerContainerProps) {
  const variants = delay
    ? {
        ...staggerContainer,
        visible: {
          ...(staggerContainer.visible as Record<string, unknown>),
          transition: {
            staggerChildren: 0.06,
            delayChildren: delay,
          },
        },
      }
    : staggerContainer;

  return (
    <motion.div
      variants={variants}
      initial="hidden"
      animate="visible"
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={fadeUp} className={className}>
      {children}
    </motion.div>
  );
}
