"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface GaugeRingProps {
  value: number; // 0-100
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
  className?: string;
}

export function GaugeRing({
  value,
  size = 120,
  strokeWidth = 6,
  label,
  sublabel,
  className,
}: GaugeRingProps) {
  const [animatedValue, setAnimatedValue] = useState(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (animatedValue / 100) * circumference;

  useEffect(() => {
    const timeout = setTimeout(() => setAnimatedValue(value), 100);
    return () => clearTimeout(timeout);
  }, [value]);

  const getColor = (v: number) => {
    if (v >= 95) return "oklch(0.65 0.2 150)"; // green
    if (v >= 80) return "oklch(0.65 0.22 260)"; // blue
    if (v >= 60) return "oklch(0.75 0.18 80)"; // amber
    return "oklch(0.65 0.22 25)"; // red
  };

  const color = getColor(value);

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
        >
          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--m-border-subtle)"
            strokeWidth={strokeWidth}
          />
          {/* Value arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{
              transition: "stroke-dashoffset 1s cubic-bezier(0.16, 1, 0.3, 1)",
              filter: `drop-shadow(0 0 6px ${color})`,
            }}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-lg font-bold tabular-nums tracking-tight"
            style={{ color }}
          >
            {Math.round(animatedValue)}%
          </span>
        </div>
      </div>
      {label && (
        <span className="text-xs font-medium text-foreground">{label}</span>
      )}
      {sublabel && (
        <span className="text-[10px] text-muted-foreground">{sublabel}</span>
      )}
    </div>
  );
}
