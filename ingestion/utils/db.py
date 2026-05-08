import hashlib
from datetime import datetime, timezone

import pandas as pd
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

from config.settings import DATABASE_URL, RAW_SCHEMA, STAGING_SCHEMA, ANALYTICS_SCHEMA
from ingestion.utils.logger import get_logger

logger = get_logger("db")

_engine: Engine | None = None


def get_engine() -> Engine:
    global _engine
    if _engine is None:
        _engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_size=5)
        logger.info("Database engine created")
    return _engine


def ensure_schemas() -> None:
    engine = get_engine()
    with engine.begin() as conn:
        for schema in (RAW_SCHEMA, STAGING_SCHEMA, ANALYTICS_SCHEMA):
            conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {schema}"))
    logger.info("Schemas ensured: raw, staging, analytics")


def upsert_dataframe(
    df: pd.DataFrame,
    table_name: str,
    schema: str,
    conflict_columns: list[str],
    batch_id: str | None = None,
) -> int:
    """Upsert a DataFrame into a PostgreSQL table. Creates table if not exists."""
    engine = get_engine()
    full_table = f"{schema}.{table_name}"

    df = df.copy()
    df["_loaded_at"] = datetime.now(timezone.utc)
    df["_source"] = "batch_csv" if schema == RAW_SCHEMA and "api_" not in table_name else "fakestore_api"
    if batch_id:
        df["_batch_id"] = batch_id

    # Create table via pandas if it doesn't exist
    with engine.begin() as conn:
        table_exists = conn.execute(
            text(
                "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
                "WHERE table_schema = :schema AND table_name = :table)"
            ),
            {"schema": schema, "table": table_name},
        ).scalar()

    if not table_exists:
        df.head(0).to_sql(table_name, engine, schema=schema, index=False)
        # Add unique constraint for upsert conflict resolution
        if conflict_columns:
            constraint_name = f"uq_{table_name}_{'_'.join(conflict_columns)}"
            col_list = ", ".join(f'"{c}"' for c in conflict_columns)
            with engine.begin() as conn:
                conn.execute(text(
                    f'ALTER TABLE {full_table} ADD CONSTRAINT "{constraint_name}" '
                    f'UNIQUE ({col_list})'
                ))
        logger.info(f"Created table {full_table}")

    if not conflict_columns:
        df.to_sql(table_name, engine, schema=schema, index=False, if_exists="append")
        logger.info(f"Inserted {len(df)} rows into {full_table}")
        return len(df)

    # Build upsert SQL
    columns = list(df.columns)
    col_list = ", ".join(f'"{c}"' for c in columns)
    val_placeholders = ", ".join(f":{c}" for c in columns)
    conflict_list = ", ".join(f'"{c}"' for c in conflict_columns)
    update_set = ", ".join(
        f'"{c}" = EXCLUDED."{c}"' for c in columns if c not in conflict_columns
    )

    upsert_sql = text(
        f'INSERT INTO {full_table} ({col_list}) VALUES ({val_placeholders}) '
        f'ON CONFLICT ({conflict_list}) DO UPDATE SET {update_set}'
    )

    records = df.to_dict(orient="records")
    with engine.begin() as conn:
        for record in records:
            # Convert pandas NaT/NaN to None for PostgreSQL compatibility
            for k, v in record.items():
                if pd.isna(v):
                    record[k] = None
            conn.execute(upsert_sql, record)

    logger.info(f"Upserted {len(records)} rows into {full_table}")
    return len(records)


def log_ingestion(
    filename: str, row_count: int, checksum: str, batch_id: str
) -> None:
    engine = get_engine()
    with engine.begin() as conn:
        conn.execute(
            text(
                f"CREATE TABLE IF NOT EXISTS {RAW_SCHEMA}._ingestion_log ("
                "id SERIAL PRIMARY KEY, "
                "filename VARCHAR(255) NOT NULL, "
                "row_count INTEGER, "
                "checksum VARCHAR(64), "
                "batch_id VARCHAR(50), "
                "loaded_at TIMESTAMP DEFAULT NOW())"
            )
        )
        conn.execute(
            text(
                f"INSERT INTO {RAW_SCHEMA}._ingestion_log "
                "(filename, row_count, checksum, batch_id) "
                "VALUES (:filename, :row_count, :checksum, :batch_id)"
            ),
            {
                "filename": filename,
                "row_count": row_count,
                "checksum": checksum,
                "batch_id": batch_id,
            },
        )
    logger.info(f"Logged ingestion: {filename} ({row_count} rows)")


def get_ingested_checksums() -> set[str]:
    engine = get_engine()
    with engine.begin() as conn:
        result = conn.execute(
            text(
                f"SELECT checksum FROM {RAW_SCHEMA}._ingestion_log"
            )
        )
        return {row[0] for row in result}


def compute_file_checksum(filepath: str) -> str:
    h = hashlib.md5()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def save_api_sync_state(endpoint: str) -> None:
    engine = get_engine()
    with engine.begin() as conn:
        conn.execute(
            text(
                f"CREATE TABLE IF NOT EXISTS {RAW_SCHEMA}._api_sync_state ("
                "endpoint VARCHAR(100) PRIMARY KEY, "
                "last_synced_at TIMESTAMP DEFAULT NOW())"
            )
        )
        conn.execute(
            text(
                f"INSERT INTO {RAW_SCHEMA}._api_sync_state (endpoint, last_synced_at) "
                "VALUES (:endpoint, NOW()) "
                "ON CONFLICT (endpoint) DO UPDATE SET last_synced_at = NOW()"
            ),
            {"endpoint": endpoint},
        )


def get_api_last_synced(endpoint: str) -> datetime | None:
    engine = get_engine()
    with engine.begin() as conn:
        table_exists = conn.execute(
            text(
                "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
                "WHERE table_schema = :schema AND table_name = '_api_sync_state')"
            ),
            {"schema": RAW_SCHEMA},
        ).scalar()
        if not table_exists:
            return None
        result = conn.execute(
            text(
                f"SELECT last_synced_at FROM {RAW_SCHEMA}._api_sync_state "
                "WHERE endpoint = :endpoint"
            ),
            {"endpoint": endpoint},
        )
        row = result.fetchone()
        return row[0] if row else None
