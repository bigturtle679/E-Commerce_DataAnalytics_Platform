"""E-commerce data platform pipeline DAG.

Idempotent DAG with clear task separation:
  create_schemas → [batch_ingest, api_ingest_*] → dbt_staging → dbt_analytics → dbt_test
"""

import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

from airflow import DAG
from airflow.operators.bash import BashOperator
from airflow.operators.python import PythonOperator

# Add project root to path for imports
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
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
    dag_id="ecommerce_data_pipeline",
    default_args=default_args,
    description="End-to-end e-commerce data pipeline: ingest → transform → test",
    schedule_interval="@daily",
    start_date=datetime(2024, 1, 1),
    catchup=False,
    max_active_runs=1,
    tags=["ecommerce", "production"],
)


def _create_schemas():
    from ingestion.utils.db import ensure_schemas
    ensure_schemas()


def _run_batch_ingestion():
    from ingestion.batch.ingest_csv import run_batch_ingestion
    run_batch_ingestion()


def _ingest_api_products():
    from ingestion.api.fakestore_client import FakeStoreClient
    from ingestion.api.ingest_api import ingest_products
    ingest_products(FakeStoreClient())


def _ingest_api_users():
    from ingestion.api.fakestore_client import FakeStoreClient
    from ingestion.api.ingest_api import ingest_users
    ingest_users(FakeStoreClient())


def _ingest_api_carts():
    from ingestion.api.fakestore_client import FakeStoreClient
    from ingestion.api.ingest_api import ingest_carts
    ingest_carts(FakeStoreClient())


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

ingest_api_products = PythonOperator(
    task_id="ingest_api_products",
    python_callable=_ingest_api_products,
    dag=dag,
)

ingest_api_users = PythonOperator(
    task_id="ingest_api_users",
    python_callable=_ingest_api_users,
    dag=dag,
)

ingest_api_carts = PythonOperator(
    task_id="ingest_api_carts",
    python_callable=_ingest_api_carts,
    dag=dag,
)

dbt_run_staging = BashOperator(
    task_id="dbt_run_staging",
    bash_command=(
        f"cd {DBT_PROJECT_DIR} && "
        f"dbt run --select staging --profiles-dir {DBT_PROFILES_DIR}"
    ),
    dag=dag,
)

dbt_run_analytics = BashOperator(
    task_id="dbt_run_analytics",
    bash_command=(
        f"cd {DBT_PROJECT_DIR} && "
        f"dbt run --select analytics --profiles-dir {DBT_PROFILES_DIR}"
    ),
    dag=dag,
)

dbt_test = BashOperator(
    task_id="dbt_test",
    bash_command=(
        f"cd {DBT_PROJECT_DIR} && "
        f"dbt test --profiles-dir {DBT_PROFILES_DIR}"
    ),
    dag=dag,
)

# --- Dependencies ---
create_schemas >> [ingest_batch, ingest_api_products, ingest_api_users, ingest_api_carts]
[ingest_batch, ingest_api_products, ingest_api_users, ingest_api_carts] >> dbt_run_staging
dbt_run_staging >> dbt_run_analytics >> dbt_test
