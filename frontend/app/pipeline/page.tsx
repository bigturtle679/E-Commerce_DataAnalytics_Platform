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
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { useMemo } from "react";

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

  return (
    <div className="flex flex-col">
      <Header title="Pipeline Monitoring" description="DAG runs, task stats, and execution metrics" />

      <div className="flex-1 space-y-6 p-6">
        {/* Summary metrics */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Success Rate"
            value={`${successRate}%`}
            trend={successRate >= 95 ? "up" : successRate >= 80 ? "neutral" : "down"}
            subtitle={successRate >= 95 ? "Healthy" : "Needs attention"}
          />
          <MetricCard
            title="Total Failures"
            value={totalFailures}
            trend={totalFailures === 0 ? "up" : "down"}
            subtitle="across all tasks"
          />
          <MetricCard
            title="Active Tasks"
            value={statsQ.data?.length ?? 0}
            subtitle="monitored"
          />
          <MetricCard
            title="Rows Processed"
            value={formatNumber(statsQ.data?.reduce((s, t) => s + t.total_rows_processed, 0) ?? 0)}
            subtitle="total"
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ChartContainer
            title="Task Duration"
            subtitle="Avg vs Max (seconds)"
            loading={statsQ.isLoading}
            empty={!durationChartData.length}
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

          <ChartContainer
            title="Throughput Timeline"
            subtitle="Rows/hour (last 24h)"
            loading={timelineQ.isLoading}
            empty={!throughputData.length}
          >
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={throughputData}>
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
                <Bar dataKey="rows_processed" fill="var(--chart-2)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>

        {/* Tabbed runs / stats tables */}
        <Tabs defaultValue="runs">
          <TabsList>
            <TabsTrigger value="runs" className="text-xs">Recent Runs</TabsTrigger>
            <TabsTrigger value="stats" className="text-xs">Task Statistics</TabsTrigger>
          </TabsList>

          <TabsContent value="runs" className="mt-4">
            <ChartContainer title="" loading={runsQ.isLoading} empty={!runsQ.data?.length}>
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
            <ChartContainer title="" loading={statsQ.isLoading} empty={!statsQ.data?.length}>
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
      </div>
    </div>
  );
}
