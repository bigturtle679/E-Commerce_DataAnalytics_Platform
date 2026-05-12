"use client";

import { useQuery } from "@tanstack/react-query";
import { api, queryKeys } from "@/lib/api";
import { formatNumber, formatDuration, formatRelativeTime, formatCurrency } from "@/lib/format";
import { Header } from "@/components/header";
import { MetricCard, StatusBadge, ChartContainer, ActivityFeed } from "@/components/dashboard";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { useMemo } from "react";

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
    <div className="flex flex-col">
      <Header title="Overview" description="System health and pipeline summary" />

      <div className="flex-1 space-y-6 p-6">
        {/* Metric cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Pipeline Runs"
            value={formatNumber(totalRuns)}
            subtitle={`${totalFailures} failures`}
            trend={totalFailures > 0 ? "down" : "neutral"}
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            }
          />
          <MetricCard
            title="Rows Processed"
            value={formatNumber(totalRows)}
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
              </svg>
            }
          />
          <MetricCard
            title="Avg Duration"
            value={formatDuration(avgDuration)}
            subtitle="per task"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            }
          />
          <MetricCard
            title="Source Health"
            value={`${healthySourcesCount}/${freshnessQ.data?.length ?? 0}`}
            subtitle="sources fresh"
            trend={healthySourcesCount === (freshnessQ.data?.length ?? 0) ? "up" : "down"}
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            }
          />
        </div>

        {/* Charts + Activity Feed */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* Revenue trend */}
          <ChartContainer
            title="Revenue Trend"
            subtitle="Last 12 months"
            className="lg:col-span-3"
            loading={revenueQ.isLoading}
            empty={!revenueChartData.length}
          >
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={revenueChartData}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
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
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value) => [formatCurrency(Number(value)), "Revenue"]}
                />
                <Area
                  type="monotone"
                  dataKey="total_revenue"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  fill="url(#revenueGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartContainer>

          {/* Pipeline activity feed */}
          <ChartContainer
            title="Pipeline Activity"
            subtitle="Live feed"
            className="lg:col-span-2"
          >
            <ActivityFeed />
          </ChartContainer>
        </div>

        {/* Pipeline health by source */}
        <ChartContainer
          title="Pipeline Health"
          loading={healthQ.isLoading}
          empty={!healthQ.data?.length}
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Pipeline</TableHead>
                  <TableHead className="text-xs text-right">Last Success</TableHead>
                  <TableHead className="text-xs text-right">Failures (24h)</TableHead>
                  <TableHead className="text-xs text-right">Runs (24h)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {healthQ.data?.map((h) => (
                  <TableRow key={h.pipeline_name}>
                    <TableCell className="text-xs font-medium py-2">{h.pipeline_name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground text-right py-2">
                      {formatRelativeTime(h.last_success_at)}
                    </TableCell>
                    <TableCell className="text-right py-2">
                      <span className={h.failures_last_24h > 0 ? "text-destructive text-xs font-medium" : "text-xs text-muted-foreground"}>
                        {h.failures_last_24h}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground text-right py-2">
                      {h.runs_last_24h}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </ChartContainer>
      </div>
    </div>
  );
}
