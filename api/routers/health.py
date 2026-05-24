"""System health endpoints — freshness, connectivity, last sync."""

from fastapi import APIRouter

from api.database import execute_query, execute_scalar
from api.schemas import FreshnessIndicator, SystemHealth

router = APIRouter(prefix="/api/health", tags=["health"])


@router.get("/status", response_model=list[SystemHealth])
def get_system_health():
    """System health overview per pipeline."""
    sql = """
        SELECT
            pipeline_name,
            MAX(completed_at)                                  AS last_completed_at,
            MAX(completed_at) FILTER (WHERE status = 'success') AS last_success_at,
            MAX(completed_at) FILTER (WHERE status = 'failure') AS last_failure_at,
            COUNT(*) FILTER (WHERE status = 'failure'
                AND started_at > NOW() - INTERVAL '24 hours')  AS failures_last_24h,
            COUNT(*) FILTER (
                WHERE started_at > NOW() - INTERVAL '24 hours') AS runs_last_24h
        FROM raw._pipeline_metrics
        GROUP BY pipeline_name
        ORDER BY pipeline_name
    """
    return execute_query(sql)


@router.get("/freshness", response_model=list[FreshnessIndicator])
def get_freshness():
    """Freshness indicators for each raw source table."""
    tables = [
        "orders",
        "order_items",
        "customers",
        "products",
        "sellers",
        "order_payments",
        "order_reviews",
    ]
    results = []
    for table in tables:
        sql = f"""
            SELECT
                MAX(_loaded_at) AS last_loaded_at,
                EXTRACT(EPOCH FROM (NOW() - MAX(_loaded_at))) / 3600.0 AS hours_since_load
            FROM raw.{table}
        """
        try:
            rows = execute_query(sql)
            if rows and rows[0]["last_loaded_at"]:
                results.append(
                    {
                        "source_name": table,
                        "last_loaded_at": rows[0]["last_loaded_at"],
                        "hours_since_load": round(rows[0]["hours_since_load"], 1),
                    }
                )
            else:
                results.append(
                    {
                        "source_name": table,
                        "last_loaded_at": None,
                        "hours_since_load": None,
                    }
                )
        except Exception:
            results.append(
                {
                    "source_name": table,
                    "last_loaded_at": None,
                    "hours_since_load": None,
                }
            )
    return results


@router.get("/ping")
def ping():
    """Simple connectivity check."""
    try:
        result = execute_scalar("SELECT 1")
        return {"status": "ok", "db": "connected" if result == 1 else "error"}
    except Exception as e:
        return {"status": "error", "db": str(e)}
