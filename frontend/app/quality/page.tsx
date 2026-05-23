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
      <div className="flex flex-col min-h-[200vh] pt-[30vh]">
        <Header title="Data Quality Matrix" description="Freshness, row counts, and pipeline integrity" />

        <div className="flex-1 space-y-32 px-4 sm:px-8 lg:px-12 pb-[20vh] max-w-7xl mx-auto w-full">
          {/* ── Hero Section: Gauge + Metric Cards ── */}
          <StaggerContainer className="grid grid-cols-1 gap-8 lg:grid-cols-[auto_1fr]">
            {/* Gauge Ring */}
            <StaggerItem className="flex items-center justify-center">
              <div className="hud-panel flex items-center justify-center rounded-xl px-10 py-8 relative overflow-hidden">
                <div className="hud-grain" />
                <GaugeRing
                  value={healthScore}
                  size={160}
                  strokeWidth={8}
                  label="Data Health"
                  sublabel="across all sources"
                  className="relative z-10 scale-110"
                />
              </div>
            </StaggerItem>

            {/* Three metric cards */}
            <StaggerItem>
              <div className="grid h-full grid-cols-1 gap-6 sm:grid-cols-3">
                <MetricCard
                  title="Total Tables"
                  value={summary?.total_tables ?? 0}
                  subtitle="monitored"
                />
                <MetricCard
                  title="Total Rows"
                  value={formatNumber(summary?.total_rows ?? 0)}
                  subtitle="across all tables"
                />
                <MetricCard
                  title="Stale Sources"
                  value={staleSources}
                  subtitle={`${summary?.freshness_warn ?? 0} warn · ${summary?.freshness_error ?? 0} error`}
                  trend={staleSources > 0 ? "down" : "up"}
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
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {freshnessQ.data?.map((f) => {
                  const status = f.status as string;
                  const indicatorStatus = STATUS_TO_INDICATOR[status] ?? "offline";
                  // Style border colors for godmode glow
                  let borderClass = "border-muted/20 shadow-none";
                  if (status === "ok") borderClass = "border-success/30 shadow-[0_0_10px_var(--success-alpha)]";
                  if (status === "warn") borderClass = "border-warning/30 shadow-[0_0_10px_var(--warning-alpha)]";
                  if (status === "error") borderClass = "border-destructive/30 shadow-[0_0_10px_var(--destructive-alpha)]";

                  return (
                    <div
                      key={f.table}
                      className={`hud-panel flex flex-col gap-3 rounded-lg border-l-2 px-5 py-4 relative overflow-hidden transition-all duration-300 hover:scale-[1.02] ${borderClass}`}
                    >
                      <div className="hud-grain opacity-50" />
                      <div className="flex items-center gap-2 relative z-10">
                        <LiveIndicator status={indicatorStatus} size="sm" />
                        <span className="truncate text-xs font-medium text-foreground tracking-wide uppercase">
                          {f.table}
                        </span>
                      </div>
                      <div className="flex items-center justify-between relative z-10">
                        <StatusBadge status={f.status} />
                        <span className="text-[10px] tabular-nums text-muted-foreground font-mono">
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
              <ResponsiveContainer width="100%" height={340}>
                <BarChart data={rowChartData} layout="vertical" barCategoryGap="20%">
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
                    width={140}
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
                    formatter={(value) => [formatNumber(Number(value)), "Rows"]}
                    labelFormatter={(label) => String(label)}
                  />
                  <Bar dataKey="rows" fill="var(--primary)" radius={[0, 4, 4, 0]} opacity={0.8} />
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
                  <TableRow className="border-white/10">
                    <TableHead className="text-xs">Schema</TableHead>
                    <TableHead className="text-xs">Table</TableHead>
                    <TableHead className="text-xs text-right">Row Count</TableHead>
                    <TableHead className="text-xs text-right">Last Loaded</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rowCountsQ.data?.map((r) => (
                    <TableRow key={`${r.schema_name}.${r.table_name}`} className="border-white/10 hover:bg-white/5 transition-colors">
                      <TableCell className="text-xs text-muted-foreground py-3">
                        <span className="rounded-sm bg-white/5 border border-white/10 px-1.5 py-0.5 font-mono text-[10px]">
                          {r.schema_name}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs font-medium py-3 tracking-wide">{r.table_name}</TableCell>
                      <TableCell className="text-xs text-right py-3 font-mono">
                        {formatNumber(r.row_count)}
                      </TableCell>
                      <TableCell className="text-xs text-right text-muted-foreground py-3 font-mono">
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
