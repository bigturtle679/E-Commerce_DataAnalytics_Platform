# Multi-Source E-commerce Data Platform

Production-grade data platform ingesting e-commerce data from batch CSVs (Brazilian Olist dataset) and a live API (FakeStore), transforming via dbt into a star schema, orchestrated by Airflow.

## Architecture

```
                  ┌─────────────────┐      ┌─────────────────────────────┐
                  │  Olist CSVs (9) │      │  FakeStore API (3 endpoints)│
                  └────────┬────────┘      └────────────┬────────────────┘
                           │                            │
                   dtype-enforced                  retry + backoff
                   MD5 checksum                    sync state tracking
                           │                            │
                           ▼                            ▼
              ┌──────────────────────────────────────────────┐
              │        PostgreSQL — raw schema (12 tables)   │
              │   orders, order_items, customers, products,  │
              │   sellers, payments, reviews, geolocation,   │
              │   category_translation, api_products,        │
              │   api_users, api_carts                       │
              │   + _ingestion_log, _api_sync_state,         │
              │     _pipeline_metrics                        │
              └──────────────────┬───────────────────────────┘
                                 │
                          dbt staging (10 views)
                    ┌────────────┴────────────┐
                    │ batch/ (7)    api/ (3)   │
                    │ stg_*_batch   stg_*_api  │
                    └────────────┬─────────────┘
                                 │
                          dbt analytics (6 tables)
                    ┌────────────┴────────────────┐
                    │ Dimensions         Facts     │
                    │ dim_customers   fact_order_*  │
                    │ dim_products    (incremental) │
                    │ dim_sellers                   │
                    │ dim_dates                     │
                    └──────────────────────────────┘
                                 │
                    ┌────────────┴───────────┐
                    │   Post-Transform       │
                    │   - dbt test           │
                    │   - Index creation     │
                    │   - Source freshness   │
                    └────────────────────────┘
                                 │
                          Airflow DAG
                    (daily, idempotent, 10 tasks)
```

## Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Language | Python 3.10+ | Ingestion, orchestration glue |
| Warehouse | PostgreSQL | OLAP storage, raw + star schema |
| Transformations | dbt-core 1.8 (postgres adapter) | SQL-based ELT modeling |
| Orchestration | Apache Airflow 2.9 | DAG scheduling, task dependencies |
| Libraries | pandas, sqlalchemy, psycopg2, requests | Data manipulation, DB access, HTTP |

## Quick Start

### Prerequisites
- Python 3.10+
- PostgreSQL running on localhost:5432
- Database `ecommerce` created

### Setup
```bash
cd ecommerce-data-platform
pip install -r requirements.txt
```

### Configure
Edit `.env` with your PostgreSQL credentials.

### Run Manually
```bash
# Batch ingestion
python -m ingestion.batch.ingest_csv

# API ingestion
python -m ingestion.api.ingest_api

# dbt transformations
cd dbt_project
dbt run --profiles-dir .
dbt test --profiles-dir .
dbt source freshness --profiles-dir .

# Performance optimization (indexes)
python -m ingestion.utils.performance
```

### Run via Airflow
```bash
export AIRFLOW_HOME=$(pwd)/airflow
airflow db init
airflow dags trigger ecommerce_data_pipeline
```

### Run Tests
```bash
python -m pytest tests/ -v
```

## Project Structure

```
ecommerce-data-platform/
├── ingestion/              # Python ingestion layer
│   ├── batch/              # CSV batch ingestion (Olist)
│   │   ├── ingest_csv.py   # Dtype-enforced CSV loader
│   │   └── dtype_specs.py  # Column type definitions for all 9 CSVs
│   ├── api/                # FakeStore API ingestion
│   │   ├── ingest_api.py   # Flatten JSON → upsert
│   │   └── fakestore_client.py  # HTTP client with retry
│   └── utils/              # Shared utilities
│       ├── db.py           # Engine, upsert, checksum, sync state
│       ├── logger.py       # Rotating file + stdout logging
│       ├── metrics.py      # Pipeline observability (rows, timing, status)
│       └── performance.py  # Index creation + partitioning strategy
├── dbt_project/            # dbt models
│   ├── models/
│   │   ├── sources.yml     # Source definitions + freshness config
│   │   ├── staging/        # 10 staging views (batch/ + api/)
│   │   │   ├── schema.yml  # Staging tests
│   │   │   ├── batch/      # 7 batch staging models
│   │   │   └── api/        # 3 API staging models
│   │   └── analytics/      # 6 analytics tables (star schema)
│   │       └── schema.yml  # Dim/fact tests + referential integrity
│   ├── macros/             # Custom dbt macros
│   ├── dbt_project.yml     # Project config
│   └── profiles.yml        # Connection profiles
├── airflow/dags/           # Orchestration (10-task DAG)
├── config/settings.py      # Central config via .env
├── tests/                  # Pytest test suite
├── logs/                   # Rotating log files
└── dataset/                # Olist CSV files (external)
```

