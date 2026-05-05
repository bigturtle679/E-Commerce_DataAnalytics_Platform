"""Pipeline observability — lightweight metrics collection.

Tracks rows processed, execution time, and success/failure per pipeline run.
Stores metrics in raw._pipeline_metrics table.
"""

import time
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Generator

from sqlalchemy import text

from ingestion.utils.db import get_engine
from ingestion.utils.logger import get_logger
from config.settings import RAW_SCHEMA

logger = get_logger("metrics")

_METRICS_TABLE = f"{RAW_SCHEMA}._pipeline_metrics"

_CREATE_METRICS_TABLE = f"""
CREATE TABLE IF NOT EXISTS {_METRICS_TABLE} (
    id              SERIAL PRIMARY KEY,
    pipeline_name   VARCHAR(100) NOT NULL,
    task_name       VARCHAR(100) NOT NULL,
    status          VARCHAR(20)  NOT NULL,  -- 'success' | 'failure'
    rows_processed  INTEGER      DEFAULT 0,
    duration_sec    NUMERIC(10,3),
    error_message   TEXT,
    started_at      TIMESTAMP    NOT NULL,
    completed_at    TIMESTAMP    NOT NULL,
    created_at      TIMESTAMP    DEFAULT NOW()
)
"""


def _ensure_metrics_table() -> None:
    engine = get_engine()
    with engine.begin() as conn:
        conn.execute(text(_CREATE_METRICS_TABLE))


def record_metric(
    pipeline_name: str,
    task_name: str,
    status: str,
    rows_processed: int = 0,
    duration_sec: float = 0.0,
    error_message: str | None = None,
    started_at: datetime | None = None,
    completed_at: datetime | None = None,
) -> None:
    """Insert a single metric row into the pipeline_metrics table."""
    _ensure_metrics_table()

    now = datetime.now(timezone.utc)
    started = started_at or now
    completed = completed_at or now

    engine = get_engine()
    with engine.begin() as conn:
        conn.execute(
            text(
                f"INSERT INTO {_METRICS_TABLE} "
                "(pipeline_name, task_name, status, rows_processed, "
                "duration_sec, error_message, started_at, completed_at) "
                "VALUES (:pipeline, :task, :status, :rows, :duration, "
                ":error, :started, :completed)"
            ),
            {
                "pipeline": pipeline_name,
                "task": task_name,
                "status": status,
                "rows": rows_processed,
                "duration": round(duration_sec, 3),
                "error": error_message,
                "started": started,
                "completed": completed,
            },
        )
    logger.info(
        f"Metric recorded: {pipeline_name}/{task_name} "
        f"status={status} rows={rows_processed} duration={duration_sec:.3f}s"
    )


@contextmanager
def track_pipeline(
    pipeline_name: str, task_name: str
) -> Generator[dict, None, None]:
    """Context manager that auto-records timing and status.

    Usage:
        with track_pipeline("batch_ingestion", "orders") as ctx:
            rows = do_work()
            ctx["rows_processed"] = rows
    """
    ctx: dict = {"rows_processed": 0}
    start = time.monotonic()
    started_at = datetime.now(timezone.utc)
    try:
        yield ctx
        duration = time.monotonic() - start
        record_metric(
            pipeline_name=pipeline_name,
            task_name=task_name,
            status="success",
            rows_processed=ctx.get("rows_processed", 0),
            duration_sec=duration,
            started_at=started_at,
            completed_at=datetime.now(timezone.utc),
        )
    except Exception as e:
        duration = time.monotonic() - start
        record_metric(
            pipeline_name=pipeline_name,
            task_name=task_name,
            status="failure",
            rows_processed=ctx.get("rows_processed", 0),
            duration_sec=duration,
            error_message=str(e)[:500],
            started_at=started_at,
            completed_at=datetime.now(timezone.utc),
        )
        raise
