"""Database performance optimization — indexes and partitioning strategy.

Run once after initial dbt build, or idempotently on subsequent runs.
Creates indexes on foreign keys, timestamps, and high-cardinality lookup columns.
"""

from sqlalchemy import text

from config.settings import ANALYTICS_SCHEMA, RAW_SCHEMA
from ingestion.utils.db import get_engine
from ingestion.utils.logger import get_logger

logger = get_logger("performance")

# ─── Index Definitions ──────────────────────────────────────────────────────
# Format: (schema, table, index_name, column_expression)
INDEXES = [
    # Analytics — fact_order_items foreign keys
    (ANALYTICS_SCHEMA, "fact_order_items", "idx_foi_customer_key", "customer_key"),
    (ANALYTICS_SCHEMA, "fact_order_items", "idx_foi_product_key", "product_key"),
    (ANALYTICS_SCHEMA, "fact_order_items", "idx_foi_seller_key", "seller_key"),
    (ANALYTICS_SCHEMA, "fact_order_items", "idx_foi_order_date_key", "order_date_key"),
    (ANALYTICS_SCHEMA, "fact_order_items", "idx_foi_order_id", "order_id"),
    (ANALYTICS_SCHEMA, "fact_order_items", "idx_foi_loaded_at", "_loaded_at"),
    # Analytics — fact_order_payments foreign keys
    (ANALYTICS_SCHEMA, "fact_order_payments", "idx_fop_order_date_key", "order_date_key"),
    (ANALYTICS_SCHEMA, "fact_order_payments", "idx_fop_order_id", "order_id"),
    (ANALYTICS_SCHEMA, "fact_order_payments", "idx_fop_loaded_at", "_loaded_at"),
    (ANALYTICS_SCHEMA, "fact_order_payments", "idx_fop_payment_type", "payment_type"),
    # Analytics — dimension lookups
    (ANALYTICS_SCHEMA, "dim_customers", "idx_dc_customer_id", "customer_id"),
    (ANALYTICS_SCHEMA, "dim_customers", "idx_dc_is_current", "is_current"),
    (ANALYTICS_SCHEMA, "dim_customers", "idx_dc_zip_code", "zip_code_prefix"),
    (ANALYTICS_SCHEMA, "dim_products", "idx_dp_product_id", "product_id"),
    (ANALYTICS_SCHEMA, "dim_products", "idx_dp_is_current", "is_current"),
    (ANALYTICS_SCHEMA, "dim_sellers", "idx_ds_seller_id", "seller_id"),
    (ANALYTICS_SCHEMA, "dim_dates", "idx_dd_full_date", "full_date"),
    # Analytics — dim_geography
    (ANALYTICS_SCHEMA, "dim_geography", "idx_geo_cep_prefix", "cep_prefix"),
    (ANALYTICS_SCHEMA, "dim_geography", "idx_geo_state", "state_code"),
    # Raw — timestamp columns for incremental lookups
    (RAW_SCHEMA, "orders", "idx_raw_orders_loaded_at", "_loaded_at"),
    (RAW_SCHEMA, "order_items", "idx_raw_oi_loaded_at", "_loaded_at"),
    (RAW_SCHEMA, "order_payments", "idx_raw_op_loaded_at", "_loaded_at"),
    # Raw — enrichment tables
    (RAW_SCHEMA, "cep_enrichment", "idx_cep_prefix", "cep_prefix"),
    (RAW_SCHEMA, "fx_rates", "idx_fx_date", "fetched_date"),
]


def create_indexes() -> int:
    """Create all indexes idempotently. Returns count of indexes created."""
    engine = get_engine()
    created = 0

    with engine.begin() as conn:
        for schema, table, idx_name, column_expr in INDEXES:
            full_table = f"{schema}.{table}"
            # Check if table exists before indexing
            exists = conn.execute(
                text(
                    "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
                    "WHERE table_schema = :schema AND table_name = :table)"
                ),
                {"schema": schema, "table": table},
            ).scalar()

            if not exists:
                logger.debug(f"Table {full_table} does not exist, skipping index {idx_name}")
                continue

            # CREATE INDEX IF NOT EXISTS is idempotent
            sql = f'CREATE INDEX IF NOT EXISTS "{idx_name}" ON {full_table} ({column_expr})'
            conn.execute(text(sql))
            created += 1
            logger.debug(f"Ensured index {idx_name} on {full_table}({column_expr})")

    logger.info(f"Index creation complete: {created} indexes ensured")
    return created


def get_partitioning_recommendations() -> list[str]:
    """Return partitioning recommendations for fact tables.

    PostgreSQL native partitioning requires table recreation, so we document
    the strategy here rather than auto-applying it. This preserves the existing
    data and avoids downtime in a running system.

    For greenfield or migration scenarios, apply these manually.
    """
    return [
        # fact_order_items: partition by order_date_key (YYYYMMDD integer)
        # Range partition by year: 20160101-20161231, 20170101-20171231, etc.
        (
            "-- fact_order_items: Range partition by order_date_key (year buckets)\n"
            "-- CREATE TABLE analytics.fact_order_items (\n"
            "--     ...\n"
            "-- ) PARTITION BY RANGE (order_date_key);\n"
            "-- CREATE TABLE analytics.fact_order_items_2016 PARTITION OF analytics.fact_order_items\n"
            "--     FOR VALUES FROM (20160101) TO (20170101);\n"
            "-- CREATE TABLE analytics.fact_order_items_2017 PARTITION OF analytics.fact_order_items\n"
            "--     FOR VALUES FROM (20170101) TO (20180101);\n"
            "-- CREATE TABLE analytics.fact_order_items_2018 PARTITION OF analytics.fact_order_items\n"
            "--     FOR VALUES FROM (20180101) TO (20190101);\n"
            "-- CREATE TABLE analytics.fact_order_items_2019 PARTITION OF analytics.fact_order_items\n"
            "--     FOR VALUES FROM (20190101) TO (20200101);\n"
            "-- CREATE TABLE analytics.fact_order_items_default PARTITION OF analytics.fact_order_items DEFAULT;"
        ),
        # fact_order_payments: same strategy
        (
            "-- fact_order_payments: Range partition by order_date_key (year buckets)\n"
            "-- CREATE TABLE analytics.fact_order_payments (\n"
            "--     ...\n"
            "-- ) PARTITION BY RANGE (order_date_key);\n"
            "-- CREATE TABLE analytics.fact_order_payments_2016 PARTITION OF analytics.fact_order_payments\n"
            "--     FOR VALUES FROM (20160101) TO (20170101);\n"
            "-- ... (same pattern per year)"
        ),
    ]


if __name__ == "__main__":
    print("Creating indexes...")
    count = create_indexes()
    print(f"Done. {count} indexes ensured.")
    print("\nPartitioning recommendations:")
    for rec in get_partitioning_recommendations():
        print(rec)
        print()
