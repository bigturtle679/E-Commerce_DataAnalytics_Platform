"""20-minute live pipeline simulation for Meridian dashboard.

Drip-feeds CSV data in timed batches with real pipeline metrics,
API enrichment (ViaCEP + FX rates), and intentional failures —
making the dashboard come alive in real-time.

Usage:
    python -m scripts.simulate_pipeline              # default 20 minutes
    python -m scripts.simulate_pipeline --duration 10 # faster 10-minute run
    python -m scripts.simulate_pipeline --fast        # 5-minute quick demo
"""

import argparse
import math
import random
import sys
import time
import uuid
from datetime import UTC, datetime

import pandas as pd
from sqlalchemy import text

from config.settings import DATASET_PATH, RAW_SCHEMA, STAGING_SCHEMA, ANALYTICS_SCHEMA
from ingestion.batch.dtype_specs import CSV_FILE_MAP, DTYPE_SPECS, PRIMARY_KEYS, TIMESTAMP_COLUMNS
from ingestion.utils.db import ensure_schemas, get_engine, upsert_dataframe
from ingestion.utils.logger import get_logger
from ingestion.utils.metrics import record_metric, track_pipeline

logger = get_logger("simulation")

# ── Constants ──────────────────────────────────────────────────────

# Phase definitions: (phase_name, tables, weight in total timeline)
PHASES = [
    ("reference",    ["product_category_translation", "products", "sellers"], 0.08),
    ("customers",    ["customers"],                                           0.15),
    ("orders",       ["orders"],                                              0.20),
    ("order_items",  ["order_items"],                                         0.17),
    ("payments",     ["order_payments"],                                      0.10),
    ("reviews",      ["order_reviews"],                                       0.08),
    ("geolocation",  ["geolocation"],                                         0.07),
    ("enrichment",   [],                                                      0.05),
    ("transform_1",  [],                                                      0.03),
    ("transform_2",  [],                                                      0.04),
    ("final",        [],                                                      0.03),
]

# How many batches to split each table into
BATCH_COUNTS = {
    "product_category_translation": 1,
    "products": 2,
    "sellers": 1,
    "customers": 4,
    "orders": 5,
    "order_items": 5,
    "order_payments": 3,
    "order_reviews": 3,
    "geolocation": 2,
}

# Tables that should have a simulated failure on a specific batch
FAILURE_INJECTION = {
    "order_items": 2,   # Fail on batch 2 of order_items
    "order_reviews": 1, # Fail on batch 1 of order_reviews
}


# ── Database Reset ─────────────────────────────────────────────────

def reset_database():
    """Truncate all raw/staging/analytics tables for a clean simulation start."""
    engine = get_engine()
    ensure_schemas()

    logger.info("🗑  Resetting database for simulation...")

    with engine.begin() as conn:
        # Drop analytics tables
        for table in [
            "fact_order_items", "fact_order_payments",
            "dim_customers", "dim_products", "dim_sellers",
            "dim_dates", "dim_geography",
        ]:
            conn.execute(text(f"DROP TABLE IF EXISTS {ANALYTICS_SCHEMA}.{table} CASCADE"))

        # Drop staging views
        for view in [
            "stg_orders_batch", "stg_order_items_batch", "stg_customers_batch",
            "stg_products_batch", "stg_sellers_batch", "stg_payments_batch",
            "stg_reviews_batch", "stg_cep_enrichment", "stg_fx_rates",
        ]:
            conn.execute(text(f"DROP VIEW IF EXISTS {STAGING_SCHEMA}.{view} CASCADE"))

        # Truncate raw tables (keep structure, clear data)
        for table in [
            "orders", "order_items", "customers", "products", "sellers",
            "order_payments", "order_reviews", "geolocation",
            "product_category_translation",
        ]:
            try:
                conn.execute(text(f"TRUNCATE TABLE {RAW_SCHEMA}.{table} CASCADE"))
            except Exception:
                pass  # Table may not exist yet

        # Clear enrichment tables
        for table in ["cep_enrichment", "fx_rates"]:
            try:
                conn.execute(text(f"TRUNCATE TABLE {RAW_SCHEMA}.{table} CASCADE"))
            except Exception:
                pass

        # Clear pipeline metrics & ingestion log (fresh timeline)
        try:
            conn.execute(text(f"TRUNCATE TABLE {RAW_SCHEMA}._pipeline_metrics CASCADE"))
        except Exception:
            pass
        try:
            conn.execute(text(f"TRUNCATE TABLE {RAW_SCHEMA}._ingestion_log CASCADE"))
        except Exception:
            pass

    logger.info("✓ Database reset complete")


