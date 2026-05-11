"""Pydantic response schemas — fully typed API contracts."""

from datetime import datetime

from pydantic import BaseModel

# --- Pipeline ---


class PipelineRun(BaseModel):
    id: int
    pipeline_name: str
    task_name: str
    status: str
    rows_processed: int
    duration_sec: float | None
    error_message: str | None
    started_at: datetime | None
    completed_at: datetime | None


class TaskStats(BaseModel):
    task_name: str
    total_runs: int
    successes: int
    failures: int
    success_rate_pct: float | None
    avg_duration_sec: float | None
    max_duration_sec: float | None
    total_rows_processed: int
    last_run_at: datetime | None


class ThroughputPoint(BaseModel):
    hour: datetime
    rows_processed: int
    run_count: int
    avg_duration_sec: float | None


# --- Health ---


class SystemHealth(BaseModel):
    pipeline_name: str
    last_completed_at: datetime | None
    last_success_at: datetime | None
    last_failure_at: datetime | None
    failures_last_24h: int
    runs_last_24h: int


class FreshnessIndicator(BaseModel):
    source_name: str
    last_loaded_at: datetime | None
    hours_since_load: float | None


# --- Analytics ---


class RevenueDataPoint(BaseModel):
    period: str
    total_revenue: float
    order_count: int


class TopProduct(BaseModel):
    product_id: str
    product_name: str | None
    category: str | None
    total_revenue: float
    units_sold: int


class CustomerTrend(BaseModel):
    period: str
    new_customers: int
    total_customers: int


class OrderGrowth(BaseModel):
    period: str
    order_count: int
    total_items: int
    avg_order_value: float | None


class GeoDistribution(BaseModel):
    state: str
    customer_count: int
    order_count: int


# --- Data Quality ---


class TableRowCount(BaseModel):
    schema_name: str
    table_name: str
    row_count: int
    last_loaded_at: datetime | None


class QualitySummary(BaseModel):
    total_tables: int
    total_rows: int
    freshness_ok: int
    freshness_warn: int
    freshness_error: int
