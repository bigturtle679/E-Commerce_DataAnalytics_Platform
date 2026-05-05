"""Batch CSV ingestion pipeline for Olist dataset.

Reads CSVs with enforced dtypes, validates schemas, and upserts into raw.* tables.
Tracks ingested files via checksum to support incremental processing.
Emits pipeline metrics for observability.
"""

import uuid
from pathlib import Path

import pandas as pd

from config.settings import DATASET_PATH, RAW_SCHEMA
from ingestion.batch.dtype_specs import (
    CSV_FILE_MAP,
    DTYPE_SPECS,
    PRIMARY_KEYS,
    TIMESTAMP_COLUMNS,
)
from ingestion.utils.db import (
    compute_file_checksum,
    ensure_schemas,
    get_ingested_checksums,
    log_ingestion,
    upsert_dataframe,
)
from ingestion.utils.logger import get_logger
from ingestion.utils.metrics import track_pipeline

logger = get_logger("batch_ingest")


def _validate_columns(df: pd.DataFrame, table_name: str, expected: dict) -> None:
    expected_cols = set(expected.keys())
    actual_cols = set(df.columns)
    missing = expected_cols - actual_cols
    if missing:
        raise ValueError(f"[{table_name}] Missing columns: {missing}")


def _parse_timestamps(df: pd.DataFrame, table_name: str) -> pd.DataFrame:
    ts_cols = TIMESTAMP_COLUMNS.get(table_name, [])
    for col in ts_cols:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce")
    return df


def ingest_table(table_name: str, batch_id: str) -> int:
    csv_filename = CSV_FILE_MAP[table_name]
    filepath = DATASET_PATH / csv_filename

    if not filepath.exists():
        logger.warning(f"File not found: {filepath}")
        return 0

    # Check if already ingested (incremental)
    checksum = compute_file_checksum(str(filepath))
    try:
        ingested = get_ingested_checksums()
        if checksum in ingested:
            logger.info(f"Skipping {csv_filename} — already ingested (checksum match)")
            return 0
    except Exception:
        pass  # Table may not exist on first run

    logger.info(f"Reading {csv_filename}")
    dtype_spec = DTYPE_SPECS[table_name]
    df = pd.read_csv(filepath, dtype=dtype_spec, na_values=["", "NA", "null"])

    _validate_columns(df, table_name, dtype_spec)
    df = _parse_timestamps(df, table_name)

    row_count = upsert_dataframe(
        df=df,
        table_name=table_name,
        schema=RAW_SCHEMA,
        conflict_columns=PRIMARY_KEYS[table_name],
        batch_id=batch_id,
    )

    log_ingestion(csv_filename, row_count, checksum, batch_id)
    return row_count


def run_batch_ingestion() -> dict[str, int]:
    ensure_schemas()
    batch_id = str(uuid.uuid4())[:8]
    logger.info(f"Starting batch ingestion — batch_id={batch_id}")

    results = {}
    total_rows = 0
    for table_name in CSV_FILE_MAP:
        with track_pipeline("batch_ingestion", table_name) as ctx:
            try:
                count = ingest_table(table_name, batch_id)
                ctx["rows_processed"] = count
                results[table_name] = count
                total_rows += count
                logger.info(f"✓ {table_name}: {count} rows")
            except Exception as e:
                logger.error(f"✗ {table_name}: {e}", exc_info=True)
                results[table_name] = -1
                raise  # re-raise so track_pipeline records failure

    logger.info(f"Batch ingestion complete: {results}")
    return results


if __name__ == "__main__":
    run_batch_ingestion()
