# 🛒 E-Commerce Data Analytics Platform

A production-grade, end-to-end data platform that ingests e-commerce data from multiple sources, transforms it into a star schema warehouse, and surfaces insights through a real-time observability dashboard.

> **Data Sources**: Brazilian Olist marketplace dataset (9 CSVs, ~1.5M rows) + FakeStore REST API (3 endpoints)  
> **Stack**: Python · PostgreSQL · dbt · Airflow · FastAPI · Next.js

---

## 📸 Dashboard Preview

The platform includes a full-stack observability and analytics dashboard with 4 pages:

| Page | What It Shows |
|------|--------------|
| **Overview** | System health summary — pipeline runs, rows processed, avg duration, source freshness, revenue trend |
| **Pipeline** | DAG monitoring — success rate, task durations, throughput timeline, run history with status badges |
| **Analytics** | Business metrics — R$15.8M total revenue, 98.7K customers, order trends, geographic distribution |
| **Data Quality** | Freshness indicators, row counts by table, stale source detection, data inventory |

---

## 🏗️ Architecture

```
 ┌──────────────────┐     ┌───────────────────────┐
 │  Olist CSVs (9)  │     │ FakeStore API (3 endpoints) │
 │  dtype-enforced  │     │  retry + backoff      │
 │  MD5 checksums   │     │  sync state tracking  │
 └────────┬─────────┘     └───────────┬───────────┘
          │                           │
          ▼                           ▼
 ┌──────────────────────────────────────────────┐
 │     PostgreSQL — raw schema (15 tables)      │
 │  9 batch tables + 3 API tables + 3 meta      │
 └──────────────────────┬───────────────────────┘
                        │
                 Staging Layer (10 views)
                 ├── 7 batch models (stg_*_batch)
                 └── 3 API models   (stg_*_api)
                        │
                 Analytics Layer (6 tables)
                 ├── dim_customers  ─┐
                 ├── dim_products   ─┼── Star Schema
                 ├── dim_sellers    ─┤
                 ├── dim_dates      ─┘
                 ├── fact_order_items
                 └── fact_order_payments
                        │
          ┌─────────────┴──────────────┐
          │    FastAPI (read-only)      │
          │    14 endpoints, 4 routers  │
          └─────────────┬──────────────┘
                        │
          ┌─────────────┴──────────────┐
          │    Next.js Dashboard        │
          │    4 pages, dark mode       │
          │    Recharts + shadcn/ui     │
          └────────────────────────────┘
```

### Container Architecture

```
  docker compose --env-file .env.docker up --build
  ┌─────────────────────────────────────────────────────────────┐
  │                   platform-net (bridge)                     │
  │                                                             │
  │  ┌──────────────┐   ┌──────────────┐   ┌────────────────┐  │
  │  │  postgres     │   │  api         │   │  frontend      │  │
  │  │  :5432        │◄──│  :8000       │   │  :3000         │  │
  │  │  ecommerce DB │   │  FastAPI     │   │  Next.js       │  │
  │  │  airflow_meta │   │  (read-only) │   │  (standalone)  │  │
  │  └──────┬───────┘   └──────────────┘   └────────────────┘  │
  │         │                                                   │
  │  ┌──────┴───────┐   ┌──────────────┐                       │
  │  │ airflow-init │──▶│ airflow-web  │                       │
  │  │ (one-shot)   │   │  :8080       │                       │
  │  └──────────────┘   └──────────────┘                       │
  │                     ┌──────────────┐                       │
  │                     │ airflow-sched│                       │
  │                     │ (scheduler)  │                       │
  │                     └──────────────┘                       │
  │                                                             │
  │  Volumes: postgres_data │ airflow_logs                     │
  │  Mounts:  ./dataset │ ./airflow/dags                       │
  └─────────────────────────────────────────────────────────────┘
```

---

