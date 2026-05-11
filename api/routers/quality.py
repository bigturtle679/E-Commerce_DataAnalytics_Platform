"""Data quality endpoints — row counts, freshness, anomaly detection."""

from fastapi import APIRouter

from api.database import execute_query
from api.schemas import QualitySummary, TableRowCount

router = APIRouter(prefix="/api/quality", tags=["quality"])

# Tables to monitor with their schemas
_MONITORED_TABLES = [
    ("raw", "orders"),
    ("raw", "order_items"),
    ("raw", "customers"),
    ("raw", "products"),
    ("raw", "sellers"),
    ("raw", "order_payments"),
    ("raw", "order_reviews"),
    ("raw", "api_products"),
    ("raw", "api_users"),
    ("raw", "api_carts"),
    ("analytics", "dim_customers"),
    ("analytics", "dim_products"),
    ("analytics", "dim_sellers"),
    ("analytics", "dim_dates"),
    ("analytics", "fact_order_items"),
    ("analytics", "fact_order_payments"),
]


@router.get("/row-counts", response_model=list[TableRowCount])
def get_row_counts():
    """Row counts and last load time for all monitored tables."""
    results = []
    for schema, table in _MONITORED_TABLES:
        try:
            rows = execute_query(
                f"SELECT COUNT(*) AS cnt, MAX(_loaded_at) AS last_loaded " f"FROM {schema}.{table}"
            )
            results.append(
                {
                    "schema_name": schema,
                    "table_name": table,
                    "row_count": rows[0]["cnt"] if rows else 0,
                    "last_loaded_at": rows[0]["last_loaded"] if rows else None,
                }
            )
        except Exception:
            # Table may not have _loaded_at (e.g. dim_dates)
            try:
                rows = execute_query(f"SELECT COUNT(*) AS cnt FROM {schema}.{table}")
                results.append(
                    {
                        "schema_name": schema,
                        "table_name": table,
                        "row_count": rows[0]["cnt"] if rows else 0,
                        "last_loaded_at": None,
                    }
                )
            except Exception:
                results.append(
                    {
                        "schema_name": schema,
                        "table_name": table,
                        "row_count": 0,
                        "last_loaded_at": None,
                    }
                )
    return results


@router.get("/summary", response_model=QualitySummary)
def get_quality_summary():
    """Overall data quality summary."""
    row_counts = get_row_counts()
    total_tables = len(row_counts)
    total_rows = sum(r["row_count"] for r in row_counts)

    freshness_ok = 0
    freshness_warn = 0
    freshness_error = 0

    for r in row_counts:
        if r["last_loaded_at"] is None:
            continue
        try:
            hours = execute_query(
                "SELECT EXTRACT(EPOCH FROM (NOW() - %(ts)s)) / 3600.0 AS h",
                {"ts": r["last_loaded_at"]},
            )
            h = hours[0]["h"] if hours else None
            if h is None:
                continue
            if h <= 36:
                freshness_ok += 1
            elif h <= 72:
                freshness_warn += 1
            else:
                freshness_error += 1
        except Exception:
            continue

    return {
        "total_tables": total_tables,
        "total_rows": total_rows,
        "freshness_ok": freshness_ok,
        "freshness_warn": freshness_warn,
        "freshness_error": freshness_error,
    }


@router.get("/freshness")
def get_freshness_details():
    """Detailed freshness status per source table."""
    results = []
    raw_tables = [
        "orders",
        "order_items",
        "customers",
        "products",
        "sellers",
        "order_payments",
        "order_reviews",
        "api_products",
        "api_users",
        "api_carts",
    ]
    for table in raw_tables:
        try:
            rows = execute_query(f"""
                SELECT
                    MAX(_loaded_at) AS last_loaded_at,
                    EXTRACT(EPOCH FROM (NOW() - MAX(_loaded_at))) / 3600.0 AS hours_ago
                FROM raw.{table}
                """)
            r = rows[0] if rows else {}
            hours = r.get("hours_ago")
            status = "unknown"
            if hours is not None:
                if hours <= 36:
                    status = "ok"
                elif hours <= 72:
                    status = "warn"
                else:
                    status = "error"
            results.append(
                {
                    "table": table,
                    "last_loaded_at": r.get("last_loaded_at"),
                    "hours_ago": round(hours, 1) if hours else None,
                    "status": status,
                }
            )
        except Exception:
            results.append(
                {
                    "table": table,
                    "last_loaded_at": None,
                    "hours_ago": None,
                    "status": "unknown",
                }
            )
    return results