## Star Schema

```
                    ┌──────────────┐
                    │  dim_dates   │
                    │  (date_key)  │
                    └──────┬───────┘
                           │
┌──────────────┐   ┌───────┴────────────┐   ┌──────────────┐
│dim_customers │───│  fact_order_items   │───│ dim_products  │
│(customer_key)│   │  (order_item_key)   │   │(product_key)  │
└──────────────┘   └───────┬────────────┘   └──────────────┘
       │                   │
       │           ┌───────┴────────────┐   ┌──────────────┐
       └───────────│ fact_order_payments │   │ dim_sellers   │
                   │  (payment_key)     │   │ (seller_key)  │
                   └────────────────────┘   └──────────────┘
```

| Model | Type | Materialization | Source |
|-------|------|-----------------|--------|
| dim_customers | Dimension | Table | Olist + FakeStore (merged) |
| dim_products | Dimension | Table | Olist + FakeStore (merged) |
| dim_sellers | Dimension | Table | Olist only |
| dim_dates | Dimension | Table | Generated (2016–2019) |
| fact_order_items | Fact | Incremental | Olist orders × items |
| fact_order_payments | Fact | Incremental | Olist payments |

## Design Decisions

### 1. Explicit Dtype Enforcement
**Decision**: Every CSV column type is declared in `dtype_specs.py` — no pandas type inference.
**Rationale**: Pandas silently coerces mixed-type columns (e.g., zip codes with leading zeros become integers). Explicit dtypes prevent data corruption at the earliest stage.
**Trade-off**: Requires maintenance when source schemas change, but the failure is loud and immediate rather than silent and downstream.

### 2. Separate Staging for Batch and API
**Decision**: Batch and API data are staged independently (`stg_*_batch`, `stg_*_api`) and merged only at the dimension layer.
**Rationale**: Source systems have fundamentally different schemas, update cadences, and quality profiles. Separate staging lets us apply source-specific cleaning (e.g., dedup via ROW_NUMBER for batch, JSON flattening for API) without cross-contamination.
**Trade-off**: More models to maintain (10 vs. ~6 if merged early), but dramatically simpler debugging when source-specific issues arise.

### 3. SCD Type 2 Schema-Ready (Not Active)
**Decision**: Dimension tables include `valid_from`, `valid_to`, and `is_current` columns, but the SCD2 logic is not yet active — all rows are `is_current = true`.
**Rationale**: Adding these columns now is cheap. Retrofitting them later (when dimension history becomes a requirement) would require a migration and backfill across all dependent fact tables. The schema is forward-compatible.
**Trade-off**: Slight schema complexity for tables that currently behave as Type 1.

### 4. File Checksum Incremental Processing
**Decision**: Batch ingestion tracks MD5 hashes of CSV files in `_ingestion_log`. Already-ingested files are skipped.
**Rationale**: Re-running the pipeline on unchanged data should be a no-op. Checksums provide this guarantee without relying on file timestamps (which are unreliable across systems).
**Trade-off**: MD5 is not cryptographically secure, but collision probability for data integrity checks is negligible.

### 5. Coalesce to -1 for Missing Dimension Keys
**Decision**: Fact tables use `COALESCE(dim_key, -1)` when dimension lookups fail (late-arriving facts).
**Rationale**: Ensures fact rows are never dropped due to missing dimensions. The `-1` sentinel key is queryable and filterable, making it easy to monitor data quality. This is a standard Kimball pattern.
**Trade-off**: Requires analysts to be aware that `-1` means "unresolved". Referential integrity tests exclude `-1` rows.

### 6. Idempotent Everything
**Decision**: Every step is safe to re-run — upserts (ON CONFLICT DO UPDATE), IF NOT EXISTS for schemas/tables/indexes, checksum skipping.
**Rationale**: In production pipelines, retries are inevitable (network issues, partial failures, Airflow task re-runs). Idempotency means retries never produce duplicates or corruption.

## Observability

### Pipeline Metrics
Every ingestion task (batch and API) is wrapped in a `track_pipeline()` context manager that automatically records:
- **rows_processed**: count of rows ingested per task
- **duration_sec**: wall-clock execution time
- **status**: `success` or `failure`
- **error_message**: captured on failure (truncated to 500 chars)

Metrics are stored in `raw._pipeline_metrics` and can be queried:
```sql
-- Recent pipeline runs
SELECT pipeline_name, task_name, status, rows_processed, duration_sec, started_at
FROM raw._pipeline_metrics
ORDER BY started_at DESC
LIMIT 20;

-- Failure rate by task
SELECT task_name,
       COUNT(*) FILTER (WHERE status = 'success') AS successes,
       COUNT(*) FILTER (WHERE status = 'failure') AS failures,
       ROUND(AVG(duration_sec), 2) AS avg_duration_sec
FROM raw._pipeline_metrics
GROUP BY task_name;
```