## ⚙️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Ingestion** | Python, pandas, requests | Batch CSV loading + REST API fetching |
| **Warehouse** | PostgreSQL | Raw → Staging → Analytics (star schema) |
| **Modeling** | dbt-core | SQL-based ELT with tests and freshness |
| **Orchestration** | Apache Airflow | 10-task DAG, daily schedule, idempotent |
| **Observability** | Custom metrics table | Pipeline timing, row counts, failure tracking |
| **API** | FastAPI + psycopg2 | Read-only REST layer with connection pooling |
| **Frontend** | Next.js 16, TypeScript | App Router, server components |
| **UI** | TailwindCSS v4, shadcn/ui | Dark-mode-first design system |
| **Charts** | Recharts | Area, bar, and pie visualizations |
| **State** | React Query (TanStack) | Client-side caching with 60s polling |

---

## 🚀 Quick Start

### Option A: Docker (recommended)

> One command to start the entire platform. Requires only **Docker** and **Docker Compose**.

#### 1. Clone

```bash
git clone https://github.com/bigturtle679/E-Commerce_DataAnalytics_Platform.git
cd E-Commerce_DataAnalytics_Platform
```

#### 2. Configure Environment

```bash
cp .env.docker.example .env.docker
# Edit .env.docker with your preferred PostgreSQL password
```

Or use the provided `.env.docker` defaults (fine for local development).

#### 3. Place Dataset

Place the [Olist dataset CSVs](https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce) in a `dataset/` directory at the project root.

#### 4. Start Services

```bash
make up            # starts postgres + api + frontend
make verify        # checks all services are healthy
```

Or without Make:
```bash
docker compose --env-file .env.docker up --build -d
```

#### 5. Populate Data

```bash
make seed          # runs full pipeline: ingest + transform
```

Or step-by-step:
```bash
make ingest        # batch CSVs + FakeStore API
make transform     # staging views + analytics tables + indexes
```

#### 6. Access

| Service | URL | Credentials |
|---------|-----|-------------|
| **Dashboard** | http://localhost:3000 | — |
| **API** | http://localhost:8000/docs | — |
| **Airflow** | http://localhost:8080 | admin / admin |
| **PostgreSQL** | localhost:5432 | postgres / (see .env.docker) |

> Airflow requires `make airflow` to start (not included in default `make up`).

#### 7. Stop / Restart

```bash
make down          # stop all (preserves data)
make clean         # stop + remove all volumes
make rebuild       # force rebuild all images
```

---

### Option B: Local Development

#### Prerequisites

- **Python 3.10+**
- **Node.js 18+**
- **PostgreSQL** running on `localhost:5432`
- A database named `ecommerce` created

#### 1. Clone & Install

```bash
git clone https://github.com/bigturtle679/E-Commerce_DataAnalytics_Platform.git
cd E-Commerce_DataAnalytics_Platform

# Python dependencies
pip install -r requirements.txt

# Frontend dependencies
cd frontend && npm install && cd ..
```

#### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your PostgreSQL password
```

#### 3. Load Data

```bash
python -m ingestion.batch.ingest_csv
python -m ingestion.api.ingest_api
python -m scripts.materialize_models
python -m ingestion.utils.performance
```

#### 4. Start the Platform

```bash
# Terminal 1 — API server
uvicorn api.main:app --reload

