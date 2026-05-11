"""Pipeline monitoring endpoints — runs, stats, throughput."""

from fastapi import APIRouter, Query

from api.database import execute_query
from api.schemas import PipelineRun, TaskStats, ThroughputPoint

router = APIRouter(prefix="/api/pipeline", tags=["pipeline"])


@router.get("/runs", response_model=list[PipelineRun])
def get_pipeline_runs(
    limit: int = Query(default=50, ge=1, le=200),
    status: str | None = Query(default=None),
):
    """Recent pipeline runs, optionally filtered by status."""
    sql = """
        SELECT id, pipeline_name, task_name, status, rows_processed,
               duration_sec, error_message, started_at, completed_at
        FROM raw._pipeline_metrics
        WHERE (%(status)s IS NULL OR status = %(status)s)
        ORDER BY started_at DESC
        LIMIT %(limit)s
    """
    return execute_query(sql, {"limit": limit, "status": status})


@router.get("/stats", response_model=list[TaskStats])
def get_task_stats():
    """Aggregated statistics per task."""
    sql = """
        SELECT
            task_name,
            COUNT(*)                                           AS total_runs,
            COUNT(*) FILTER (WHERE status = 'success')         AS successes,
            COUNT(*) FILTER (WHERE status = 'failure')         AS failures,
            ROUND(
                100.0 * COUNT(*) FILTER (WHERE status = 'success')
                / NULLIF(COUNT(*), 0), 1
            )                                                  AS success_rate_pct,
            ROUND(AVG(duration_sec)::numeric, 3)               AS avg_duration_sec,
            ROUND(MAX(duration_sec)::numeric, 3)               AS max_duration_sec,
            COALESCE(SUM(rows_processed), 0)                   AS total_rows_processed,
            MAX(started_at)                                    AS last_run_at
        FROM raw._pipeline_metrics
        GROUP BY task_name
        ORDER BY last_run_at DESC NULLS LAST
    """
    return execute_query(sql)


@router.get("/timeline", response_model=list[ThroughputPoint])
def get_throughput_timeline(days: int = Query(default=7, ge=1, le=30)):
    """Hourly throughput over the last N days."""
    sql = """
        SELECT
            DATE_TRUNC('hour', started_at) AS hour,
            COALESCE(SUM(rows_processed), 0) AS rows_processed,
            COUNT(*) AS run_count,
            ROUND(AVG(duration_sec)::numeric, 3) AS avg_duration_sec
        FROM raw._pipeline_metrics
        WHERE started_at > NOW() - MAKE_INTERVAL(days := %(days)s)
        GROUP BY DATE_TRUNC('hour', started_at)
        ORDER BY hour DESC
    """
    return execute_query(sql, {"days": days})
