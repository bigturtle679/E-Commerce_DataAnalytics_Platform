# Multi-Source E-commerce Data Platform

Production-grade data platform ingesting e-commerce data from batch CSVs (Brazilian Olist dataset) and a live API (FakeStore), transforming via dbt into a star schema, orchestrated by Airflow.

## Architecture

```
[Olist CSVs] → Python Ingestion → PostgreSQL (raw.*) ──┐
                                                        ├→ dbt (staging) → dbt (analytics/star schema)
[FakeStore API] → Python Ingestion → PostgreSQL (raw.api_*) ┘
                                                        ↑
                                                   Airflow DAG
```

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Language | Python 3.10+ |
| Warehouse | PostgreSQL |
| Transformations | dbt-core (postgres) |
| Orchestration | Apache Airflow |
| Libraries | pandas, sqlalchemy, psycopg2, requests |

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
├── ingestion/          # Python ingestion layer
│   ├── batch/          # CSV batch ingestion (Olist)
│   ├── api/            # FakeStore API ingestion
│   └── utils/          # DB, logging utilities
├── dbt_project/        # dbt models
│   └── models/
│       ├── staging/    # batch/ + api/ staging models
│       └── analytics/  # dim + fact tables (star schema)
├── airflow/dags/       # Orchestration DAG
├── config/             # Central settings
├── tests/              # Pytest test suite
└── dataset/            # Olist CSV files
```

## Star Schema

- **dim_customers** — merged batch + API customers
- **dim_products** — merged batch + API products
- **dim_sellers** — Olist sellers
- **dim_dates** — generated date spine (2016-2019)
- **fact_order_items** — order line items (incremental)
- **fact_order_payments** — payment entries (incremental)

## Key Design Decisions

1. **Explicit dtype enforcement** — no pandas type inference on CSV load
2. **Separate staging** — batch and API data staged independently; merged only at dim layer
3. **SCD Type 2 ready** — dimension tables have valid_from/to/is_current columns
4. **Incremental processing** — file checksum tracking for batch, timestamp markers for API, dbt incremental for facts
5. **Configurable retry** — API retry params via .env, not hardcoded
