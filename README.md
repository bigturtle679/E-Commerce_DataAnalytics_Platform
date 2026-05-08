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

### Prerequisites

- **Python 3.10+**
- **Node.js 18+**
- **PostgreSQL** running on `localhost:5432`
- A database named `ecommerce` created

### 1. Clone & Install

```bash
git clone https://github.com/bigturtle679/E-Commerce_DataAnalytics_Platform.git
cd E-Commerce_DataAnalytics_Platform

# Python dependencies
pip install -r requirements.txt

# Frontend dependencies
cd frontend && npm install && cd ..
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your PostgreSQL password
```

### 3. Load Data

```bash
# Step 1: Ingest Olist CSVs into raw schema (9 tables, ~1.5M rows)
python -m ingestion.batch.ingest_csv

# Step 2: Fetch FakeStore API data (3 tables)
python -m ingestion.api.ingest_api

# Step 3: Build staging views + analytics tables
python -m scripts.materialize_models

# Step 4: Create performance indexes
python -m ingestion.utils.performance
```

### 4. Start the Platform

```bash
# Terminal 1 — API server
uvicorn api.main:app --reload

# Terminal 2 — Frontend
cd frontend && npm run dev
```

Open **http://localhost:3000** to view the dashboard.

### 5. Run Tests

```bash
python -m pytest tests/ -v
```

---

## 📁 Project Structure

```
ecommerce-data-platform/
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
│   └── profiles.yml            # Connection config
│
├── scripts/
│   └── materialize_models.py   # Direct SQL model builder (dbt alternative)
│
├── api/                        # FastAPI read-only backend
│   ├── main.py                 # App with CORS + lifespan management
│   ├── database.py             # Connection pool + graceful error handling
│   ├── schemas.py              # Pydantic response models
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
├── tests/                      # Pytest suite
└── .env.example                # Environment template
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
| `DATASET_PATH` | `../dataset` | Path to Olist CSV files |
| `LOG_LEVEL` | `INFO` | Logging verbosity |

---

## 📄 License

This project is for educational and portfolio purposes.  
Dataset: [Brazilian E-Commerce Public Dataset by Olist](https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce)  
API: [FakeStore API](https://fakestoreapi.com)