# Terminal 2 — Frontend
cd frontend && npm run dev
```

Open **http://localhost:3000** to view the dashboard.

#### 5. Run Tests

```bash
python -m pytest tests/ -v
```

---

## 📁 Project Structure

```
ecommerce-data-platform/
│
├── .github/workflows/ci.yml   # GitHub Actions CI pipeline (4 jobs)
├── docker-compose.yml          # Full-stack orchestration (6 services)
├── Dockerfile.api              # FastAPI container (python:3.12-slim)
├── Dockerfile.frontend         # Next.js container (3-stage, standalone)
├── Dockerfile.airflow          # Airflow container (official 2.9.3 image)
├── Makefile                    # Developer CLI (ci, lint, format, up, seed, ...)
├── pyproject.toml              # Ruff + Black + mypy + pytest config
├── requirements.txt            # Python runtime dependencies
├── requirements-dev.txt        # Dev tooling (ruff, black, pytest, mypy)
├── .dockerignore               # Docker build context exclusions
├── .env.docker                 # Docker environment (service-name networking)
├── .env.example                # Local dev environment template
│
├── docker/
│   └── postgres/
│       └── init-airflow-db.sql # Creates airflow_metadata DB on first init
│
├── ingestion/                  # Data ingestion layer
│   ├── batch/
│   │   ├── ingest_csv.py       # Dtype-enforced CSV loader with checksum tracking
│   │   └── dtype_specs.py      # Explicit column types for all 9 CSVs
│   ├── api/
│   │   ├── ingest_api.py       # FakeStore API → flatten JSON → upsert
│   │   └── fakestore_client.py # HTTP client with retry + backoff
│   └── utils/
│       ├── db.py               # Engine factory, upsert, schema management
│       ├── logger.py           # Rotating file + stdout logging
│       ├── metrics.py          # track_pipeline() context manager
│       └── performance.py      # Idempotent index creation
│
├── dbt_project/                # dbt transformation models
│   ├── models/
│   │   ├── staging/            # 10 views (7 batch + 3 API)
│   │   └── analytics/          # 6 tables (4 dims + 2 facts)
│   ├── macros/                 # generate_schema_name override
│   └── profiles.yml            # Connection config (env_var driven)
│
├── scripts/
│   └── materialize_models.py   # Direct SQL model builder (dbt alternative)
│
├── api/                        # FastAPI read-only backend
│   ├── main.py                 # App with CORS + lifespan management
│   ├── database.py             # Connection pool + graceful error handling
│   ├── schemas.py              # Pydantic response models
│   ├── requirements.txt        # API-specific deps (fastapi, uvicorn)
│   └── routers/
│       ├── pipeline.py         # /api/pipeline/* — runs, stats, timeline
│       ├── health.py           # /api/health/*   — status, freshness, ping
│       ├── analytics.py        # /api/analytics/* — revenue, products, geo
│       └── quality.py          # /api/quality/*   — row counts, freshness
│
├── frontend/                   # Next.js 16 dashboard
│   ├── app/                    # App Router pages (4 pages)
│   ├── components/             # Reusable UI (sidebar, header, charts)
│   └── lib/                    # API client, formatters, utilities
│
├── airflow/dags/               # Orchestration DAG (10 tasks)
├── observability/              # SQL views for metrics
├── config/settings.py          # Central .env config loader
├── tests/                      # Pytest suite (unit + integration)
│   ├── test_ingestion.py       # Unit tests (mock-based, no DB)
│   ├── test_dbt.py             # dbt validation tests
│   └── test_integration.py     # Integration tests (requires PostgreSQL)
└── dataset/                    # Olist CSV files (bind-mounted into containers)
```

---

## 🗄️ Data Model

### Star Schema

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
                           │                        │
                   ┌───────┴────────────┐   ┌──────────────┐
                   │ fact_order_payments │   │ dim_sellers   │
                   │  (payment_key)     │   │ (seller_key)  │
                   └────────────────────┘   └──────────────┘
```

### Model Summary

| Model | Type | Rows | Source |
|-------|------|------|--------|
| `dim_customers` | Dimension | 99,451 | Olist + FakeStore (merged) |
| `dim_products` | Dimension | 32,971 | Olist + FakeStore (merged) |
| `dim_sellers` | Dimension | 3,095 | Olist |
| `dim_dates` | Dimension | 1,461 | Generated (2016–2019) |
| `fact_order_items` | Fact | 112,650 | Orders × Items |
| `fact_order_payments` | Fact | 103,886 | Order payments |

All dimensions include SCD Type 2 columns (`valid_from`, `valid_to`, `is_current`) — schema-ready for future implementation.

---

## 🔌 API Reference

### Pipeline Monitoring — `/api/pipeline`

| Endpoint | Description | Example Response |
|----------|------------|-----------------|
| `GET /runs?limit=50&status=` | Recent pipeline runs | `[{pipeline_name, task_name, status, rows_processed, duration_sec}]` |
| `GET /stats` | Per-task aggregated statistics | `[{task_name, avg_duration, total_runs, success_rate}]` |
| `GET /timeline?days=7` | Hourly throughput | `[{hour, rows_processed, run_count}]` |

### System Health — `/api/health`

| Endpoint | Description |
|----------|------------|
| `GET /status` | Per-pipeline health (last run, failures in 24h) |
| `GET /freshness` | Per-source freshness with timestamps |
| `GET /ping` | DB connectivity check → `{status: "ok", db: "connected"}` |