### Source Freshness
dbt source freshness checks run as the final DAG task. Sources are expected to be refreshed within:
- **Warn**: 36 hours since last `_loaded_at`
- **Error**: 72 hours since last `_loaded_at`

Static tables (geolocation, product_category_translation) are excluded from freshness checks.

### Logging
Structured rotating logs (10MB × 5 backups) per module in `logs/`. Format:
```
2026-05-04 14:30:00 | batch_ingest | INFO | ✓ orders: 99441 rows
```

## Data Quality

### dbt Tests
Three layers of data quality validation:

| Layer | Test Type | Examples |
|-------|-----------|---------|
| **Staging** | Schema validation | not_null, unique, accepted_values on key columns |
| **Analytics** | Null/uniqueness | Surrogate keys are not_null + unique |
| **Analytics** | Referential integrity | fact FK → dim PK via `relationships` tests |

Referential integrity tests use `where: "key != -1"` to exclude sentinel values from late-arriving facts.

### Freshness Validation
Source freshness is tracked via `_loaded_at` timestamps on all raw tables. `dbt source freshness` validates data currency.

## Performance Optimization

### Indexes
Indexes are created idempotently (`CREATE INDEX IF NOT EXISTS`) on:
- **Fact FK columns**: `customer_key`, `product_key`, `seller_key`, `order_date_key`
- **Fact lookup columns**: `order_id`, `payment_type`
- **Fact timestamps**: `_loaded_at` (used by incremental logic)
- **Dimension natural keys**: `customer_id`, `product_id`, `seller_id`, `full_date`
- **SCD2 filter**: `is_current` on dimensions
- **Raw timestamps**: `_loaded_at` on all raw tables (freshness queries)

### Partitioning Strategy
Fact tables are candidates for PostgreSQL native range partitioning by `order_date_key` (YYYYMMDD integer), partitioned into yearly buckets. This is **documented but not auto-applied** because:
1. PostgreSQL requires table recreation for partitioning existing tables
2. The current dataset (2016–2019, ~100K rows) doesn't yet warrant the complexity
3. When data volume grows past ~10M rows, apply partitioning during a maintenance window

See `ingestion/utils/performance.py` for ready-to-use partition DDL.

## Scaling Strategy

### Current State (Single-Node)
The platform runs on a single PostgreSQL instance with Airflow SequentialExecutor. This is appropriate for:
- Dataset size: ~100K order rows, ~30K customers, ~32K products
- Update frequency: daily batch
- Query concurrency: low (analytics team)

### Scaling Path
| Growth Stage | Trigger | Action |
|-------------|---------|--------|
| **10× data** | >1M rows in facts | Apply partitioning on fact tables; switch to CeleryExecutor |
| **100× data** | >10M rows | Migrate to columnar storage (Redshift/BigQuery); consider Spark for ingestion |
| **Real-time** | Sub-hour SLA | Add Kafka/CDC for streaming ingestion; keep batch as backfill |
| **Multi-tenant** | Multiple data consumers | Add dbt exposures; implement row-level security |

### What We'd Change
1. **Ingestion**: Replace row-by-row upserts with COPY-based bulk loads + staging tables for 10-100× throughput
2. **Orchestration**: Move from SequentialExecutor to CeleryExecutor or KubernetesExecutor
3. **Storage**: Add columnar indexes or migrate to a columnar warehouse
4. **Caching**: Add a semantic layer (dbt metrics / Cube.js) for repeated analytical queries

## Failure Handling

### Ingestion Failures
- **CSV file missing**: Logged as warning, skipped (non-blocking)
- **Schema mismatch**: Raises `ValueError` with explicit column diff
- **API timeout/5xx**: Exponential backoff retry (configurable via `.env`: max attempts, base delay, factor)
- **API rate limit (429)**: Honors `Retry-After` header; falls back to backoff
- **Database connection**: SQLAlchemy `pool_pre_ping` detects stale connections

### Transformation Failures
- **dbt model failure**: Airflow retries 2× with 5-minute delay
- **dbt test failure**: Logged but does not block index creation or freshness check
- **Incremental overlap**: `_loaded_at` watermark ensures no duplicate processing

### Operational Recovery
- **Full re-run**: Safe due to idempotency (upserts, IF NOT EXISTS, checksum skipping)
- **Partial failure**: Airflow task-level retry; downstream tasks wait for all upstreams
- **Data backfill**: Run `dbt run --full-refresh --select <model>` to rebuild from scratch
- **Metric inspection**: Query `raw._pipeline_metrics` for failure details and timing

## Pipeline Flow (DAG)

```
create_schemas
      │
      ├── ingest_batch_csv
      ├── ingest_api_products
      ├── ingest_api_users
      └── ingest_api_carts
              │
        dbt_run_staging
              │
        dbt_run_analytics
              │
          dbt_test
              │
      ├── create_indexes
      └── dbt_source_freshness
```

10 tasks, daily schedule, `max_active_runs=1`, retries=2, execution timeout=1h.
