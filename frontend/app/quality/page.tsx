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

export default function QualityPage() {
  const summaryQ = useQuery({ queryKey: queryKeys.qualitySummary, queryFn: api.getQualitySummary });
  const rowCountsQ = useQuery({ queryKey: queryKeys.qualityRowCounts, queryFn: api.getRowCounts });
  const freshnessQ = useQuery({ queryKey: queryKeys.qualityFreshness, queryFn: api.getQualityFreshness });

  const summary = summaryQ.data as Record<string, number> | undefined;

  const rowChartData = useMemo(() =>
    rowCountsQ.data?.map(r => ({
      name: `${r.schema_name}.${r.table_name}`,
      short: r.table_name,
      rows: r.row_count,
    })).sort((a, b) => b.rows - a.rows) ?? [],
    [rowCountsQ.data]
  );

  return (
    <div className="flex flex-col">
      <Header title="Data Quality" description="Freshness, row counts, and pipeline integrity" />

      <div className="flex-1 space-y-6 p-6">
        {/* Summary */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            title="Fresh Sources"
            value={summary?.freshness_ok ?? 0}
            subtitle="within 36h threshold"
            trend={(summary?.freshness_ok ?? 0) > 0 ? "up" : "neutral"}
          />
          <MetricCard
            title="Stale Sources"
            value={(summary?.freshness_warn ?? 0) + (summary?.freshness_error ?? 0)}
            subtitle={`${summary?.freshness_warn ?? 0} warn, ${summary?.freshness_error ?? 0} error`}
            trend={(summary?.freshness_warn ?? 0) + (summary?.freshness_error ?? 0) > 0 ? "down" : "up"}
          />
        </div>

        {/* Row count chart + Freshness table */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ChartContainer
            title="Row Counts by Table"
            loading={rowCountsQ.isLoading}
            empty={!rowChartData.length}
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

          <ChartContainer
            title="Source Freshness"
            loading={freshnessQ.isLoading}
            empty={!freshnessQ.data?.length}
          >
            <div className="max-h-[300px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Source</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs text-right">Hours Ago</TableHead>
                    <TableHead className="text-xs text-right">Last Load</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {freshnessQ.data?.map((f) => (
                    <TableRow key={f.table}>
                      <TableCell className="text-xs font-medium py-2">{f.table}</TableCell>
                      <TableCell className="py-2">
                        <StatusBadge status={f.status} />
                      </TableCell>
                      <TableCell className="text-xs text-right text-muted-foreground py-2">
                        {f.hours_ago !== null ? `${f.hours_ago}h` : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-right text-muted-foreground py-2">
                        {formatRelativeTime(f.last_loaded_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </ChartContainer>
        </div>

        {/* Full row counts table */}
        <ChartContainer
          title="Table Inventory"
          subtitle="All monitored tables"
          loading={rowCountsQ.isLoading}
          empty={!rowCountsQ.data?.length}
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
      </div>
    </div>
  );
}
