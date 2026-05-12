"""Meridian data platform pipeline DAG.

Idempotent DAG with clear task separation:
  create_schemas → [batch_ingest, enrichment] → dbt_staging → dbt_analytics → dbt_test
  → create_indexes → dbt_source_freshness
"""

import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

from airflow.operators.bash import BashOperator
from airflow.operators.python import PythonOperator

from airflow import DAG

# Add project root to path for imports
# PROJECT_ROOT env var is set in docker-compose for container compatibility;
# falls back to directory traversal for local development.
PROJECT_ROOT = Path(
    os.environ.get("PROJECT_ROOT", str(Path(__file__).resolve().parent.parent.parent))
)
sys.path.insert(0, str(PROJECT_ROOT))

DBT_PROJECT_DIR = PROJECT_ROOT / "dbt_project"
DBT_PROFILES_DIR = PROJECT_ROOT / "dbt_project"

default_args = {
    "owner": "data-engineering",
    "depends_on_past": False,
    "email_on_failure": False,
    "email_on_retry": False,
    "retries": 2,
    "retry_delay": timedelta(minutes=5),
    "execution_timeout": timedelta(hours=1),
}

dag = DAG(
    dag_id="meridian_data_pipeline",
    default_args=default_args,
    description="End-to-end data pipeline: ingest → enrich → transform → test → optimize",
    schedule_interval="@daily",
    start_date=datetime(2024, 1, 1),
    catchup=False,
    max_active_runs=1,
    tags=["meridian", "production"],
)


def _create_schemas():
    from ingestion.utils.db import ensure_schemas

    ensure_schemas()


def _run_batch_ingestion():
    from ingestion.batch.ingest_csv import run_batch_ingestion

    run_batch_ingestion()


def _run_cep_enrichment():
    from ingestion.api.viacep_client import run_cep_enrichment

    run_cep_enrichment()


def _run_fx_enrichment():
    from ingestion.api.fx_client import run_fx_enrichment

    run_fx_enrichment()


def _create_indexes():
    from ingestion.utils.performance import create_indexes

    create_indexes()


# --- Task definitions ---

create_schemas = PythonOperator(
    task_id="create_schemas",
    python_callable=_create_schemas,
    dag=dag,
)

ingest_batch = PythonOperator(
    task_id="ingest_batch_csv",
    python_callable=_run_batch_ingestion,
    dag=dag,
)

enrich_cep = PythonOperator(
    task_id="enrich_cep_geography",
    python_callable=_run_cep_enrichment,
    dag=dag,
)

enrich_fx = PythonOperator(
    task_id="enrich_fx_rates",
    python_callable=_run_fx_enrichment,
    dag=dag,
)

dbt_run_staging = BashOperator(
    task_id="dbt_run_staging",
    bash_command=(
        f"cd {DBT_PROJECT_DIR} && " f"dbt run --select staging --profiles-dir {DBT_PROFILES_DIR}"
    ),
    dag=dag,
)

dbt_run_analytics = BashOperator(
    task_id="dbt_run_analytics",
    bash_command=(
        f"cd {DBT_PROJECT_DIR} && " f"dbt run --select analytics --profiles-dir {DBT_PROFILES_DIR}"
    ),
    dag=dag,
)

dbt_test = BashOperator(
    task_id="dbt_test",
    bash_command=(f"cd {DBT_PROJECT_DIR} && " f"dbt test --profiles-dir {DBT_PROFILES_DIR}"),
    dag=dag,
)

create_indexes = PythonOperator(
    task_id="create_indexes",
    python_callable=_create_indexes,
    dag=dag,
)

dbt_source_freshness = BashOperator(
    task_id="dbt_source_freshness",
    bash_command=(
        f"cd {DBT_PROJECT_DIR} && " f"dbt source freshness --profiles-dir {DBT_PROFILES_DIR}"
    ),
    dag=dag,
)

# --- Dependencies ---
# Phase 1: Schema creation
create_schemas >> [ingest_batch, enrich_cep, enrich_fx]

# Phase 2: Ingestion + enrichment (parallel)
[ingest_batch, enrich_cep, enrich_fx] >> dbt_run_staging

# Phase 3: dbt transformations
dbt_run_staging >> dbt_run_analytics >> dbt_test

# Phase 4: Post-transform optimization + freshness check
dbt_test >> [create_indexes, dbt_source_freshness]
