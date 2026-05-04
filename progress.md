# Progress Tracker

> Last updated: 2026-05-04

## Completed Components

### Phase 1: Project Initialization ✅
- Folder structure created (`ingestion/`, `dbt_project/`, `airflow/`, `config/`, `tests/`)
- `requirements.txt` — all dependencies pinned
- `.env` — PostgreSQL, API, paths, retry config
- `config/settings.py` — central config via python-dotenv
- `ingestion/utils/logger.py` — rotating file + stdout logging
- `ingestion/utils/db.py` — engine factory, upsert, ingestion log, API sync state

### Phase 2: Batch Ingestion ✅
- `ingestion/batch/dtype_specs.py` — explicit dtype maps for all 9 Olist CSVs
- `ingestion/batch/ingest_csv.py` — dtype-enforced CSV loader with schema validation
- Incremental: MD5 checksum tracking via `raw._ingestion_log`
- Idempotent: ON CONFLICT DO UPDATE upserts

### Phase 3: API Ingestion ✅
- `ingestion/api/fakestore_client.py` — configurable retry (via .env), HTTP 429/5xx handling, pagination scaffold
- `ingestion/api/ingest_api.py` — flattens nested JSON, upserts into `raw.api_*`
- Sync state tracking via `raw._api_sync_state`

### Phase 4: Data Modeling (dbt) ✅
- **Staging batch** (7 models): orders, order_items, customers, products, sellers, payments, reviews
  - All follow standard: snake_case, explicit CAST, COALESCE nulls, ROW_NUMBER dedup
- **Staging API** (3 models): products, users, carts (with JSON array flattening)
- **Dimensions** (4): customers, products, sellers, dates
  - SCD2-ready schema (valid_from, valid_to, is_current) — logic not active
  - Customers + Products merge batch + API at dim layer
- **Facts** (2): order_items, order_payments
  - Incremental via `is_incremental()` + `_loaded_at`
- Schema tests: not_null, unique, accepted_values on all models

### Phase 5: Orchestration (Airflow) ✅
- Single DAG: `ecommerce_data_pipeline`
- 8 separate tasks (no monolithic tasks):
  - create_schemas → [ingest_batch, ingest_api_products, ingest_api_users, ingest_api_carts] → dbt_staging → dbt_analytics → dbt_test
- Idempotent, retries=2, max_active_runs=1
- Executor-agnostic (PythonOperator + BashOperator)

### Phase 6: Production Enhancements ✅
- Logging: structured, file-rotated (10MB × 5 backups)
- Tests: `test_ingestion.py` (schema validation, API shape, config), `test_dbt.py` (debug/compile/test)
- Incremental processing: checksum tracking (batch), sync state (API), dbt incremental (facts)

## Architecture State

```
[Olist CSVs (9 files)] ──→ ingest_csv.py ──→ raw.{orders, order_items, customers, ...}
[FakeStore API (3 endpoints)] ──→ ingest_api.py ──→ raw.{api_products, api_users, api_carts}
                                                              │
                                              dbt staging (10 models, views)
                                              ├── batch/stg_*_batch (7)
                                              └── api/stg_*_api (3)
                                                              │
                                              dbt analytics (6 models, tables)
                                              ├── dim_customers, dim_products, dim_sellers, dim_dates
                                              └── fact_order_items, fact_order_payments
```

## Database Schema Summary

| Schema | Tables | Purpose |
|--------|--------|---------|
| `raw` | 12 data tables + 2 meta tables | Raw ingested data + tracking |
| `staging` | 10 views | Cleaned, typed, deduplicated |
| `analytics` | 6 tables | Star schema (4 dims + 2 facts) |

### Raw Tables
- `orders`, `order_items`, `customers`, `products`, `sellers`, `order_payments`, `order_reviews`, `geolocation`, `product_category_translation`
- `api_products`, `api_users`, `api_carts`
- `_ingestion_log` (file tracking), `_api_sync_state` (endpoint tracking)

## Pipeline Flow

```
1. ensure_schemas() → creates raw/staging/analytics schemas
2. run_batch_ingestion() → reads 9 CSVs → upserts into raw.* (skips if checksum matches)
3. run_api_ingestion() → fetches 3 endpoints → flattens → upserts into raw.api_*
4. dbt run --select staging → creates 10 staging views
5. dbt run --select analytics → creates 4 dims + 2 facts
6. dbt test → runs all schema tests
```

## Key Design Decisions

1. **Explicit dtypes** — no pandas inference; every column declared in `dtype_specs.py`
2. **Separate staging** — batch and API data stay independent until dimension layer
3. **SCD2 schema-only** — columns present for future implementation, not active
4. **File checksum incremental** — `_ingestion_log` tracks MD5 hashes; already-ingested files skipped
5. **Configurable retry** — all API retry params in `.env`; exponential backoff with HTTP status awareness
6. **Idempotent pipeline** — upserts everywhere; safe to rerun any step

## Pending Tasks

- None — all 6 phases complete

## Assumptions

1. PostgreSQL accessible at localhost:5432 with database `ecommerce`
2. Python 3.10+ installed
3. Olist CSVs in `../dataset/` relative to project root
4. FakeStore API available at https://fakestoreapi.com
5. Airflow uses SequentialExecutor for local dev

## How to Resume

1. Read this file
2. Check `.env` for config
3. Check `config/settings.py` for all settings
4. Run `python -m pytest tests/test_ingestion.py -v` to verify setup
5. Run `python -m ingestion.batch.ingest_csv` to test batch pipeline
6. Run `python -m ingestion.api.ingest_api` to test API pipeline
