"use client";

import { useQuery } from "@tanstack/react-query";
import { api, queryKeys, PipelineRun } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { LiveIndicator } from "@/components/system/live-indicator";
import { motion, AnimatePresence } from "framer-motion";

function formatTime(iso: string | null): string {
  if (!iso) return "--:--";
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function FeedRow({ run, index }: { run: PipelineRun; index: number }) {
  const isSuccess = run.status === "success";

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.3, delay: index * 0.03 }}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-mono",
        "transition-all duration-200 hover:bg-muted/50",
        isSuccess
          ? "border border-emerald-500/10 bg-emerald-500/[0.03]"
          : "border border-red-500/10 bg-red-500/[0.03]",
      )}
    >
      {/* Timestamp */}
      <span className="text-muted-foreground shrink-0 w-12 tabular-nums">
        {formatTime(run.started_at)}
      </span>

      {/* Status indicator */}
      <span className={cn(
        "shrink-0 w-1.5 h-1.5 rounded-full",
        isSuccess ? "bg-emerald-400" : "bg-red-400",
      )} />

      {/* Task name */}
      <span className="text-foreground truncate flex-1">
        {run.task_name}
      </span>

      {/* Status label */}
      <span className={cn(
        "shrink-0 text-[10px] font-semibold uppercase tracking-wider",
        isSuccess ? "text-emerald-400" : "text-red-400",
      )}>
        {run.status}
      </span>

      {/* Row count */}
      {run.rows_processed > 0 && (
        <span className="text-muted-foreground shrink-0 tabular-nums">
          {formatNumber(run.rows_processed)} rows
        </span>
      )}
    </motion.div>
  );
}

/** Ambient telemetry animation when feed is idle */
function IdleTelemetry() {
  return (
    <div className="relative h-[220px] overflow-hidden rounded-lg">
      {/* Background grid */}
      <div className="absolute inset-0 m-telemetry-bg opacity-15" />

      {/* Animated scanning line */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute left-0 right-0 h-px"
          style={{
            background: "linear-gradient(90deg, transparent, var(--primary), transparent)",
            animation: "scan-line 5s ease-in-out infinite",
            opacity: 0.2,
          }}
        />
      </div>

      {/* Center message */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
        <LiveIndicator status="healthy" size="md" />
        <div className="text-center">
          <p className="text-xs font-medium text-muted-foreground">System Idle</p>
          <p className="text-[10px] text-muted-foreground/50 mt-1">
            Monitoring pipeline activity
          </p>
        </div>
        {/* Simulated heartbeat line */}
        <div className="w-24 h-px relative overflow-hidden">
          <div
            className="absolute h-full w-8"
            style={{
              background: "linear-gradient(90deg, transparent, var(--primary), transparent)",
              animation: "flow 3s ease-in-out infinite",
              opacity: 0.4,
            }}
          />
        </div>
      </div>
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
    return <IdleTelemetry />;
  }

  return (
    <div className="space-y-1 max-h-[220px] overflow-y-auto pr-1">
      <AnimatePresence mode="popLayout">
        {runsQ.data.map((run, i) => (
          <FeedRow key={run.id} run={run} index={i} />
        ))}
      </AnimatePresence>
    </div>
  );
}
