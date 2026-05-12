"use client";

import { useQuery } from "@tanstack/react-query";
import { api, queryKeys, PipelineRun } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

function formatTime(iso: string | null): string {
  if (!iso) return "--:--";
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function FeedRow({ run, index }: { run: PipelineRun; index: number }) {
  const isSuccess = run.status === "success";

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-md text-xs font-mono",
        "transition-all duration-300",
        index === 0 && "animate-feed-in",
        isSuccess
          ? "bg-success/5 border border-success/10"
          : "bg-destructive/5 border border-destructive/10"
      )}
    >
      {/* Timestamp */}
      <span className="text-muted-foreground shrink-0 w-12 tabular-nums">
        {formatTime(run.started_at)}
      </span>

      {/* Status indicator */}
      <span className={cn(
        "shrink-0 w-1.5 h-1.5 rounded-full",
        isSuccess ? "bg-success" : "bg-destructive"
      )} />

      {/* Task name */}
      <span className="text-foreground truncate flex-1">
        {run.task_name}
      </span>

      {/* Status label */}
      <span className={cn(
        "shrink-0 text-[10px] font-semibold uppercase tracking-wider",
        isSuccess ? "text-success" : "text-destructive"
      )}>
        {run.status}
      </span>

      {/* Row count */}
      {run.rows_processed > 0 && (
        <span className="text-muted-foreground shrink-0 tabular-nums">
          {formatNumber(run.rows_processed)} rows
        </span>
      )}
    </div>
  );
}

export function ActivityFeed() {
  const runsQ = useQuery({
    queryKey: queryKeys.pipelineRuns,
    queryFn: () => api.getPipelineRuns(15),
    refetchInterval: 30_000,
  });

  if (!runsQ.data?.length) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
        No pipeline activity
      </div>
    );
  }

  return (
    <div className="space-y-1 max-h-[220px] overflow-y-auto pr-1">
      {runsQ.data.map((run, i) => (
        <FeedRow key={run.id} run={run} index={i} />
      ))}
    </div>
  );
}
