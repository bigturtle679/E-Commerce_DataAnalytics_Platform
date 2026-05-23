"use client";

import { useFormattedAnimatedValue } from "@/lib/use-animated-value";
import { cn } from "@/lib/utils";

interface ThroughputCounterProps {
  value: number;
  label?: string;
  className?: string;
}

export function ThroughputCounter({
  value,
  label = "rows processed",
  className,
}: ThroughputCounterProps) {
  const formatted = useFormattedAnimatedValue(value, 1200);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="font-mono text-sm font-semibold tracking-tight tabular-nums">
        {formatted}
      </span>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
    </div>
  );
}
