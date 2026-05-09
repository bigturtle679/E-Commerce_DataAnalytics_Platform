# Progress Tracker

> Last updated: 2026-05-08

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
- 10 tasks (expanded from 8):
  - create_schemas → [ingest_batch, ingest_api_products, ingest_api_users, ingest_api_carts] → dbt_staging → dbt_analytics → dbt_test → [create_indexes, dbt_source_freshness]
- Idempotent, retries=2, max_active_runs=1
- Executor-agnostic (PythonOperator + BashOperator)

### Phase 6: Production Enhancements ✅
- Logging: structured, file-rotated (10MB × 5 backups)
- Tests: `test_ingestion.py` (schema validation, API shape, config), `test_dbt.py` (debug/compile/test)
- Incremental processing: checksum tracking (batch), sync state (API), dbt incremental (facts)

### Phase 7: Production-Grade Excellence ✅
- **Data Quality Layer**:
  - dbt tests: null checks, uniqueness, accepted_values across staging + analytics
  - Referential integrity: fact FK → dim PK via `relationships` tests (with -1 sentinel exclusion)
  - Source freshness: `_loaded_at` based, warn at 36h, error at 72h (static tables excluded)
- **Observability**:
  - `ingestion/utils/metrics.py` — `track_pipeline()` context manager
  - Tracks: rows_processed, duration_sec, status (success/failure), error_message
  - Stored in `raw._pipeline_metrics` table (queryable)
  - Integrated into both batch and API ingestion pipelines
  - `observability/sql/create_views.sql` — SQL views for API consumption
  - `observability/setup.py` — idempotent view creation
- **Performance Optimization**:
  - `ingestion/utils/performance.py` — idempotent index creation
  - Indexes on: FK columns, timestamps (_loaded_at), natural keys, is_current, payment_type
  - Partitioning strategy documented (range by order_date_key, yearly buckets)
  - Integrated into Airflow DAG as post-transform task
- **Documentation Upgrade**:
  - README expanded with: architecture diagram, design decisions with trade-offs,
    observability guide, data quality details, performance strategy, scaling path,
    failure handling, and full DAG flow

### Phase 8: Frontend Platform ✅
- **FastAPI Backend** (`api/`):
  - Read-only API with 4 routers: pipeline, health, analytics, quality
  - Service layer: `database.py` with psycopg2 connection pool
  - Typed Pydantic schemas for all responses
  - Pre-aggregated SQL for analytics (no client-side computation)
  - CORS configured for frontend
  - Endpoints: 14 total across 4 routers
