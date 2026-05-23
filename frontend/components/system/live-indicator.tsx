"use client";

import { cn } from "@/lib/utils";

interface LiveIndicatorProps {
  status?: "healthy" | "delayed" | "stale" | "degraded" | "offline";
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

const STATUS_COLORS: Record<string, { dot: string; ring: string; label: string }> = {
  healthy: {
    dot: "bg-emerald-400",
    ring: "bg-emerald-400/30",
    label: "Operational",
  },
  delayed: {
    dot: "bg-amber-400",
    ring: "bg-amber-400/30",
    label: "Delayed",
  },
  stale: {
    dot: "bg-orange-400",
    ring: "bg-orange-400/30",
    label: "Stale",
  },
  degraded: {
    dot: "bg-red-400",
    ring: "bg-red-400/30",
    label: "Degraded",
  },
  offline: {
    dot: "bg-zinc-500",
    ring: "bg-zinc-500/30",
    label: "Offline",
  },
};

const SIZES = {
  sm: { dot: "w-1.5 h-1.5", ring: "w-3 h-3" },
  md: { dot: "w-2 h-2", ring: "w-4 h-4" },
  lg: { dot: "w-2.5 h-2.5", ring: "w-5 h-5" },
};

export function LiveIndicator({
  status = "healthy",
  size = "sm",
  showLabel = false,
  className,
}: LiveIndicatorProps) {
  const colors = STATUS_COLORS[status] ?? STATUS_COLORS.offline;
  const dims = SIZES[size];

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="relative flex items-center justify-center">
        {/* Animated pulse ring */}
        {status === "healthy" && (
          <span
            className={cn(
              "absolute rounded-full animate-pulse-glow",
              dims.ring,
              colors.ring,
            )}
          />
        )}
        {/* Solid dot */}
        <span
          className={cn("relative rounded-full", dims.dot, colors.dot)}
        />
      </span>
      {showLabel && (
        <span className="text-[11px] font-medium text-muted-foreground">
          {colors.label}
        </span>
      )}
    </span>
  );
}
