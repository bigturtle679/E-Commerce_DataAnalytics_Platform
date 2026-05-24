"use client";

import { useQuery } from "@tanstack/react-query";
import { api, queryKeys } from "@/lib/api";
import { formatNumber, formatDuration, formatRelativeTime, formatDateTime } from "@/lib/format";
import { Header } from "@/components/header";
import { MetricCard, StatusBadge, ChartContainer } from "@/components/dashboard";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { fadeUp } from "@/lib/motion";
import { PageTransition } from "@/components/motion/page-transition";
import { StaggerContainer, StaggerItem } from "@/components/motion/stagger-container";
import { GaugeRing } from "@/components/charts/gauge-ring";
import { ThroughputCounter } from "@/components/system/throughput-counter";
import { ErrorBanner } from "@/components/system/error-banner";

export default function PipelinePage() {
  const runsQ = useQuery({ queryKey: queryKeys.pipelineRuns, queryFn: () => api.getPipelineRuns(100) });
  const statsQ = useQuery({ queryKey: queryKeys.pipelineStats, queryFn: api.getPipelineStats });
  const timelineQ = useQuery({ queryKey: queryKeys.pipelineTimeline, queryFn: () => api.getPipelineTimeline(7) });

  const successRate = useMemo(() => {
    if (!statsQ.data?.length) return 0;
    const total = statsQ.data.reduce((s, t) => s + t.total_runs, 0);
    const successes = statsQ.data.reduce((s, t) => s + t.successes, 0);
    return total > 0 ? Math.round((successes / total) * 100) : 0;
  }, [statsQ.data]);

  const totalFailures = useMemo(() =>
    statsQ.data?.reduce((s, t) => s + t.failures, 0) ?? 0,
    [statsQ.data]
  );

  const totalRowsProcessed = useMemo(() =>
    statsQ.data?.reduce((s, t) => s + t.total_rows_processed, 0) ?? 0,
    [statsQ.data]
  );

  const durationChartData = useMemo(() =>
    statsQ.data?.map(s => ({
      name: s.task_name.replace(/_/g, " "),
      avg: s.avg_duration_sec ?? 0,
      max: s.max_duration_sec ?? 0,
    })) ?? [],
    [statsQ.data]
  );

  const throughputData = useMemo(() =>
    [...(timelineQ.data ?? [])].reverse().slice(-24),
    [timelineQ.data]
  );

  const hasAnyError = runsQ.isError || statsQ.isError || timelineQ.isError;

  return (
    <PageTransition>
      <div className="flex flex-col min-h-[200vh] pt-[30vh]">
        <Header title="Pipeline Topology" description="Execution metrics and DAG runs" />

        <div className="flex-1 space-y-24 px-4 sm:px-8 lg:px-12 pb-[20vh] max-w-7xl mx-auto w-full">
          {/* Error banner */}
          {hasAnyError && (
            <ErrorBanner
              isError={hasAnyError}
              failureCount={Math.max(runsQ.failureCount, statsQ.failureCount, timelineQ.failureCount)}
              isFetching={runsQ.isFetching || statsQ.isFetching || timelineQ.isFetching}
            />
          )}
          {/* Animated throughput counter */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="flex justify-center mb-12"
          >
            <ThroughputCounter
              value={totalRowsProcessed}
              label="total rows processed"
              className="scale-125"
            />
          </motion.div>

          {/* Summary metrics with GaugeRing */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
            {/* Gauge Ring panel */}
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className="hud-panel flex flex-col items-center justify-center rounded-xl p-6 relative overflow-hidden"
            >
              <div className="hud-grain" />
              <GaugeRing
                value={successRate}
                size={140}
                strokeWidth={6}
                label="Success Rate"
                sublabel="across all tasks"
                className="relative z-10"
              />
            </motion.div>

            {/* Remaining 3 metric cards */}
            <StaggerContainer className="col-span-1 grid grid-cols-1 gap-4 sm:grid-cols-3 lg:col-span-3">
              <StaggerItem>
                <MetricCard
                  title="Total Failures"
                  value={totalFailures}
                  trend={totalFailures === 0 ? "up" : "down"}
                  subtitle="across all tasks"
                />
              </StaggerItem>
              <StaggerItem>
                <MetricCard
                  title="Active Tasks"
                  value={statsQ.data?.length ?? 0}
                  subtitle="monitored"
                />
              </StaggerItem>
              <StaggerItem>
                <MetricCard
                  title="Rows Processed"
                  value={formatNumber(totalRowsProcessed)}
                  subtitle="total"
                />
              </StaggerItem>
            </StaggerContainer>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            {/* Task Duration — horizontal BarChart */}
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="visible"
            >
              <ChartContainer
                title="Task Duration"
                subtitle="Avg vs Max (seconds)"
                loading={statsQ.isLoading}
                empty={!durationChartData.length}
                error={statsQ.isError}
                errorMessage="Task data unavailable"
                stateLabel={durationChartData.length ? "Live" : undefined}
                stateStatus={statsQ.isError ? "offline" : durationChartData.length ? "healthy" : undefined}
              >
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={durationChartData} layout="vertical" barCategoryGap="20%">
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                      axisLine={false}
                      tickLine={false}
                      width={100}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      formatter={(value) => [`${Number(value).toFixed(2)}s`]}
                    />
                    <Bar dataKey="avg" fill="var(--chart-1)" radius={[0, 3, 3, 0]} name="Avg" />
                    <Bar dataKey="max" fill="var(--chart-5)" radius={[0, 3, 3, 0]} name="Max" opacity={0.5} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </motion.div>

            {/* Throughput Timeline — AreaChart with gradient fill */}
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="visible"
            >
              <ChartContainer
                title="Throughput Timeline"
                subtitle="Rows/hour (last 24h)"
                loading={timelineQ.isLoading}
                empty={!throughputData.length}
                error={timelineQ.isError}
                errorMessage="Timeline data unavailable"
                stateLabel={throughputData.length ? "Live" : undefined}
                stateStatus={timelineQ.isError ? "offline" : throughputData.length ? "healthy" : undefined}
              >
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={throughputData}>
                    <defs>
                      <linearGradient id="throughputGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="hour"
                      tickFormatter={(v) => new Date(String(v)).toLocaleTimeString("en-US", { hour: "2-digit" })}
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={formatNumber}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      formatter={(value) => [formatNumber(Number(value)), "Rows"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="rows_processed"
                      stroke="var(--chart-2)"
                      strokeWidth={2}
                      fill="url(#throughputGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartContainer>
            </motion.div>
          </div>

          {/* Tabbed runs / stats tables */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
          >
            <Tabs defaultValue="runs">
              <TabsList>
                <TabsTrigger value="runs" className="text-xs">Recent Runs</TabsTrigger>
                <TabsTrigger value="stats" className="text-xs">Task Statistics</TabsTrigger>
              </TabsList>

              <TabsContent value="runs" className="mt-4">
                <ChartContainer
                  title=""
                  loading={runsQ.isLoading}
                  empty={!runsQ.data?.length}
                  error={runsQ.isError}
                  errorMessage="Pipeline runs unavailable"
                  stateLabel={runsQ.data?.length ? "Live" : undefined}
                  stateStatus={runsQ.isError ? "offline" : runsQ.data?.length ? "healthy" : undefined}
                >
                  <div className="max-h-[400px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Pipeline</TableHead>
                          <TableHead className="text-xs">Task</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                          <TableHead className="text-xs text-right">Rows</TableHead>
                          <TableHead className="text-xs text-right">Duration</TableHead>
                          <TableHead className="text-xs text-right">Started</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {runsQ.data?.map((run) => (
                          <TableRow key={run.id}>
                            <TableCell className="text-xs text-muted-foreground py-2">{run.pipeline_name}</TableCell>
                            <TableCell className="text-xs font-medium py-2">{run.task_name}</TableCell>
                            <TableCell className="py-2"><StatusBadge status={run.status} /></TableCell>
                            <TableCell className="text-xs text-right py-2">{formatNumber(run.rows_processed)}</TableCell>
                            <TableCell className="text-xs text-right text-muted-foreground py-2">{formatDuration(run.duration_sec)}</TableCell>
                            <TableCell className="text-xs text-right text-muted-foreground py-2">{formatDateTime(run.started_at)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </ChartContainer>
              </TabsContent>

              <TabsContent value="stats" className="mt-4">
                <ChartContainer
                  title=""
                  loading={statsQ.isLoading}
                  empty={!statsQ.data?.length}
                  error={statsQ.isError}
                  errorMessage="Task statistics unavailable"
                  stateLabel={statsQ.data?.length ? "Live" : undefined}
                  stateStatus={statsQ.isError ? "offline" : statsQ.data?.length ? "healthy" : undefined}
                >
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Task</TableHead>
                        <TableHead className="text-xs text-right">Runs</TableHead>
                        <TableHead className="text-xs text-right">Success</TableHead>
                        <TableHead className="text-xs text-right">Failures</TableHead>
                        <TableHead className="text-xs text-right">Rate</TableHead>
                        <TableHead className="text-xs text-right">Avg Duration</TableHead>
                        <TableHead className="text-xs text-right">Total Rows</TableHead>
                        <TableHead className="text-xs text-right">Last Run</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {statsQ.data?.map((s) => (
                        <TableRow key={s.task_name}>
                          <TableCell className="text-xs font-medium py-2">{s.task_name}</TableCell>
                          <TableCell className="text-xs text-right py-2">{s.total_runs}</TableCell>
                          <TableCell className="text-xs text-right py-2 text-success">{s.successes}</TableCell>
                          <TableCell className="text-xs text-right py-2">
                            <span className={s.failures > 0 ? "text-destructive font-medium" : "text-muted-foreground"}>
                              {s.failures}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-right py-2">
                            {s.success_rate_pct !== null ? `${s.success_rate_pct}%` : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-right text-muted-foreground py-2">
                            {formatDuration(s.avg_duration_sec)}
                          </TableCell>
                          <TableCell className="text-xs text-right py-2">{formatNumber(s.total_rows_processed)}</TableCell>
                          <TableCell className="text-xs text-right text-muted-foreground py-2">
                            {formatRelativeTime(s.last_run_at)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ChartContainer>
              </TabsContent>
            </Tabs>
          </motion.div>
        </div>
      </div>
    </PageTransition>
  );
}
