"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAnimatedValue } from "@/lib/use-animated-value";
import { fadeUp } from "@/lib/motion";
import { useRef, useState } from "react";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  className?: string;
  accentColor?: string;
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  className,
  accentColor,
}: MetricCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  // Parse numeric value for animation
  const numericValue = typeof value === "number" ? value : null;
  const animatedNum = useAnimatedValue(numericValue ?? 0, 900);
  const displayValue =
    numericValue !== null ? formatAnimated(animatedNum) : value;

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: y * -8, y: x * 8 });
  }

  function handleMouseLeave() {
    setTilt({ x: 0, y: 0 });
    setIsHovered(false);
  }

  const trendColor = trend === "up" ? "var(--success)" : trend === "down" ? "var(--destructive)" : undefined;
  const accentLine = accentColor || (trend === "up" ? "var(--success)" : trend === "down" ? "var(--destructive)" : "var(--primary)");

  return (
    <motion.div
      ref={cardRef}
      variants={fadeUp}
      className={cn(
        "group relative overflow-hidden rounded-xl m-panel cursor-default",
        className,
      )}
      style={{
        transform: `perspective(800px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
        transition: isHovered ? "transform 0.1s ease-out" : "transform 0.4s ease-out, box-shadow 0.3s ease",
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
    >
      {/* Accent line at top */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{
          background: `linear-gradient(90deg, transparent, ${accentLine}, transparent)`,
          opacity: isHovered ? 0.8 : 0.3,
          transition: "opacity 0.3s ease",
        }}
      />

      {/* Glow effect on hover */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-500"
        style={{
          background: `radial-gradient(300px circle at ${tilt.y * 10 + 50}% ${tilt.x * -10 + 50}%, ${accentLine}08, transparent)`,
          opacity: isHovered ? 1 : 0,
        }}
      />

      <div className="relative p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              {title}
            </p>
            <p className="text-2xl font-bold tracking-tight tabular-nums">
              {displayValue}
            </p>
            {subtitle && (
              <p
                className={cn(
                  "text-xs font-medium",
                  trend === "up" && "text-emerald-400",
                  trend === "down" && "text-red-400",
                  !trend && "text-muted-foreground",
                )}
              >
                {trend === "up" && "↑ "}
                {trend === "down" && "↓ "}
                {subtitle}
              </p>
            )}
          </div>
          {icon && (
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors duration-300"
              style={{
                background: isHovered ? `${accentLine}18` : "var(--m-surface-2)",
                color: isHovered ? accentLine : "var(--muted-foreground)",
              }}
            >
              {icon}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function formatAnimated(n: number): string {
  const rounded = Math.round(n);
  if (rounded >= 1_000_000) return `${(rounded / 1_000_000).toFixed(1)}M`;
  if (rounded >= 1_000) return `${(rounded / 1_000).toFixed(1)}K`;
  return rounded.toLocaleString();
}
