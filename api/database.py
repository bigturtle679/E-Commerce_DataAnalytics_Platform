"""Database service layer — read-only query execution.

Provides a clean interface between routers and raw SQL.
All queries go through execute_query() which returns list[dict].
Includes graceful error handling for missing tables/schemas.
"""

import logging
from collections.abc import Generator
from contextlib import contextmanager
from typing import Any

import psycopg2
import psycopg2.extras
from psycopg2.pool import ThreadedConnectionPool

from api.config import DATABASE_URL

logger = logging.getLogger("api.database")

_pool: ThreadedConnectionPool | None = None


def init_pool(minconn: int = 2, maxconn: int = 10) -> None:
    global _pool
    if _pool is None:
        _pool = ThreadedConnectionPool(minconn, maxconn, DATABASE_URL)
        logger.info("Database connection pool initialized")


def close_pool() -> None:
    global _pool
    if _pool:
        _pool.closeall()
        _pool = None
        logger.info("Database connection pool closed")


@contextmanager
def get_conn() -> Generator:
    if _pool is None:
        init_pool()
    conn = _pool.getconn()
    try:
        yield conn
    finally:
        _pool.putconn(conn)


def execute_query(
    sql: str,
    params: dict[str, Any] | None = None,
) -> list[dict]:
    """Execute a read-only SQL query and return results as list of dicts.

    Returns empty list on any database error (missing table, schema, etc.)
    to ensure API endpoints never crash.
    """
    try:
        with get_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(sql, params or {})
                rows = cur.fetchall()
                return [dict(row) for row in rows]
    except psycopg2.errors.UndefinedTable as e:
        logger.warning(f"Table not found: {e.diag.message_primary}")
        # Reset connection state after error
        with get_conn() as conn:
            conn.rollback()
        return []
    except psycopg2.errors.UndefinedColumn as e:
        logger.warning(f"Column not found: {e.diag.message_primary}")
        with get_conn() as conn:
            conn.rollback()
        return []
    except psycopg2.errors.InvalidSchemaName as e:
        logger.warning(f"Schema not found: {e.diag.message_primary}")
        with get_conn() as conn:
            conn.rollback()
        return []
    except Exception as e:
        logger.error(f"Query execution error: {e}")
        try:
            with get_conn() as conn:
                conn.rollback()
        except Exception:
            pass
        return []


def execute_scalar(
    sql: str,
    params: dict[str, Any] | None = None,
) -> Any:
    """Execute a query and return a single scalar value."""
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, params or {})
                row = cur.fetchone()
                return row[0] if row else None
    except Exception as e:
        logger.error(f"Scalar query error: {e}")
        try:
            with get_conn() as conn:
                conn.rollback()
        except Exception:
            pass
        return None


def ensure_metrics_table() -> None:
    """Ensure the _pipeline_metrics table exists for the pipeline router.

    Called on API startup so pipeline endpoints don't fail on empty DBs.
    """
    sql = """
    CREATE TABLE IF NOT EXISTS raw._pipeline_metrics (
        id              SERIAL PRIMARY KEY,
        pipeline_name   VARCHAR(100) NOT NULL,
        task_name       VARCHAR(100) NOT NULL,
        status          VARCHAR(20)  NOT NULL,
        rows_processed  INTEGER      DEFAULT 0,
        duration_sec    NUMERIC(10,3),
        error_message   TEXT,
        started_at      TIMESTAMP    NOT NULL,
        completed_at    TIMESTAMP    NOT NULL,
        created_at      TIMESTAMP    DEFAULT NOW()
    )
    """
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                # Ensure raw schema exists
                cur.execute("CREATE SCHEMA IF NOT EXISTS raw")
                cur.execute(sql)
                conn.commit()
        logger.info("Ensured raw._pipeline_metrics table exists")
    except Exception as e:
        logger.warning(f"Could not ensure metrics table: {e}")
