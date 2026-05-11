"""Integration tests — require a live PostgreSQL connection.

These tests validate database connectivity, schema creation, and basic
query execution. They are separated from unit tests to keep the default
CI fast.

Run: pytest tests/test_integration.py -v -m integration
Skip: pytest tests/ -v -m "not integration"
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


@pytest.mark.integration
class TestDatabaseConnectivity:
    """Validate that the platform can connect to and operate on PostgreSQL."""

    def test_database_connection(self):
        """Verify basic PostgreSQL connectivity."""
        from sqlalchemy import create_engine, text

        from config.settings import DATABASE_URL

        engine = create_engine(DATABASE_URL)
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1 AS ok"))
            row = result.fetchone()
            assert row[0] == 1

    def test_schema_creation(self):
        """Verify raw/staging/analytics schemas can be created."""
        from ingestion.utils.db import ensure_schemas

        # Should be idempotent — safe to run multiple times
        ensure_schemas()

        from sqlalchemy import create_engine, text

        from config.settings import DATABASE_URL

        engine = create_engine(DATABASE_URL)
        with engine.connect() as conn:
            result = conn.execute(
                text(
                    "SELECT schema_name FROM information_schema.schemata "
                    "WHERE schema_name IN ('raw', 'staging', 'analytics') "
                    "ORDER BY schema_name"
                )
            )
            schemas = [row[0] for row in result.fetchall()]
            assert "analytics" in schemas
            assert "raw" in schemas
            assert "staging" in schemas

    def test_metrics_table_creation(self):
        """Verify _pipeline_metrics table can be created."""
        from sqlalchemy import create_engine, text

        from config.settings import DATABASE_URL

        # First ensure schemas exist
        from ingestion.utils.db import ensure_schemas

        ensure_schemas()

        engine = create_engine(DATABASE_URL)
        with engine.connect() as conn:
            # Create metrics table (idempotent)
            conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS raw._pipeline_metrics (
                        id SERIAL PRIMARY KEY,
                        pipeline_name VARCHAR(100),
                        task_name VARCHAR(100),
                        status VARCHAR(20),
                        rows_processed INTEGER DEFAULT 0,
                        duration_sec FLOAT,
                        error_message TEXT,
                        started_at TIMESTAMP DEFAULT NOW(),
                        completed_at TIMESTAMP DEFAULT NOW()
                    )
                    """))
            conn.commit()

            # Verify table exists
            result = conn.execute(
                text(
                    "SELECT EXISTS ("
                    "  SELECT 1 FROM information_schema.tables "
                    "  WHERE table_schema = 'raw' AND table_name = '_pipeline_metrics'"
                    ")"
                )
            )
            assert result.fetchone()[0] is True