### Business Analytics — `/api/analytics`

| Endpoint | Description |
|----------|------------|
| `GET /revenue?months=24` | Monthly revenue trends |
| `GET /top-products?limit=10` | Top products by revenue |
| `GET /customers?months=24` | Customer acquisition trends |
| `GET /orders?months=24` | Order volume + avg order value |
| `GET /geo?limit=20` | Geographic distribution by state |

### Data Quality — `/api/quality`

| Endpoint | Description |
|----------|------------|
| `GET /row-counts` | Row counts per monitored table |
| `GET /summary` | Aggregate quality summary |
| `GET /freshness` | Per-source freshness with status badges |

---

## 🛡️ Design Decisions

### Why Explicit Dtypes?
Every CSV column type is declared in `dtype_specs.py`. Pandas silently coerces mixed-type columns (e.g., zip codes with leading zeros → integers). Explicit dtypes prevent silent data corruption at the source.

### Why Separate Batch + API Staging?
Batch and API data have different schemas, update frequencies, and quality profiles. Merging happens only at the dimension layer, keeping source-specific cleaning isolated and debuggable.

### Why SCD2 Schema Without Active Logic?
Adding `valid_from`/`valid_to`/`is_current` columns now is cheap. Retrofitting them later requires migration + backfill across all fact tables. Forward-compatible schema design.

### Why Coalesce to -1?
Missing dimension keys use `-1` (standard Kimball pattern). Facts are never dropped due to late-arriving dimensions. RI tests exclude `-1` rows.

### Why Idempotent Everything?
Every step uses `ON CONFLICT DO UPDATE`, `IF NOT EXISTS`, and checksum skipping. Retries never produce duplicates or corruption.

### Why Direct SQL Instead of dbt CLI?
dbt-core is incompatible with Python 3.14 due to a `mashumaro` dependency issue. `scripts/materialize_models.py` executes identical SQL logic directly against PostgreSQL. The dbt model `.sql` files remain as the source of truth.

---

## 📊 Observability

### Pipeline Metrics
Every ingestion task is wrapped in `track_pipeline()` which records:
- **rows_processed** — count of rows ingested
- **duration_sec** — wall-clock execution time
- **status** — `success` or `failure`
- **error_message** — captured on failure

Stored in `raw._pipeline_metrics` and queryable:

```sql
SELECT task_name, status, rows_processed, duration_sec
FROM raw._pipeline_metrics
ORDER BY started_at DESC;
```

### Source Freshness
Sources are validated against `_loaded_at` timestamps:
- **Warn**: 36 hours since last load
- **Error**: 72 hours since last load

### Logging
Structured rotating logs (10MB × 5 backups) per module in `logs/`:
```
2026-05-08 10:46:22 | db | INFO | Upserted 99441 rows into raw.orders
```

---

## ⚡ Performance

### Indexes
Created idempotently on:
- Fact FK columns (`customer_key`, `product_key`, `seller_key`, `order_date_key`)
- Lookup columns (`order_id`, `payment_type`)
- Timestamps (`_loaded_at` for incremental logic and freshness)
- Dimension natural keys (`customer_id`, `product_id`, `seller_id`)
- SCD2 filter (`is_current`)

### Partitioning Strategy
Fact tables are candidates for range partitioning by `order_date_key` (yearly buckets). Documented but not applied — the current ~100K row dataset doesn't warrant it. Apply when data exceeds ~10M rows.

---

## 🔄 Pipeline DAG

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

**10 tasks** · daily schedule · `max_active_runs=1` · retries: 2 · timeout: 1 hour

---

## 🚧 Failure Handling

| Scenario | Behavior |
|----------|----------|
| CSV file missing | Warning logged, skipped (non-blocking) |
| Schema mismatch | `ValueError` with explicit column diff |
| API timeout / 5xx | Exponential backoff retry (configurable via `.env`) |
| API rate limit (429) | Honors `Retry-After` header |
| Missing DB table | API returns empty response (graceful degradation) |
| dbt model failure | Airflow retries 2× with 5-min delay |
| Full re-run needed | Safe — idempotent upserts, checksums, IF NOT EXISTS |

---