# ── CSV Loading Helpers ────────────────────────────────────────────

def load_csv(table_name: str) -> pd.DataFrame:
    """Read a CSV file for the given table with proper dtypes."""
    csv_filename = CSV_FILE_MAP[table_name]
    filepath = DATASET_PATH / csv_filename

    if not filepath.exists():
        raise FileNotFoundError(f"CSV not found: {filepath}")

    dtype_spec = DTYPE_SPECS[table_name]
    df = pd.read_csv(filepath, dtype=dtype_spec, na_values=["", "NA", "null"])

    # Parse timestamp columns
    ts_cols = TIMESTAMP_COLUMNS.get(table_name, [])
    for col in ts_cols:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce")

    return df


def ingest_batch(
    df: pd.DataFrame,
    table_name: str,
    batch_num: int,
    total_batches: int,
    batch_id: str,
    simulate_failure: bool = False,
) -> int:
    """Ingest a single batch of a DataFrame, recording real pipeline metrics."""

    task_label = f"{table_name}_batch_{batch_num}_of_{total_batches}"

    with track_pipeline("simulation", task_label) as ctx:
        if simulate_failure:
            ctx["rows_processed"] = 0
            logger.warning(f"💥 Simulated failure on {task_label}")
            raise RuntimeError(
                f"Simulated transient error: connection timeout on batch "
                f"{batch_num}/{total_batches} of {table_name}"
            )

        row_count = upsert_dataframe(
            df=df,
            table_name=table_name,
            schema=RAW_SCHEMA,
            conflict_columns=PRIMARY_KEYS[table_name],
            batch_id=batch_id,
        )
        ctx["rows_processed"] = row_count

    return row_count


# ── Transform Runner ───────────────────────────────────────────────

def run_transforms(label: str):
    """Run staging views + analytics tables, recording metrics."""
    from scripts.materialize_models import run

    with track_pipeline("simulation", f"transform_{label}") as ctx:
        run()
        ctx["rows_processed"] = 0  # transforms don't count rows directly

    logger.info(f"✓ Transforms complete ({label})")


# ── API Enrichment ─────────────────────────────────────────────────

def run_enrichment_phase():
    """Run API enrichment (ViaCEP + FX rates) with real HTTP calls."""
    logger.info("🌐 Starting API enrichment phase...")

    # FX rates (fast — single HTTP call)
    try:
        from ingestion.api.fx_client import run_fx_enrichment
        fx_count = run_fx_enrichment()
        logger.info(f"✓ FX enrichment: {fx_count} rates fetched")
    except Exception as e:
        logger.warning(f"⚠ FX enrichment skipped: {e}")

    # ViaCEP (limit to 50 CEPs for simulation speed — ~8 seconds)
    try:
        from ingestion.api.viacep_client import enrich_ceps
        with track_pipeline("simulation", "viacep_enrichment") as ctx:
            cep_count = enrich_ceps(limit=50)
            ctx["rows_processed"] = cep_count
        logger.info(f"✓ CEP enrichment: {cep_count} CEPs fetched")
    except Exception as e:
        logger.warning(f"⚠ CEP enrichment skipped: {e}")


# ── Main Simulation ───────────────────────────────────────────────

