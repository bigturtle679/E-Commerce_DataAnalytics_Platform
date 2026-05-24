"use client";

import { useQuery } from "@tanstack/react-query";
import { api, queryKeys } from "@/lib/api";
import { formatNumber, formatCurrency } from "@/lib/format";
import { Header } from "@/components/header";
import { MetricCard, ChartContainer } from "@/components/dashboard";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { fadeUp } from "@/lib/motion";
import { PageTransition } from "@/components/motion/page-transition";
import { StaggerContainer, StaggerItem } from "@/components/motion/stagger-container";
import { ErrorBanner } from "@/components/system/error-banner";

const CHART_COLORS = [
  "var(--chart-1)", "var(--chart-2)", "var(--chart-3)",
  "var(--chart-4)", "var(--chart-5)",
];

export default function AnalyticsPage() {
  const revenueQ = useQuery({ queryKey: queryKeys.analyticsRevenue, queryFn: () => api.getRevenue(24) });
  const productsQ = useQuery({ queryKey: queryKeys.analyticsTopProducts, queryFn: () => api.getTopProducts(10) });
  const customersQ = useQuery({ queryKey: queryKeys.analyticsCustomers, queryFn: () => api.getCustomerTrends(24) });
  const ordersQ = useQuery({ queryKey: queryKeys.analyticsOrders, queryFn: () => api.getOrderGrowth(24) });
  const geoQ = useQuery({ queryKey: queryKeys.analyticsGeo, queryFn: () => api.getGeoDistribution(10) });

  const revenueData = useMemo(() => [...(revenueQ.data ?? [])].reverse(), [revenueQ.data]);
  const customerData = useMemo(() => [...(customersQ.data ?? [])].reverse(), [customersQ.data]);
  const orderData = useMemo(() => [...(ordersQ.data ?? [])].reverse(), [ordersQ.data]);

  const totalRevenue = useMemo(() =>
    revenueQ.data?.reduce((s, r) => s + r.total_revenue, 0) ?? 0,
    [revenueQ.data]
  );
  const totalOrders = useMemo(() =>
    revenueQ.data?.reduce((s, r) => s + r.order_count, 0) ?? 0,
    [revenueQ.data]
  );
  const latestCustomers = useMemo(() =>
    customersQ.data?.[0]?.total_customers ?? 0,
    [customersQ.data]
  );
  const avgOrderValue = useMemo(() =>
    totalOrders > 0 ? totalRevenue / totalOrders : 0,
    [totalRevenue, totalOrders]
  );

  const hasAnyError = revenueQ.isError || productsQ.isError || customersQ.isError || ordersQ.isError || geoQ.isError;

  return (
    <PageTransition>
      <div className="flex flex-col min-h-[200vh] pt-[30vh]">
        <Header title="Intelligence Node" description="Business metrics and behavioral trends" />

        <div className="flex-1 space-y-32 px-4 sm:px-8 lg:px-12 pb-[20vh] max-w-7xl mx-auto w-full">
          {/* Error banner */}
          {hasAnyError && (
            <ErrorBanner
              isError={hasAnyError}
              failureCount={Math.max(revenueQ.failureCount, productsQ.failureCount, customersQ.failureCount, ordersQ.failureCount, geoQ.failureCount)}
              isFetching={revenueQ.isFetching || productsQ.isFetching || customersQ.isFetching || ordersQ.isFetching || geoQ.isFetching}
            />
          )}
          {/* Summary metrics */}
          <StaggerContainer className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <StaggerItem>
              <MetricCard title="Total Revenue" value={formatCurrency(totalRevenue)} />
            </StaggerItem>
            <StaggerItem>
              <MetricCard title="Total Orders" value={formatNumber(totalOrders)} />
            </StaggerItem>
            <StaggerItem>
              <MetricCard title="Total Customers" value={formatNumber(latestCustomers)} />
            </StaggerItem>
            <StaggerItem>
              <MetricCard title="Avg Order Value" value={formatCurrency(avgOrderValue)} />
            </StaggerItem>
          </StaggerContainer>

          {/* Revenue + Orders charts */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 gap-8 lg:grid-cols-2"
          >
            <ChartContainer
              title="Revenue Trend"
              subtitle="Monthly"
              loading={revenueQ.isLoading}
              empty={!revenueData.length}
              error={revenueQ.isError}
              errorMessage="Revenue data unavailable"
              stateLabel={revenueQ.isError ? "Offline" : "Live"}
              stateStatus={revenueQ.isError ? "offline" : "healthy"}
            >
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
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
                    width={80}
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
                  <Area type="monotone" dataKey="total_revenue" stroke="var(--primary)" strokeWidth={2} fill="url(#revGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>

            <ChartContainer
              title="Order Volume"
              subtitle="Monthly"
              loading={ordersQ.isLoading}
              empty={!orderData.length}
              error={ordersQ.isError}
              errorMessage="Order data unavailable"
              stateLabel={ordersQ.isError ? "Offline" : "Live"}
              stateStatus={ordersQ.isError ? "offline" : "healthy"}
            >
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={orderData}>
                  <XAxis
                    dataKey="period"
                    tickFormatter={(v) => String(v).slice(5)}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
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
                      backgroundColor: "var(--hud-bg)",
                      backdropFilter: "blur(20px)",
                      border: "1px solid var(--hud-border)",
                      borderRadius: 12,
                      fontSize: 12,
                      boxShadow: "var(--hud-glow)",
                    }}
                    formatter={(value, name) => [
                      formatNumber(Number(value)),
                      name === "order_count" ? "Orders" : "Items",
                    ]}
                  />
                  <Bar dataKey="order_count" fill="var(--chart-2)" radius={[4, 4, 0, 0]} name="order_count" opacity={0.8} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </motion.div>

          {/* Customers + Geo */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 gap-8 lg:grid-cols-5"
          >
            <ChartContainer
              title="Customer Growth"
              subtitle="Cumulative"
              className="lg:col-span-3"
              loading={customersQ.isLoading}
              empty={!customerData.length}
              error={customersQ.isError}
              errorMessage="Customer data unavailable"
              stateLabel={customersQ.isError ? "Offline" : "Live"}
              stateStatus={customersQ.isError ? "offline" : "healthy"}
            >
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={customerData}>
                  <defs>
                    <linearGradient id="custGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0} />
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
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={formatNumber}
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
                    formatter={(value, name) => [
                      formatNumber(Number(value)),
                      name === "total_customers" ? "Total" : "New",
                    ]}
                  />
                  <Area type="monotone" dataKey="total_customers" stroke="var(--chart-3)" strokeWidth={2} fill="url(#custGrad)" name="total_customers" />
                  <Area type="monotone" dataKey="new_customers" stroke="var(--warning)" strokeWidth={1.5} fill="none" strokeDasharray="4 2" name="new_customers" />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>

            <ChartContainer
              title="Geographic Distribution"
              subtitle="Top states"
              className="lg:col-span-2"
              loading={geoQ.isLoading}
              empty={!geoQ.data?.length}
              error={geoQ.isError}
              errorMessage="Geographic data unavailable"
              stateLabel={geoQ.isError ? "Offline" : "Live"}
              stateStatus={geoQ.isError ? "offline" : "healthy"}
            >
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={geoQ.data?.slice(0, 5) ?? []}
                    dataKey="customer_count"
                    nameKey="state"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    innerRadius={60}
                    strokeWidth={2}
                    stroke="var(--hud-bg)"
                  >
                    {geoQ.data?.slice(0, 5).map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--hud-bg)",
                      backdropFilter: "blur(20px)",
                      border: "1px solid var(--hud-border)",
                      borderRadius: 12,
                      fontSize: 12,
                      boxShadow: "var(--hud-glow)",
                    }}
                    formatter={(value) => [formatNumber(Number(value)), "Customers"]}
                  />
                  <Legend
                    iconSize={8}
                    wrapperStyle={{ fontSize: 11 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
          </motion.div>

          {/* Top products table */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
          >
            <ChartContainer
              title="Top Products by Revenue"
              loading={productsQ.isLoading}
              empty={!productsQ.data?.length}
              error={productsQ.isError}
              errorMessage="Product data unavailable"
              stateLabel={productsQ.isError ? "Offline" : "Live"}
              stateStatus={productsQ.isError ? "offline" : "healthy"}
            >
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10">
                    <TableHead className="text-xs w-8">#</TableHead>
                    <TableHead className="text-xs">Product</TableHead>
                    <TableHead className="text-xs">Category</TableHead>
                    <TableHead className="text-xs text-right">Revenue</TableHead>
                    <TableHead className="text-xs text-right">Units Sold</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productsQ.data?.map((p, i) => (
                    <TableRow key={p.product_id} className="border-white/10 hover:bg-white/5 transition-colors">
                      <TableCell className="text-xs text-muted-foreground py-3">{i + 1}</TableCell>
                      <TableCell className="text-xs font-medium py-3 max-w-[200px] truncate tracking-wide">
                        {p.product_name ?? p.product_id}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground py-3">{p.category ?? "—"}</TableCell>
                      <TableCell className="text-xs text-right py-3 font-medium font-mono">{formatCurrency(p.total_revenue)}</TableCell>
                      <TableCell className="text-xs text-right py-3 font-mono">{formatNumber(p.units_sold)}</TableCell>
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
