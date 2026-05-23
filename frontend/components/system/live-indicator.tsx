"use client";

import { cn } from "@/lib/utils";

type Status = "healthy" | "delayed" | "stale" | "degraded" | "offline";
type Size = "sm" | "md" | "lg";

const STATUS_COLORS: Record<Status, string> = {
  healthy: "bg-success",
  delayed: "bg-warning",
  stale: "bg-warning",
  degraded: "bg-destructive",
  offline: "bg-muted-foreground",
};

const RING_COLORS: Record<Status, string> = {
  healthy: "bg-success/40",
  delayed: "bg-warning/40",
  stale: "bg-warning/40",
  degraded: "bg-destructive/40",
  offline: "bg-muted-foreground/40",
};

const SIZES: Record<Size, { dot: string; ring: string }> = {
  sm: { dot: "w-1.5 h-1.5", ring: "w-3 h-3" },
  md: { dot: "w-2 h-2", ring: "w-4 h-4" },
  lg: { dot: "w-3 h-3", ring: "w-6 h-6" },
};

export function LiveIndicator({
  status = "healthy",
  size = "sm",
}: {
  status?: Status;
  size?: Size;
}) {
  const isActive = status !== "offline";

  return (
    <div className="relative flex items-center justify-center" style={{ width: 16, height: 16 }}>
      {isActive && (
        <div className={cn("absolute rounded-full animate-pulse-ring", RING_COLORS[status], SIZES[size].ring)} />
      )}
      <div className={cn("relative rounded-full", STATUS_COLORS[status], SIZES[size].dot)} />
    </div>
  );
}