def simulate(duration_minutes: float = 20.0):
    """Run the full pipeline simulation over the specified duration."""
    total_seconds = duration_minutes * 60
    start_time = time.monotonic()

    print()
    print("=" * 60)
    print(f"  🚀 MERIDIAN PIPELINE SIMULATION")
    print(f"  Duration: {duration_minutes:.0f} minutes ({total_seconds:.0f}s)")
    print(f"  Started:  {datetime.now().strftime('%H:%M:%S')}")
    print("=" * 60)
    print()

    # ── Step 1: Reset ──────────────────────────────────────────
    reset_database()

    # Record a "simulation_start" metric so the dashboard has something
    record_metric(
        pipeline_name="simulation",
        task_name="initialization",
        status="success",
        rows_processed=0,
        duration_sec=time.monotonic() - start_time,
        started_at=datetime.now(UTC),
        completed_at=datetime.now(UTC),
    )

    # ── Step 2: Build schedule ─────────────────────────────────
    # Pre-load all CSVs into memory for fast batching
    csv_data: dict[str, pd.DataFrame] = {}
    for table_name in CSV_FILE_MAP:
        try:
            csv_data[table_name] = load_csv(table_name)
            logger.info(f"📄 Loaded {table_name}: {len(csv_data[table_name])} rows")
        except FileNotFoundError as e:
            logger.warning(f"⚠ {e}")

    # Calculate total number of ingestion batches
    total_batches = sum(
        BATCH_COUNTS.get(t, 1) for t in csv_data
    )
    # Time per batch (with some buffer for transforms + enrichment)
    ingestion_fraction = 0.75  # 75% of time for ingestion, 25% for transforms/enrichment
    seconds_per_batch = (total_seconds * ingestion_fraction) / max(total_batches, 1)

    logger.info(
        f"Schedule: {total_batches} batches, "
        f"~{seconds_per_batch:.1f}s between batches"
    )

    # ── Step 3: Execute phases ─────────────────────────────────
    batch_global = 0
    batch_id = str(uuid.uuid4())[:8]

    # --- Phase 1: Reference data (small tables, fast) ---
    phase_header("Phase 1: Reference Data", start_time, total_seconds)
    for table_name in ["product_category_translation", "products", "sellers"]:
        if table_name not in csv_data:
            continue
        df = csv_data[table_name]
        count = ingest_batch(df, table_name, 1, 1, batch_id)
        batch_global += 1
        log_progress(table_name, count, 1, 1, batch_global, total_batches, start_time, total_seconds)
        wait_between_batches(seconds_per_batch * 0.5)  # Fast for small tables

    # --- Phase 2: Core transactional data (interleaved) ---
    phase_header("Phase 2: Core Data (Customers + Orders + Items)", start_time, total_seconds)

    core_tables = ["customers", "orders", "order_items"]
    core_batches: dict[str, list[pd.DataFrame]] = {}
    for table_name in core_tables:
        if table_name not in csv_data:
            continue
        n_batches = BATCH_COUNTS.get(table_name, 3)
        df = csv_data[table_name]
        # Shuffle to simulate non-sequential ingestion
        df = df.sample(frac=1, random_state=42).reset_index(drop=True)
        core_batches[table_name] = split_dataframe(df, n_batches)

    # Interleave: customers first (needed as FK), then orders + items together
    max_core_batches = max(len(v) for v in core_batches.values())
    for i in range(max_core_batches):
        for table_name in core_tables:
            if table_name not in core_batches:
                continue
            batches = core_batches[table_name]
            if i >= len(batches):
                continue

            batch_num = i + 1
            n_total = len(batches)
            should_fail = (
                table_name in FAILURE_INJECTION
                and batch_num == FAILURE_INJECTION[table_name]
            )

            # If failure, attempt fails first, then retry succeeds
            if should_fail:
                try:
                    ingest_batch(
                        batches[i], table_name, batch_num, n_total,
                        batch_id, simulate_failure=True,
                    )
                except RuntimeError:
                    logger.info(f"🔄 Retrying {table_name} batch {batch_num}...")
                    wait_between_batches(2)  # Brief retry delay

            count = ingest_batch(
                batches[i], table_name, batch_num, n_total, batch_id,
            )
            batch_global += 1
            log_progress(table_name, count, batch_num, n_total, batch_global, total_batches, start_time, total_seconds)
            wait_between_batches(seconds_per_batch)

    # --- Phase 3: Supporting data ---
    phase_header("Phase 3: Supporting Data (Payments + Reviews + Geo)", start_time, total_seconds)
    for table_name in ["order_payments", "order_reviews", "geolocation"]:
        if table_name not in csv_data:
            continue
        n_batches = BATCH_COUNTS.get(table_name, 2)
        df = csv_data[table_name]
        batches = split_dataframe(df, n_batches)

        for i, batch_df in enumerate(batches):
            batch_num = i + 1
            should_fail = (
                table_name in FAILURE_INJECTION
                and batch_num == FAILURE_INJECTION[table_name]
            )

            if should_fail:
                try:
                    ingest_batch(
                        batch_df, table_name, batch_num, n_batches,
                        batch_id, simulate_failure=True,
                    )
                except RuntimeError:
                    logger.info(f"🔄 Retrying {table_name} batch {batch_num}...")
                    wait_between_batches(2)

            count = ingest_batch(
                batch_df, table_name, batch_num, n_batches, batch_id,
            )
            batch_global += 1
            log_progress(table_name, count, batch_num, n_batches, batch_global, total_batches, start_time, total_seconds)
            wait_between_batches(seconds_per_batch)

    # --- Phase 4: First transform ---
    phase_header("Phase 4: Staging + Analytics (First Build)", start_time, total_seconds)
    run_transforms("initial")

    # --- Phase 5: API Enrichment ---
    phase_header("Phase 5: API Enrichment (ViaCEP + FX Rates)", start_time, total_seconds)
    run_enrichment_phase()

    # --- Phase 6: Final transform (with enrichment data) ---
    phase_header("Phase 6: Final Transform (with enrichment)", start_time, total_seconds)
    run_transforms("final")

    # ── Step 4: Wait for remaining time ────────────────────────
    elapsed = time.monotonic() - start_time
    remaining = total_seconds - elapsed
    if remaining > 5:
        logger.info(f"⏳ Simulation data complete. Holding for {remaining:.0f}s remaining...")
        # Record periodic "heartbeat" metrics so the dashboard stays animated
        heartbeats = max(1, int(remaining / 30))
        for hb in range(heartbeats):
            record_metric(
                pipeline_name="simulation",
                task_name=f"heartbeat_{hb + 1}",
                status="success",
                rows_processed=0,
                duration_sec=0.1,
                started_at=datetime.now(UTC),
                completed_at=datetime.now(UTC),
            )
            if hb < heartbeats - 1:
                time.sleep(min(30, remaining / heartbeats))

    # ── Done ───────────────────────────────────────────────────
    total_elapsed = time.monotonic() - start_time
    total_rows = sum(len(df) for df in csv_data.values())

    print()
    print("=" * 60)
    print(f"  ✅ SIMULATION COMPLETE")
    print(f"  Duration:   {total_elapsed / 60:.1f} minutes")
    print(f"  Total rows: {total_rows:,}")
    print(f"  Batches:    {batch_global}")
    print(f"  Failures:   {len(FAILURE_INJECTION)} (simulated + recovered)")
    print(f"  Finished:   {datetime.now().strftime('%H:%M:%S')}")
    print("=" * 60)
    print()


