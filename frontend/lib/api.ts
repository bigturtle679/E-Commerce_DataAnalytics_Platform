/**
 * API client + React Query hooks.
 * All data fetching flows through fetchApi().
 * Polling intervals are set per-hook based on data volatility.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function fetchApi<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json();
}

// --- Types (mirror API schemas) ---

export interface PipelineRun {
  id: number;
  pipeline_name: string;
  task_name: string;
  status: "success" | "failure";
  rows_processed: number;
  duration_sec: number | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface TaskStats {
  task_name: string;
  total_runs: number;
  successes: number;
  failures: number;
  success_rate_pct: number | null;
  avg_duration_sec: number | null;
  max_duration_sec: number | null;
  total_rows_processed: number;
  last_run_at: string | null;
}

export interface ThroughputPoint {
  hour: string;
  rows_processed: number;
  run_count: number;
  avg_duration_sec: number | null;
}

export interface SystemHealth {
  pipeline_name: string;
  last_completed_at: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  failures_last_24h: number;
  runs_last_24h: number;
}

export interface FreshnessIndicator {
  source_name: string;
  last_loaded_at: string | null;
  hours_since_load: number | null;
}

export interface RevenueDataPoint {
  period: string;
  total_revenue: number;
  order_count: number;
}

export interface TopProduct {
  product_id: string;
  product_name: string | null;
  category: string | null;
  total_revenue: number;
  units_sold: number;
}

export interface CustomerTrend {
  period: string;
  new_customers: number;
  total_customers: number;
}

export interface OrderGrowth {
  period: string;
  order_count: number;
  total_items: number;
  avg_order_value: number | null;
}

export interface GeoDistribution {
  state: string;
  customer_count: number;
  order_count: number;
}

export interface TableRowCount {
  schema_name: string;
  table_name: string;
  row_count: number;
  last_loaded_at: string | null;
}

export interface QualitySummary {
  total_tables: number;
  total_rows: number;
  freshness_ok: number;
  freshness_warn: number;
  freshness_error: number;
}

export interface FreshnessDetail {
  table: string;
  last_loaded_at: string | null;
  hours_ago: number | null;
  status: "ok" | "warn" | "error" | "unknown";
}

// --- Query keys ---

export const queryKeys = {
  pipelineRuns: ["pipeline", "runs"] as const,
  pipelineStats: ["pipeline", "stats"] as const,
  pipelineTimeline: ["pipeline", "timeline"] as const,
  healthStatus: ["health", "status"] as const,
  healthFreshness: ["health", "freshness"] as const,
  healthPing: ["health", "ping"] as const,
  analyticsRevenue: ["analytics", "revenue"] as const,
  analyticsTopProducts: ["analytics", "top-products"] as const,
  analyticsCustomers: ["analytics", "customers"] as const,
  analyticsOrders: ["analytics", "orders"] as const,
  analyticsGeo: ["analytics", "geo"] as const,
  qualityRowCounts: ["quality", "row-counts"] as const,
  qualitySummary: ["quality", "summary"] as const,
  qualityFreshness: ["quality", "freshness"] as const,
} as const;

// --- Query functions ---

export const api = {
  // Pipeline
  getPipelineRuns: (limit = 50) =>
    fetchApi<PipelineRun[]>(`/api/pipeline/runs?limit=${limit}`),
  getPipelineStats: () =>
    fetchApi<TaskStats[]>("/api/pipeline/stats"),
  getPipelineTimeline: (days = 7) =>
    fetchApi<ThroughputPoint[]>(`/api/pipeline/timeline?days=${days}`),

  // Health
  getHealthStatus: () =>
    fetchApi<SystemHealth[]>("/api/health/status"),
  getHealthFreshness: () =>
    fetchApi<FreshnessIndicator[]>("/api/health/freshness"),
  getHealthPing: () =>
    fetchApi<{ status: string; db: string }>("/api/health/ping"),

  // Analytics
  getRevenue: (months = 24) =>
    fetchApi<RevenueDataPoint[]>(`/api/analytics/revenue?months=${months}`),
  getTopProducts: (limit = 10) =>
    fetchApi<TopProduct[]>(`/api/analytics/top-products?limit=${limit}`),
  getCustomerTrends: (months = 24) =>
    fetchApi<CustomerTrend[]>(`/api/analytics/customers?months=${months}`),
  getOrderGrowth: (months = 24) =>
    fetchApi<OrderGrowth[]>(`/api/analytics/orders?months=${months}`),
  getGeoDistribution: (limit = 20) =>
    fetchApi<GeoDistribution[]>(`/api/analytics/geo?limit=${limit}`),

  // Quality
  getRowCounts: () =>
    fetchApi<TableRowCount[]>("/api/quality/row-counts"),
  getQualitySummary: () =>
    fetchApi<QualitySummary[]>("/api/quality/summary"),
  getQualityFreshness: () =>
    fetchApi<FreshnessDetail[]>("/api/quality/freshness"),
} as const;
