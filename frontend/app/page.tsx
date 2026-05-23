"use client";

import { useQuery } from "@tanstack/react-query";
import { api, queryKeys } from "@/lib/api";
import { formatNumber, formatDuration, formatRelativeTime, formatCurrency } from "@/lib/format";
import { Header } from "@/components/header";
import { MetricCard, ChartContainer, ActivityFeed } from "@/components/dashboard";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { useMemo, lazy, Suspense } from "react";
import { motion } from "framer-motion";
import { fadeUp } from "@/lib/motion";
import { PageTransition } from "@/components/motion/page-transition";
import { StaggerContainer, StaggerItem } from "@/components/motion/stagger-container";
import { LiveIndicator } from "@/components/system/live-indicator";
import { ThroughputCounter } from "@/components/system/throughput-counter";
import { TelemetryBackground } from "@/components/system/telemetry-background";

// Lazy-load 3D scene for performance
const DataFlowScene = lazy(() =>
  import("@/components/three/data-flow-scene").then((m) => ({ default: m.DataFlowScene }))
);

export default function OverviewPage() {
  const healthQ = useQuery({ queryKey: queryKeys.healthStatus, queryFn: api.getHealthStatus });
  const statsQ = useQuery({ queryKey: queryKeys.pipelineStats, queryFn: api.getPipelineStats });
  const revenueQ = useQuery({ queryKey: queryKeys.analyticsRevenue, queryFn: () => api.getRevenue(12) });
  const qualityQ = useQuery({ queryKey: queryKeys.qualitySummary, queryFn: api.getQualitySummary });
  const freshnessQ = useQuery({ queryKey: queryKeys.healthFreshness, queryFn: api.getHealthFreshness });

  // Derived metrics
  const totalRuns = useMemo(() =>
    statsQ.data?.reduce((sum, s) => sum + s.total_runs, 0) ?? 0,
    [statsQ.data]
  );
  const totalFailures = useMemo(() =>
    statsQ.data?.reduce((sum, s) => sum + s.failures, 0) ?? 0,
    [statsQ.data]
  );
  const totalRows = useMemo(() =>
    statsQ.data?.reduce((sum, s) => sum + s.total_rows_processed, 0) ?? 0,
    [statsQ.data]
  );
  const avgDuration = useMemo(() => {
    if (!statsQ.data?.length) return null;
    const durations = statsQ.data.filter(s => s.avg_duration_sec !== null);
    if (!durations.length) return null;
    return durations.reduce((sum, s) => sum + (s.avg_duration_sec ?? 0), 0) / durations.length;
  }, [statsQ.data]);

  const revenueChartData = useMemo(() =>
    [...(revenueQ.data ?? [])].reverse(),
    [revenueQ.data]
  );

  const healthySourcesCount = useMemo(() =>
    freshnessQ.data?.filter(f => f.hours_since_load !== null && f.hours_since_load <= 72).length ?? 0,
    [freshnessQ.data]
  );

  return (
    <div className="flex flex-col min-h-[300vh]">
      <Header title="Meridian Spatial" description="Overview & Telemetry" />

      {/* Scrolling Content over the 3D scene */}
      <PageTransition className="relative z-10 flex flex-col pt-[50vh]">
        
        {/* Scrollytelling Spacer - lets the user admire the 3D scene first */}
        <div className="flex flex-col items-center justify-center pb-[20vh]">
          <motion.div
            variants={fadeUp}
            className="text-center space-y-4 max-w-lg mx-auto hud-panel p-8"
          >
            <div className="hud-grain" />
            <h2 className="text-3xl font-light tracking-wide text-foreground relative z-10">
              Pipeline Topology
            </h2>
            <p className="text-sm text-muted-foreground font-mono relative z-10">
              {totalRuns} Executions • {formatNumber(totalRows)} Rows Processed
            </p>
            <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-primary/50 to-transparent relative z-10 mt-6" />
          </motion.div>
        </div>

        <div className="px-4 sm:px-8 lg:px-12 space-y-32 pb-[30vh]">
          
          {/* Station 1: Core Metrics */}
          <section className="w-full max-w-6xl mx-auto">
            <h3 className="text-sm font-semibold tracking-widest uppercase text-muted-foreground mb-6 ml-2">System Metrics</h3>
            <StaggerContainer className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <StaggerItem>
                <MetricCard
                  title="Pipeline Runs"
                  value={formatNumber(totalRuns)}
                  subtitle={`${totalFailures} failures`}
                  trend={totalFailures > 0 ? "down" : "neutral"}
                />
              </StaggerItem>
              <StaggerItem>
                <MetricCard
                  title="Rows Processed"
                  value={formatNumber(totalRows)}
                />
              </StaggerItem>
              <StaggerItem>
                <MetricCard
                  title="Avg Duration"
                  value={formatDuration(avgDuration)}
                  subtitle="per task"
                />
              </StaggerItem>
              <StaggerItem>
                <MetricCard
                  title="Source Health"
                  value={`${healthySourcesCount}/${freshnessQ.data?.length ?? 0}`}
                  subtitle="sources fresh"
                  trend={healthySourcesCount === (freshnessQ.data?.length ?? 0) ? "up" : "down"}
                />
              </StaggerItem>
            </StaggerContainer>
          </section>

          {/* Station 2: Analytics & Live Feed */}
          <section className="w-full max-w-7xl mx-auto">
            <h3 className="text-sm font-semibold tracking-widest uppercase text-muted-foreground mb-6 ml-2">Telemetry Stream</h3>
            <motion.div variants={fadeUp} className="grid grid-cols-1 gap-8 lg:grid-cols-5">
              {/* Revenue trend */}
              <ChartContainer
                title="Revenue Trend"
                subtitle="Last 12 months"
                className="lg:col-span-3"
                loading={revenueQ.isLoading}
                empty={!revenueChartData.length}
                stateLabel="Live"
                stateStatus="healthy"
              >
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={revenueChartData}>
                    <defs>
                      <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="period"
                      tickFormatter={(v) => String(v).slice(5)}
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={(v) => formatCurrency(Number(v))}
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      axisLine={false}
                      tickLine={false}
                      width={70}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--hud-bg)",
                        backdropFilter: "blur(20px)",
                        border: "1px solid var(--hud-border)",
                        borderRadius: 12,
                        fontSize: 12,
                        boxShadow: "var(--hud-glow)",
                      }}
                      formatter={(value) => [formatCurrency(Number(value)), "Revenue"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="total_revenue"
                      stroke="var(--primary)"
                      strokeWidth={2}
                      fill="url(#revenueGrad)"
                      animationDuration={1200}
                      animationEasing="ease-out"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartContainer>

              {/* Pipeline activity feed */}
              <ChartContainer
                title="Pipeline Activity"
                subtitle="Live feed"
                className="lg:col-span-2"
                stateLabel="Monitoring"
                stateStatus="healthy"
              >
                <div className="h-[260px]">
                  <ActivityFeed />
                </div>
              </ChartContainer>
            </motion.div>
          </section>

          {/* Station 3: Node Health */}
          <section className="w-full max-w-5xl mx-auto">
            <h3 className="text-sm font-semibold tracking-widest uppercase text-muted-foreground mb-6 ml-2">Node Status</h3>
            <motion.div variants={fadeUp}>
              <ChartContainer
                title="Pipeline Health"
                loading={healthQ.isLoading}
                empty={!healthQ.data?.length}
                stateLabel="System Status"
                stateStatus="healthy"
              >
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10">
                        <TableHead className="text-xs">Pipeline</TableHead>
                        <TableHead className="text-xs text-right">Last Success</TableHead>
                        <TableHead className="text-xs text-right">Failures (24h)</TableHead>
                        <TableHead className="text-xs text-right">Runs (24h)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {healthQ.data?.map((h) => (
                        <TableRow key={h.pipeline_name} className="group border-white/10 hover:bg-white/5 transition-colors">
                          <TableCell className="text-xs font-medium py-3">
                            <div className="flex items-center gap-3">
                              <LiveIndicator
                                status={h.failures_last_24h > 0 ? "degraded" : "healthy"}
                                size="sm"
                              />
                              {h.pipeline_name}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground text-right py-3 font-mono">
                            {formatRelativeTime(h.last_success_at)}
                          </TableCell>
                          <TableCell className="text-right py-3 font-mono">
                            <span className={h.failures_last_24h > 0 ? "text-primary text-xs font-medium" : "text-xs text-muted-foreground"}>
                              {h.failures_last_24h}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground text-right py-3 font-mono">
                            {h.runs_last_24h}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </ChartContainer>
            </motion.div>
          </section>
        </div>
      </PageTransition>
    </div>
  );
}
