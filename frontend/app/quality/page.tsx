"use client";

import { useQuery } from "@tanstack/react-query";
import { api, queryKeys } from "@/lib/api";
import { formatNumber, formatRelativeTime } from "@/lib/format";
import { Header } from "@/components/header";
import { MetricCard, StatusBadge, ChartContainer } from "@/components/dashboard";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { fadeUp } from "@/lib/motion";
import { PageTransition } from "@/components/motion/page-transition";
import { StaggerContainer, StaggerItem } from "@/components/motion/stagger-container";
import { GaugeRing } from "@/components/charts/gauge-ring";
import { LiveIndicator } from "@/components/system/live-indicator";

const STATUS_BORDER: Record<string, string> = {
  ok: "border-emerald-500/40",
  warn: "border-amber-500/40",
  error: "border-red-500/40",
  unknown: "border-zinc-500/40",
};

const STATUS_TO_INDICATOR: Record<string, "healthy" | "delayed" | "degraded" | "offline"> = {
  ok: "healthy",
  warn: "delayed",
  error: "degraded",
  unknown: "offline",
};

export default function QualityPage() {
  const summaryQ = useQuery({ queryKey: queryKeys.qualitySummary, queryFn: api.getQualitySummary });
  const rowCountsQ = useQuery({ queryKey: queryKeys.qualityRowCounts, queryFn: api.getRowCounts });
  const freshnessQ = useQuery({ queryKey: queryKeys.qualityFreshness, queryFn: api.getQualityFreshness });

  const summary = summaryQ.data as Record<string, number> | undefined;

  const healthScore = useMemo(() => {
    if (!summary) return 0;
    const ok = summary.freshness_ok ?? 0;
    const warn = summary.freshness_warn ?? 0;
    const err = summary.freshness_error ?? 0;
    const total = ok + warn + err;
    return total > 0 ? Math.round((ok / total) * 100) : 0;
  }, [summary]);

  const staleSources = useMemo(() => {
    return (summary?.freshness_warn ?? 0) + (summary?.freshness_error ?? 0);
  }, [summary]);

  const rowChartData = useMemo(() =>
    rowCountsQ.data?.map(r => ({
      name: `${r.schema_name}.${r.table_name}`,
      short: r.table_name,
      rows: r.row_count,
    })).sort((a, b) => b.rows - a.rows) ?? [],
    [rowCountsQ.data]
  );

  return (
    <PageTransition>
      <div className="flex flex-col">
        <Header title="Data Quality" description="Freshness, row counts, and pipeline integrity" />

        <div className="flex-1 space-y-6 p-6">
          {/* ── Hero Section: Gauge + Metric Cards ── */}
          <StaggerContainer className="grid grid-cols-1 gap-6 lg:grid-cols-[auto_1fr]">
            {/* Gauge Ring */}
            <StaggerItem className="flex items-center justify-center">
              <div className="m-panel flex items-center justify-center rounded-xl px-8 py-6">
                <GaugeRing
                  value={healthScore}
                  size={140}
                  strokeWidth={8}
                  label="Data Health"
                  sublabel="across all sources"
                />
              </div>
            </StaggerItem>

            {/* Three metric cards */}
            <StaggerItem>
              <div className="grid h-full grid-cols-1 gap-4 sm:grid-cols-3">
                <MetricCard
                  title="Total Tables"
                  value={summary?.total_tables ?? 0}
                  subtitle="monitored"
                  accentColor="var(--chart-1)"
                />
                <MetricCard
                  title="Total Rows"
                  value={formatNumber(summary?.total_rows ?? 0)}
                  subtitle="across all tables"
                  accentColor="var(--chart-5)"
                />
                <MetricCard
                  title="Stale Sources"
                  value={staleSources}
                  subtitle={`${summary?.freshness_warn ?? 0} warn · ${summary?.freshness_error ?? 0} error`}
                  trend={staleSources > 0 ? "down" : "up"}
                  accentColor="var(--destructive)"
                />
              </div>
            </StaggerItem>
          </StaggerContainer>

          {/* ── Freshness Visual Grid ── */}
          <motion.div variants={fadeUp} initial="hidden" animate="visible">
            <ChartContainer
              title="Source Freshness"
              subtitle="Live status of each data source"
              loading={freshnessQ.isLoading}
              empty={!freshnessQ.data?.length}
              stateLabel="Sources"
              stateStatus={
                staleSources > 0 ? "degraded" : "healthy"
              }
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {freshnessQ.data?.map((f) => {
                  const status = f.status as string;
                  const borderColor = STATUS_BORDER[status] ?? STATUS_BORDER.unknown;
                  const indicatorStatus = STATUS_TO_INDICATOR[status] ?? "offline";

                  return (
                    <div
                      key={f.table}
                      className={`m-panel flex flex-col gap-2 rounded-lg border-l-2 px-4 py-3 ${borderColor}`}
                    >
                      <div className="flex items-center gap-2">
                        <LiveIndicator status={indicatorStatus} size="sm" />
                        <span className="truncate text-xs font-medium text-foreground">
                          {f.table}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <StatusBadge status={f.status} />
                        <span className="text-[10px] tabular-nums text-muted-foreground">
                          {f.hours_ago !== null ? `${f.hours_ago}h ago` : "—"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ChartContainer>
          </motion.div>

          {/* ── Row Count BarChart ── */}
          <motion.div variants={fadeUp} initial="hidden" animate="visible">
            <ChartContainer
              title="Row Counts by Table"
              subtitle="Descending by volume"
              loading={rowCountsQ.isLoading}
              empty={!rowChartData.length}
              stateLabel="Tables"
              stateStatus="healthy"
            >
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={rowChartData} layout="vertical" barCategoryGap="15%">
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={formatNumber}
                  />
                  <YAxis
                    dataKey="short"
                    type="category"
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                    width={120}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(value) => [formatNumber(Number(value)), "Rows"]}
                    labelFormatter={(label) => String(label)}
                  />
                  <Bar dataKey="rows" fill="var(--chart-1)" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </motion.div>

          {/* ── Table Inventory ── */}
          <motion.div variants={fadeUp} initial="hidden" animate="visible">
            <ChartContainer
              title="Table Inventory"
              subtitle="All monitored tables"
              loading={rowCountsQ.isLoading}
              empty={!rowCountsQ.data?.length}
              stateLabel="Inventory"
              stateStatus="healthy"
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Schema</TableHead>
                    <TableHead className="text-xs">Table</TableHead>
                    <TableHead className="text-xs text-right">Row Count</TableHead>
                    <TableHead className="text-xs text-right">Last Loaded</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rowCountsQ.data?.map((r) => (
                    <TableRow key={`${r.schema_name}.${r.table_name}`}>
                      <TableCell className="text-xs text-muted-foreground py-2">
                        <span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                          {r.schema_name}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs font-medium py-2">{r.table_name}</TableCell>
                      <TableCell className="text-xs text-right py-2 font-mono">
                        {formatNumber(r.row_count)}
                      </TableCell>
                      <TableCell className="text-xs text-right text-muted-foreground py-2">
                        {formatRelativeTime(r.last_loaded_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ChartContainer>
          </motion.div>
        </div>
      </div>
    </PageTransition>
  );
}
