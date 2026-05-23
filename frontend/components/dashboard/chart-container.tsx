"use client";

import { cn } from "@/lib/utils";
import { LiveIndicator } from "@/components/system/live-indicator";

interface ChartContainerProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  loading?: boolean;
  empty?: boolean;
  stateLabel?: string;
  stateStatus?: "healthy" | "delayed" | "stale" | "degraded" | "offline";
}

export function ChartContainer({
  title,
  subtitle,
  children,
  className,
  loading,
  empty,
  stateLabel,
  stateStatus,
}: ChartContainerProps) {
  return (
    <div className={cn("relative overflow-hidden hud-panel hud-panel-interactive h-full", className)}>
      <div className="hud-grain" />

      <div
        className="absolute top-0 left-4 right-4 h-px opacity-25"
        style={{ background: "linear-gradient(90deg, transparent, var(--primary), transparent)" }}
      />

      {title && (
        <div className="flex items-center justify-between px-4 sm:px-5 pt-4 sm:pt-5 pb-2">
          <div className="flex items-baseline gap-2.5 min-w-0">
            <h3 className="text-sm font-semibold tracking-tight truncate">{title}</h3>
            {subtitle && (
              <span className="text-[11px] text-muted-foreground shrink-0">{subtitle}</span>
            )}
          </div>
          {(stateLabel || stateStatus) && (
            <div className="flex items-center gap-2 shrink-0">
              <LiveIndicator status={stateStatus ?? "healthy"} size="sm" />
              {stateLabel && (
                <span className="text-[10px] font-medium text-muted-foreground">
                  {stateLabel}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      <div className="px-4 sm:px-5 pb-4 sm:pb-5">
        {loading ? <ChartSkeleton /> : empty ? <ChartPlaceholder /> : children}
      </div>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="relative h-[200px] w-full overflow-hidden rounded-md">
      <div className="absolute left-8 top-4 bottom-8 w-px bg-muted-foreground/10" />
      <div className="absolute left-8 right-4 bottom-8 h-px bg-muted-foreground/10" />
      <div className="absolute left-12 right-4 bottom-10 flex items-end gap-2 h-[140px]">
        {[65, 45, 80, 55, 70, 40, 90, 60, 50, 75, 85, 65].map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t animate-shimmer"
            style={{ height: `${h}%`, animationDelay: `${i * 0.1}s`, opacity: 0.4 }}
          />
        ))}
      </div>
    </div>
  );
}

function ChartPlaceholder() {
  return (
    <div className="relative h-[200px] w-full overflow-hidden rounded-md">
      <div className="absolute inset-0 m-telemetry-bg opacity-15" />
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute left-0 right-0 h-px"
          style={{
            background: "linear-gradient(90deg, transparent, var(--primary), transparent)",
            animation: "scan-line 5s ease-in-out infinite",
            opacity: 0.3,
          }}
        />
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <div className="flex items-center gap-2">
          <LiveIndicator status="delayed" size="sm" />
          <span className="text-xs text-muted-foreground font-medium">Awaiting telemetry</span>
        </div>
        <span className="text-[10px] text-muted-foreground/60">
          Data will appear when the pipeline runs
        </span>
      </div>
    </div>
  );
}