- **Next.js Frontend** (`frontend/`):
  - Next.js 16 with App Router, TypeScript, TailwindCSS v4
  - shadcn/ui components (card, badge, table, tabs, separator, skeleton)
  - Recharts for all visualizations
  - React Query with 30s stale time, 60s polling
  - Dark mode default with toggle
  - 4 pages: Overview, Pipeline, Analytics, Quality
  - Environment-driven API base URL
  - Zero TypeScript errors in production build

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
                                                              │
                                              Post-transform:
                                              ├── dbt test (RI + schema + freshness)
                                              ├── Index creation (FK, timestamp, natural key)
                                              └── Source freshness validation
                                                              │
                                              FastAPI (read-only)
                                              ├── /api/pipeline/* — runs, stats, timeline
                                              ├── /api/health/* — status, freshness, ping
                                              ├── /api/analytics/* — revenue, products, customers, orders, geo
                                              └── /api/quality/* — row-counts, summary, freshness
                                                              │
                                              Next.js Dashboard
                                              ├── / — Overview (health cards, revenue chart, recent runs)
                                              ├── /pipeline — Monitoring (duration, throughput, run history)
                                              ├── /analytics — Business metrics (revenue, orders, customers, geo)
                                              └── /quality — Data quality (freshness, row counts, inventory)
```

## Database Schema Summary

| Schema | Tables | Purpose |
|--------|--------|---------|
| `raw` | 12 data tables + 3 meta tables | Raw ingested data + tracking + metrics |
| `staging` | 10 views | Cleaned, typed, deduplicated |
| `analytics` | 6 tables | Star schema (4 dims + 2 facts) |
| `observability` | 4 views | Pre-aggregated views for API consumption |

### Raw Tables
- `orders`, `order_items`, `customers`, `products`, `sellers`, `order_payments`, `order_reviews`, `geolocation`, `product_category_translation`
- `api_products`, `api_users`, `api_carts`
- `_ingestion_log` (file tracking), `_api_sync_state` (endpoint tracking), `_pipeline_metrics` (observability)

## API Contracts

### Pipeline Router (`/api/pipeline`)
| Method | Endpoint | Response | Description |
|--------|----------|----------|-------------|
| GET | `/runs?limit=50&status=` | `PipelineRun[]` | Recent pipeline runs |
| GET | `/stats` | `TaskStats[]` | Per-task aggregated statistics |
| GET | `/timeline?days=7` | `ThroughputPoint[]` | Hourly throughput |

### Health Router (`/api/health`)
| Method | Endpoint | Response | Description |
|--------|----------|----------|-------------|
| GET | `/status` | `SystemHealth[]` | Per-pipeline health overview |
| GET | `/freshness` | `FreshnessIndicator[]` | Per-source freshness |
| GET | `/ping` | `{status, db}` | Connectivity check |

### Analytics Router (`/api/analytics`)
| Method | Endpoint | Response | Description |
|--------|----------|----------|-------------|
| GET | `/revenue?months=24` | `RevenueDataPoint[]` | Monthly revenue trends |
| GET | `/top-products?limit=10` | `TopProduct[]` | Top products by revenue |
| GET | `/customers?months=24` | `CustomerTrend[]` | Customer growth trends |
| GET | `/orders?months=24` | `OrderGrowth[]` | Order volume + AOV |
| GET | `/geo?limit=20` | `GeoDistribution[]` | Geographic distribution |

### Quality Router (`/api/quality`)
| Method | Endpoint | Response | Description |
|--------|----------|----------|-------------|
| GET | `/row-counts` | `TableRowCount[]` | Row counts per table |
| GET | `/summary` | `QualitySummary` | Overall quality summary |
| GET | `/freshness` | `FreshnessDetail[]` | Per-source freshness status |

## Frontend Architecture Decisions

1. **App Router only** — no Pages Router; all routes under `app/`
2. **Client components only when needed** — pages use `"use client"` for React Query hooks; layout is server component
3. **React Query as sole state** — no Redux/Zustand; query cache is the data store
4. **Pre-aggregated SQL** — all analytics computed server-side; frontend receives final data
5. **Polling over websockets** — 60s refetch interval via React Query; simpler, more reliable
6. **Dark mode default** — localStorage-persisted toggle; `class="dark"` on html element
7. **shadcn/ui base** — Card, Badge, Table, Tabs, Skeleton for consistent UI primitives
8. **Recharts** — AreaChart, BarChart, PieChart with CSS variable colors for theme awareness
9. **Typed everything** — TypeScript interfaces mirror Pydantic schemas exactly
10. **Environment-driven config** — `NEXT_PUBLIC_API_URL` for API base; no hardcoded URLs

## Pipeline Flow

```
1. ensure_schemas() → creates raw/staging/analytics schemas
2. run_batch_ingestion() → reads 9 CSVs → upserts into raw.* (skips if checksum matches)
3. run_api_ingestion() → fetches 3 endpoints → flattens → upserts into raw.api_*
   ↳ Each task wrapped in track_pipeline() → metrics recorded
4. dbt run --select staging → creates 10 staging views
5. dbt run --select analytics → creates 4 dims + 2 facts
6. dbt test → runs all schema + referential integrity tests
7. create_indexes() → ensures indexes on FK, timestamp, natural key columns
8. dbt source freshness → validates _loaded_at recency
```

## Key Design Decisions

1. **Explicit dtypes** — no pandas inference; every column declared in `dtype_specs.py`
2. **Separate staging** — batch and API data stay independent until dimension layer
3. **SCD2 schema-only** — columns present for future implementation, not active
4. **File checksum incremental** — `_ingestion_log` tracks MD5 hashes; already-ingested files skipped
5. **Configurable retry** — all API retry params in `.env`; exponential backoff with HTTP status awareness
6. **Idempotent pipeline** — upserts everywhere; safe to rerun any step
7. **Coalesce to -1** — missing dimension keys use sentinel value; RI tests exclude with WHERE
8. **Observable by default** — every ingestion task emits timing + row count metrics
9. **Indexes as code** — performance optimization is version-controlled and idempotent
10. **Read-only API** — backend only exposes GET endpoints; zero write access from frontend
11. **Service layer pattern** — database.py separates routers from SQL execution

### Phase 8.1: Integration & Data Population ✅
- **Ingestion Fixes**:
  - Fixed upsert: added UNIQUE constraint after table creation (pandas `to_sql` doesn't create PK/UQ)
  - Fixed NaT handling: convert pandas NaT values to None before PostgreSQL INSERT
- **dbt Workaround**:
  - dbt CLI incompatible with Python 3.14 (mashumaro/dataclass_schema issue)
  - Created `scripts/materialize_models.py` — direct SQL materialization matching dbt model logic
  - Added `dbt_project/macros/generate_schema_name.sql` — schema name override (prevents `public_analytics` naming)
- **API Error Handling**:
  - `database.py` rewritten with try/except for UndefinedTable, UndefinedColumn, InvalidSchemaName
  - All queries return empty list on error (no 500 crashes)
  - `ensure_metrics_table()` called on API startup — creates `raw._pipeline_metrics` if missing
- **Query Alignment**:
  - Fixed `analytics.py` — `product_name` → `NULLIF(title, '')` (dim_products has `title` not `product_name`)
- **End-to-End Verified**:
  - All 14 API endpoints return HTTP 200 with real data
  - All 4 frontend pages render with production data (charts, tables, metrics)

## Data Population Summary

| Schema | Table | Rows |
|--------|-------|------|
| raw | orders | 99,441 |
| raw | order_items | 112,650 |
| raw | customers | 99,441 |
| raw | products | 32,951 |
| raw | sellers | 3,095 |
| raw | order_payments | 103,886 |
| raw | order_reviews | 98,410 |
| raw | geolocation | 1,000,163 |
| raw | api_products | 20 |
| raw | api_users | 10 |
| raw | api_carts | 7 |
| raw | _pipeline_metrics | 12 |
| staging | 10 views | — |
| analytics | dim_customers | 99,451 |
| analytics | dim_products | 32,971 |
| analytics | dim_sellers | 3,095 |
| analytics | dim_dates | 1,461 |
| analytics | fact_order_items | 112,650 |
| analytics | fact_order_payments | 103,886 |

### Phase 1 (Infra): Docker Containerization ✅
- **Docker Compose orchestration** — full stack via `docker compose --env-file .env.docker up --build`
- **6 services**: postgres, api, frontend, airflow-init, airflow-webserver, airflow-scheduler
- **Dockerfiles**:
  - `Dockerfile.api` — Python 3.12-slim, FastAPI + full project code
  - `Dockerfile.frontend` — 3-stage multi-stage build (deps → build → standalone runtime)
  - `Dockerfile.airflow` — apache/airflow:2.9.3-python3.12 with project deps
- **PostgreSQL persistence** — named volume `ecommerce-postgres-data`
- **Airflow metadata** — separate `airflow_metadata` database on same PostgreSQL instance
- **Environment standardization**:
  - `.env.docker` — Docker-specific config (service-name networking)
  - `.env.example` — updated with Docker context comments
- **Healthchecks** — postgres (pg_isready), api (curl /health/ping), frontend (wget)
- **Dependency ordering** — postgres → api → frontend; postgres → airflow-init → airflow-*
- **Infrastructure-only changes to existing code**:
  - `airflow/dags/ecommerce_pipeline_dag.py` — `PROJECT_ROOT` env var override for container path resolution
  - `frontend/next.config.ts` — `output: 'standalone'` for Docker-optimized builds
- **Supporting files**: `.dockerignore`, `docker/postgres/init-airflow-db.sql`
- **Documentation**: README updated with Docker section, architecture diagram, troubleshooting

### Phase 1.1 (Infra): Infrastructure Polish & Developer Experience ✅
- **Makefile** — 17 developer-friendly commands (`make up`, `make seed`, `make logs`, etc.)
  - Colored output, grouped by lifecycle/pipeline/quality/operations
  - Wraps docker compose with `--env-file .env.docker` consistently
- **Compose Profiles** — Airflow services behind `airflow` profile
  - Default `make up` starts only postgres + api + frontend (faster, lighter)
  - `make airflow` adds scheduler + webserver
- **Resource Constraints** — memory limits on all services
  - postgres 512M, api 512M, frontend 256M, airflow 1G each
- **Docker Build Optimization**:
  - `.dockerignore` expanded: excludes `tests/`, `Dockerfile*`, `docker-compose*`, `Makefile`, `docker/`
  - Reduces build context size and prevents cache invalidation
- **Dataset Volume Mount** — `./dataset` bind-mounted into API container for `make ingest`
- **Startup Verification** — `scripts/verify_startup.py`
  - Checks PostgreSQL (TCP), API (HTTP), Frontend (HTTP) with retries
  - Callable via `make verify`
  - Exit code 0/1 for CI integration
- **README Improvements**:
  - Developer Experience section with full Makefile reference
  - Compose profiles documentation
  - Resource limits table
  - Updated quick start to use `make` commands

## How to Resume

1. Read this file
2. Check `.env` for config (local) or `.env.docker` for Docker
3. Check `config/settings.py` for all settings
4. Run `python -m pytest tests/test_ingestion.py -v` to verify setup

### Option A: Docker (recommended)
```bash
make up            # Start core services (postgres + api + frontend)
make verify        # Check all services are healthy
make seed          # Full pipeline: ingest + transform (first time only)

# Useful commands:
make logs          # Tail service logs
make status        # Check health status
make psql          # PostgreSQL shell
make airflow       # Start Airflow (optional)
make down          # Stop all (preserves data)
```

### Option B: Local development
5. Populate data (if empty DB):
   ```bash
   python -m ingestion.batch.ingest_csv     # Load 9 Olist CSVs → raw.*
   python -m ingestion.api.ingest_api       # Fetch FakeStore API → raw.api_*
   python -m scripts.materialize_models     # Create staging views + analytics tables
   python -m ingestion.utils.performance    # Create indexes
   ```
6. Start full stack:
   ```bash
   # Terminal 1: API
   uvicorn api.main:app --reload
   # Terminal 2: Frontend
   cd frontend && npm run dev
   ```
7. Open http://localhost:3000 for the dashboard
