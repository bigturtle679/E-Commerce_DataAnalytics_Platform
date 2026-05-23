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
import { useMemo } from "react";
import { motion } from "framer-motion";
import { fadeUp } from "@/lib/motion";
import { PageTransition } from "@/components/motion/page-transition";
import { StaggerContainer, StaggerItem } from "@/components/motion/stagger-container";
import { LiveIndicator } from "@/components/system/live-indicator";

const tooltipStyle = {
  backgroundColor: "var(--hud-bg)",
  backdropFilter: "blur(20px)",
  border: "1px solid var(--hud-border)",
  borderRadius: 12,
  fontSize: 12,
  boxShadow: "var(--hud-glow)",
};

export default function OverviewPage() {
  const healthQ = useQuery({ queryKey: queryKeys.healthStatus, queryFn: api.getHealthStatus });
  const statsQ = useQuery({ queryKey: queryKeys.pipelineStats, queryFn: api.getPipelineStats });
  const revenueQ = useQuery({ queryKey: queryKeys.analyticsRevenue, queryFn: () => api.getRevenue(12) });
  const freshnessQ = useQuery({ queryKey: queryKeys.healthFreshness, queryFn: api.getHealthFreshness });

  const totalRuns = useMemo(() =>
    statsQ.data?.reduce((sum, s) => sum + s.total_runs, 0) ?? 0, [statsQ.data]);
  const totalFailures = useMemo(() =>
    statsQ.data?.reduce((sum, s) => sum + s.failures, 0) ?? 0, [statsQ.data]);
  const totalRows = useMemo(() =>
    statsQ.data?.reduce((sum, s) => sum + s.total_rows_processed, 0) ?? 0, [statsQ.data]);
  const avgDuration = useMemo(() => {
    if (!statsQ.data?.length) return null;
    const durations = statsQ.data.filter(s => s.avg_duration_sec !== null);
    if (!durations.length) return null;
    return durations.reduce((sum, s) => sum + (s.avg_duration_sec ?? 0), 0) / durations.length;
  }, [statsQ.data]);
  const revenueChartData = useMemo(() =>
    [...(revenueQ.data ?? [])].reverse(), [revenueQ.data]);
  const healthySourcesCount = useMemo(() =>
    freshnessQ.data?.filter(f => f.hours_since_load !== null && f.hours_since_load <= 72).length ?? 0,
    [freshnessQ.data]);

  return (
    <PageTransition className="flex flex-col h-full">
      <Header title="Meridian" description="Overview & Telemetry" />

      <div className="flex-1 min-h-0 p-3 sm:p-4 lg:p-6 overflow-y-auto thin-scrollbar">
        <div className="max-w-[1600px] mx-auto space-y-3 sm:space-y-4 lg:space-y-5">

          {/* Row 1: Metric Cards */}
          <StaggerContainer className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
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

          {/* Row 2: Revenue Chart + Activity Feed */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-5"
          >
            <ChartContainer
              title="Revenue Trend"
              subtitle="Last 12 months"
              className="lg:col-span-3"
              loading={revenueQ.isLoading}
              empty={!revenueChartData.length}
              stateLabel="Live"
              stateStatus="healthy"
            >
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={revenueChartData}>
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="period"
                    tickFormatter={(v) => String(v).slice(5)}
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => formatCurrency(Number(v))}
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                    width={70}
                  />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value) => [formatCurrency(Number(value)), "Revenue"]} />
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

            <ChartContainer
              title="Pipeline Activity"
              subtitle="Live feed"
              className="lg:col-span-2"
              stateLabel="Monitoring"
              stateStatus="healthy"
            >
              <div className="h-[240px]">
                <ActivityFeed />
              </div>
            </ChartContainer>
          </motion.div>

          {/* Row 3: Pipeline Health Table */}
          <motion.div variants={fadeUp} initial="hidden" animate="visible">
            <ChartContainer
              title="Pipeline Health"
              loading={healthQ.isLoading}
              empty={!healthQ.data?.length}
              stateLabel="System Status"
              stateStatus="healthy"
            >
              <div className="overflow-x-auto thin-scrollbar max-h-[280px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs sticky top-0 bg-card/80 backdrop-blur-sm">Pipeline</TableHead>
                      <TableHead className="text-xs text-right sticky top-0 bg-card/80 backdrop-blur-sm">Last Success</TableHead>
                      <TableHead className="text-xs text-right sticky top-0 bg-card/80 backdrop-blur-sm">Failures (24h)</TableHead>
                      <TableHead className="text-xs text-right sticky top-0 bg-card/80 backdrop-blur-sm">Runs (24h)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {healthQ.data?.map((h) => (
                      <TableRow key={h.pipeline_name} className="group hover:bg-white/[0.03] transition-colors">
                        <TableCell className="text-xs font-medium py-2.5">
                          <div className="flex items-center gap-2.5">
                            <LiveIndicator
                              status={h.failures_last_24h > 0 ? "degraded" : "healthy"}
                              size="sm"
                            />
                            {h.pipeline_name}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground text-right py-2.5 font-mono">
                          {formatRelativeTime(h.last_success_at)}
                        </TableCell>
                        <TableCell className="text-right py-2.5 font-mono">
                          <span className={h.failures_last_24h > 0 ? "text-destructive text-xs font-medium" : "text-xs text-muted-foreground"}>
                            {h.failures_last_24h}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground text-right py-2.5 font-mono">
                          {h.runs_last_24h}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </ChartContainer>
          </motion.div>
        </div>
      </div>
    </PageTransition>
  );
}