## 📈 Scaling Path

| Stage | Trigger | Action |
|-------|---------|--------|
| **10× data** | >1M fact rows | Apply partitioning, switch to CeleryExecutor |
| **100× data** | >10M rows | Columnar warehouse (Redshift/BigQuery), Spark ingestion |
| **Real-time** | Sub-hour SLA | Kafka/CDC streaming, keep batch as backfill |
| **Multi-tenant** | Multiple consumers | dbt exposures, row-level security |

---

## 📋 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_HOST` | `localhost` | Database host |
| `POSTGRES_PORT` | `5432` | Database port |
| `POSTGRES_DB` | `ecommerce` | Database name |
| `POSTGRES_USER` | `postgres` | Database user |
| `POSTGRES_PASSWORD` | — | Database password |
| `FAKESTORE_API_BASE_URL` | `https://fakestoreapi.com` | API base URL |
| `API_RETRY_MAX_ATTEMPTS` | `3` | Max retry attempts |
| `DATASET_PATH` | `./dataset` | Path to Olist CSV files |
| `LOG_LEVEL` | `INFO` | Logging verbosity |
| `API_HOST` | `0.0.0.0` | API bind address |
| `API_PORT` | `8000` | API port |
| `CORS_ORIGINS` | `http://localhost:3000` | Allowed CORS origins |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Frontend → API URL |

---

## 🧑‍💻 Developer Experience

### Makefile Commands

#### Code Quality (runs locally — no Docker needed)

| Command | Description |
|---------|-------------|
| `make lint` | Lint Python code (Ruff + Black `--check`) |
| `make format` | Auto-format Python code (Black + Ruff `--fix`) |
| `make test-unit` | Run unit tests (no database required) |
| `make frontend-check` | Validate frontend (ESLint + TypeScript + build) |
| `make ci` | Full CI validation — lint + test + frontend |
| `make check` | Alias for `make ci` |

#### Stack Lifecycle (Docker)

| Command | Description |
|---------|-------------|
| `make up` | Start core stack (postgres + api + frontend) |
| `make down` | Stop all services (preserves data) |
| `make rebuild` | Force rebuild all images and restart |
| `make clean` | Stop + remove all data volumes |

#### Pipeline Operations (Docker)

| Command | Description |
|---------|-------------|
| `make ingest` | Run batch CSV + API ingestion |
| `make transform` | Materialize models + create indexes |
| `make seed` | Full pipeline: ingest + transform |
| `make test` | Run full test suite in Docker |

#### Operations

| Command | Description |
|---------|-------------|
| `make logs` | Tail logs for all services |
| `make status` | Show service health |
| `make verify` | Verify all services are accessible |
| `make psql` | Open PostgreSQL shell |
| `make shell` | Open bash in API container |
| `make reset-db` | Reset database (drop + recreate volume) |
| `make airflow` | Start Airflow (scheduler + webserver) |

### Local Validation

One command validates everything before push:

```bash
make ci
```

This runs:
1. **Ruff** — Python linting (E/F/I/UP/B rules)
2. **Black** — Format verification
3. **pytest** — Unit tests (mock-based, no DB)
4. **ESLint** — Frontend linting (core-web-vitals + TypeScript)
5. **tsc** — TypeScript type checking
6. **next build** — Production build verification

---

## 🔄 CI/CD

### GitHub Actions Workflow

The repository is continuously validated via GitHub Actions (`ci.yml`).

| Job | Trigger | What It Validates |
|-----|---------|-------------------|
| **Backend** | push + PR | Ruff lint, Black format, pytest unit tests |
| **Frontend** | push + PR | ESLint, TypeScript, Next.js production build |
| **Docker** | push + PR | `docker compose config` validation |
| **Integration** | push only | PostgreSQL connectivity, schema creation (real DB) |

**Design philosophy:**
- CI mirrors local `make ci` — same tools, same interface
- Default CI is fast (~90s) — integration tests are separate
- Concurrency groups cancel stale runs on force-push

### Code Quality Tooling