# ── Utility Functions ──────────────────────────────────────────────

def split_dataframe(df: pd.DataFrame, n: int) -> list[pd.DataFrame]:
    """Split a DataFrame into n roughly equal chunks."""
    chunk_size = math.ceil(len(df) / n)
    return [df.iloc[i * chunk_size:(i + 1) * chunk_size] for i in range(n)]


def wait_between_batches(seconds: float):
    """Sleep with a small random jitter for realism."""
    jitter = random.uniform(-0.5, 0.5) * min(seconds * 0.1, 2.0)
    actual = max(0.5, seconds + jitter)
    time.sleep(actual)


def phase_header(title: str, start_time: float, total_seconds: float):
    """Print a phase separator with elapsed/remaining time."""
    elapsed = time.monotonic() - start_time
    pct = min(100, (elapsed / total_seconds) * 100)
    print()
    print(f"  {'─' * 50}")
    print(f"  ▶ {title}")
    print(f"    [{pct:5.1f}%] {elapsed / 60:.1f}m elapsed / {(total_seconds - elapsed) / 60:.1f}m remaining")
    print(f"  {'─' * 50}")


def log_progress(
    table: str, count: int, batch: int, total: int,
    global_batch: int, global_total: int,
    start_time: float, total_seconds: float,
):
    """Log a batch completion with progress bar."""
    elapsed = time.monotonic() - start_time
    pct = min(100, (global_batch / global_total) * 100)
    bar_len = 25
    filled = int(bar_len * pct / 100)
    bar = "█" * filled + "░" * (bar_len - filled)

    logger.info(
        f"  [{bar}] {pct:5.1f}% | {table} batch {batch}/{total} "
        f"({count:,} rows) | {elapsed / 60:.1f}m"
    )


# ── Entry Point ────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Run a live pipeline simulation for the Meridian dashboard.",
    )
    parser.add_argument(
        "--duration", type=float, default=20.0,
        help="Simulation duration in minutes (default: 20)",
    )
    parser.add_argument(
        "--fast", action="store_true",
        help="Quick 5-minute demo mode",
    )
    args = parser.parse_args()

    duration = 5.0 if args.fast else args.duration
    simulate(duration_minutes=duration)


if __name__ == "__main__":
    main()