| Tool | Purpose | Config |
|------|---------|--------|
| **Ruff** | Python linting (E, F, I, UP, B rules) | `pyproject.toml` |
| **Black** | Python formatting (100 char line length) | `pyproject.toml` |
| **ESLint** | Frontend linting (core-web-vitals + TypeScript) | `eslint.config.mjs` |
| **TypeScript** | Type checking (`strict: true`) | `tsconfig.json` |
| **mypy** | Optional Python type checking (lightweight mode) | `pyproject.toml` |

### Dependency Structure

| File | Purpose | Used By |
|------|---------|---------|
| `requirements.txt` | Python runtime deps (pandas, sqlalchemy, etc.) | `Dockerfile.api`, local dev |
| `requirements-dev.txt` | Dev tooling (ruff, black, pytest, mypy) | CI, local dev |
| `api/requirements.txt` | FastAPI + API-specific deps | `Dockerfile.api` |
| `frontend/package.json` | Node.js deps | `Dockerfile.frontend`, local dev |

### Compose Profiles

The default `make up` starts only the core stack (postgres, api, frontend). Airflow is behind a profile:

```bash
# Core only (default)
make up

# Core + Airflow
make airflow

# Or manually:
docker compose --env-file .env.docker --profile airflow up -d
```

### Resource Limits

| Service | Memory Limit |
|---------|--------------|
| postgres | 512 MB |
| api | 512 MB |
| frontend | 256 MB |
| airflow-webserver | 1 GB |
| airflow-scheduler | 1 GB |

---

## 🐳 Docker Reference

### Services

| Service | Container | Port | Profile | Description |
|---------|-----------|------|---------|-------------|
| `postgres` | `ecommerce-postgres` | 5432 | default | Data warehouse + Airflow metadata |
| `api` | `ecommerce-api` | 8000 | default | FastAPI read-only backend |
| `frontend` | `ecommerce-frontend` | 3000 | default | Next.js dashboard |
| `airflow-init` | `ecommerce-airflow-init` | — | airflow | One-shot: DB migrate + admin user |
| `airflow-webserver` | `ecommerce-airflow-webserver` | 8080 | airflow | Airflow UI |
| `airflow-scheduler` | `ecommerce-airflow-scheduler` | — | airflow | DAG executor |

### Volumes

| Volume | Purpose | Survives `down`? | Survives `down -v`? |
|--------|---------|:-:|:-:|
| `ecommerce-postgres-data` | Database files | ✅ | ❌ |
| `ecommerce-airflow-logs` | Airflow task logs | ✅ | ❌ |

### Healthchecks

| Service | Method | Endpoint | Interval |
|---------|--------|----------|----------|
| `postgres` | `pg_isready` | — | 5s |
| `api` | `curl` | `/api/health/ping` | 10s |
| `frontend` | `wget` | `/` | 10s |
| `airflow-webserver` | `curl` | `/health` | 15s |

---

## 🔧 Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| `api` exits on startup | PostgreSQL not ready | Check `postgres` healthcheck; increase `start_period` |
| Frontend shows no data | API not reachable | Verify `NEXT_PUBLIC_API_URL` in `.env.docker`; rebuild frontend |
| Airflow UI shows no DAGs | DAG folder not mounted | Check `./airflow/dags/` exists and contains the DAG file |
| `airflow-init` fails | `airflow_metadata` DB missing | Delete postgres volume: `docker compose down -v`, then re-run |
| Port conflict | Host port already in use | Change port mapping in `docker-compose.yml` (e.g., `8001:8000`) |
| Ingestion fails: "No CSV files" | Dataset not mounted | Place Olist CSVs in `./dataset/` at project root |
| Permission denied on logs | Docker user mismatch | Run `chmod -R 777 airflow/logs/` on host |

### Useful Commands

```bash
# Makefile shortcuts (recommended)
make logs          # tail all service logs
make logs-api      # tail API logs only
make psql          # open PostgreSQL shell
make shell         # open bash in API container
make status        # check service health
make verify        # verify all endpoints accessible

# Raw docker compose
docker compose --env-file .env.docker build api   # rebuild single service
docker compose --env-file .env.docker up -d api    # restart single service
```

---

## 📄 License

This project is for educational and portfolio purposes.  
Dataset: [Brazilian E-Commerce Public Dataset by Olist](https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce)  
API: [FakeStore API](https://fakestoreapi.com)
