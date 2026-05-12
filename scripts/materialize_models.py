"""Create staging views and analytics tables directly via SQL.

This replaces `dbt run` for environments where dbt is not compatible
(e.g., Python 3.14). The SQL logic is identical to the dbt model definitions.
"""

from sqlalchemy import text

from ingestion.utils.db import ensure_schemas, get_engine
from ingestion.utils.logger import get_logger

logger = get_logger("dbt_materialize")


def run():
    engine = get_engine()
    ensure_schemas()

    with engine.begin() as conn:
        # ── Staging views (batch) ─────────────────────────────────
        logger.info("Creating staging views (batch)...")

        conn.execute(text("""
            CREATE OR REPLACE VIEW staging.stg_orders_batch AS
            SELECT
                order_id::varchar(50)               AS order_id,
                customer_id::varchar(50)             AS customer_id,
                COALESCE(order_status, 'unknown')    AS order_status,
                order_purchase_timestamp,
                order_approved_at,
                order_delivered_carrier_date,
                order_delivered_customer_date,
                order_estimated_delivery_date,
                _loaded_at
            FROM raw.orders
        """))

        conn.execute(text("""
            CREATE OR REPLACE VIEW staging.stg_order_items_batch AS
            SELECT
                order_id::varchar(50)               AS order_id,
                order_item_id::integer               AS order_item_id,
                product_id::varchar(50)              AS product_id,
                seller_id::varchar(50)               AS seller_id,
                COALESCE(price::numeric(10,2), 0)    AS price,
                COALESCE(freight_value::numeric(10,2), 0) AS freight_value,
                shipping_limit_date,
                _loaded_at
            FROM raw.order_items
        """))

        conn.execute(text("""
            CREATE OR REPLACE VIEW staging.stg_customers_batch AS
            SELECT
                customer_id::varchar(50)             AS customer_id,
                customer_unique_id::varchar(50)      AS customer_unique_id,
                COALESCE(customer_city, '')           AS city,
                COALESCE(customer_state, '')          AS state,
                COALESCE(customer_zip_code_prefix::varchar(10), '') AS zip_code_prefix,
                _loaded_at
            FROM raw.customers
        """))

        conn.execute(text("""
            CREATE OR REPLACE VIEW staging.stg_products_batch AS
            SELECT
                product_id::varchar(50)              AS product_id,
                COALESCE(product_category_name, 'uncategorized') AS category,
                product_weight_g::numeric(10,2)      AS weight_g,
                product_length_cm::numeric(10,2)     AS length_cm,
                product_height_cm::numeric(10,2)     AS height_cm,
                product_width_cm::numeric(10,2)      AS width_cm,
                _loaded_at
            FROM raw.products
        """))

        conn.execute(text("""
            CREATE OR REPLACE VIEW staging.stg_sellers_batch AS
            SELECT
                seller_id::varchar(50)               AS seller_id,
                COALESCE(seller_city, '')             AS city,
                COALESCE(seller_state, '')            AS state,
                COALESCE(seller_zip_code_prefix::varchar(10), '') AS zip_code_prefix,
                _loaded_at
            FROM raw.sellers
        """))

        conn.execute(text("""
            CREATE OR REPLACE VIEW staging.stg_payments_batch AS
            SELECT
                order_id::varchar(50)                AS order_id,
                payment_sequential::integer           AS payment_sequential,
                COALESCE(payment_type, 'unknown')    AS payment_type,
                payment_installments::integer         AS payment_installments,
                COALESCE(payment_value::numeric(10,2), 0) AS payment_value,
                _loaded_at
            FROM raw.order_payments
        """))

        conn.execute(text("""
            CREATE OR REPLACE VIEW staging.stg_reviews_batch AS
            SELECT
                review_id::varchar(50)               AS review_id,
                order_id::varchar(50)                AS order_id,
                COALESCE(review_score::integer, 0)   AS review_score,
                review_comment_title,
                review_comment_message,
                review_creation_date,
                review_answer_timestamp,
                _loaded_at
            FROM raw.order_reviews
        """))

        logger.info("Staging views (batch) created: 7 views")

        # ── Staging views (enrichment) ────────────────────────────
        logger.info("Creating staging views (enrichment)...")

        conn.execute(text("""
            CREATE OR REPLACE VIEW staging.stg_cep_enrichment AS
            SELECT
                cep,
                cep_prefix,
                COALESCE(localidade, '')  AS city,
                COALESCE(uf, '')          AS state_code,
                COALESCE(estado, '')      AS state_name,
                COALESCE(regiao, '')      AS region,
                COALESCE(bairro, '')      AS neighborhood,
                _loaded_at
            FROM raw.cep_enrichment
            WHERE valid = true
        """))

        conn.execute(text("""
            CREATE OR REPLACE VIEW staging.stg_fx_rates AS
            SELECT
                base_currency,
                target_currency,
                rate,
                fetched_date,
                _loaded_at
            FROM raw.fx_rates
        """))

        logger.info("Staging views (enrichment) created: 2 views")

        # ── Drop old FakeStore views if they exist ────────────────
        for old_view in ["stg_products_api", "stg_users_api", "stg_carts_api"]:
            conn.execute(text(f"DROP VIEW IF EXISTS staging.{old_view}"))
        logger.info("Cleaned up old FakeStore staging views")

        # ── Analytics tables ──────────────────────────────────────
        logger.info("Creating analytics tables...")

        # dim_dates
        conn.execute(text("DROP TABLE IF EXISTS analytics.dim_dates CASCADE"))
        conn.execute(text("""
            CREATE TABLE analytics.dim_dates AS
            WITH date_spine AS (
                SELECT generate_series(
                    '2016-01-01'::date,
                    '2019-12-31'::date,
                    '1 day'::interval
                )::date AS full_date
            )
            SELECT
                CAST(to_char(full_date, 'YYYYMMDD') AS integer) AS date_key,
                full_date,
                EXTRACT(year FROM full_date)::integer    AS year,
                EXTRACT(quarter FROM full_date)::integer AS quarter,
                EXTRACT(month FROM full_date)::integer   AS month,
                to_char(full_date, 'Month')              AS month_name,
                EXTRACT(day FROM full_date)::integer     AS day,
                EXTRACT(dow FROM full_date)::integer     AS day_of_week,
                to_char(full_date, 'Day')                AS day_name,
                CASE WHEN EXTRACT(dow FROM full_date) IN (0, 6) THEN true ELSE false END AS is_weekend
            FROM date_spine
        """))
        conn.execute(text("ALTER TABLE analytics.dim_dates ADD PRIMARY KEY (date_key)"))
        logger.info("Created analytics.dim_dates")

        # dim_customers (batch only — FakeStore removed)
        conn.execute(text("DROP TABLE IF EXISTS analytics.dim_customers CASCADE"))
        conn.execute(text("""
            CREATE TABLE analytics.dim_customers AS
            SELECT
                ROW_NUMBER() OVER (ORDER BY customer_id) AS customer_key,
                customer_id, customer_unique_id, city, state, zip_code_prefix,
                'olist_batch' AS source,
                NOW() AS valid_from,
                CAST(NULL AS timestamp) AS valid_to,
                true AS is_current
            FROM staging.stg_customers_batch
        """))
        conn.execute(text("ALTER TABLE analytics.dim_customers ADD PRIMARY KEY (customer_key)"))
        logger.info("Created analytics.dim_customers")

        # dim_products (batch only — FakeStore removed)
        conn.execute(text("DROP TABLE IF EXISTS analytics.dim_products CASCADE"))
        conn.execute(text("""
            CREATE TABLE analytics.dim_products AS
            SELECT
                ROW_NUMBER() OVER (ORDER BY product_id) AS product_key,
                product_id, category, '' AS title,
                CAST(NULL AS numeric(10,2)) AS price,
                weight_g, length_cm, height_cm, width_cm,
                'olist_batch' AS source,
                NOW() AS valid_from,
                CAST(NULL AS timestamp) AS valid_to,
                true AS is_current
            FROM staging.stg_products_batch
        """))
        conn.execute(text("ALTER TABLE analytics.dim_products ADD PRIMARY KEY (product_key)"))
        logger.info("Created analytics.dim_products")

        # dim_sellers
        conn.execute(text("DROP TABLE IF EXISTS analytics.dim_sellers CASCADE"))
        conn.execute(text("""
            CREATE TABLE analytics.dim_sellers AS
            SELECT
                ROW_NUMBER() OVER (ORDER BY seller_id) AS seller_key,
                seller_id, city, state, zip_code_prefix,
                NOW() AS valid_from,
                CAST(NULL AS timestamp) AS valid_to,
                true AS is_current
            FROM staging.stg_sellers_batch
        """))
        conn.execute(text("ALTER TABLE analytics.dim_sellers ADD PRIMARY KEY (seller_key)"))
        logger.info("Created analytics.dim_sellers")

        # dim_geography (new — ViaCEP enrichment)
        conn.execute(text("DROP TABLE IF EXISTS analytics.dim_geography CASCADE"))
        # Only create if cep_enrichment data exists
        cep_exists = conn.execute(text("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'raw' AND table_name = 'cep_enrichment'
            )
        """)).scalar()
        if cep_exists:
            cep_count = conn.execute(
                text("SELECT COUNT(*) FROM raw.cep_enrichment WHERE valid = true")
            ).scalar()
            if cep_count > 0:
                conn.execute(text("""
                    CREATE TABLE analytics.dim_geography AS
                    WITH deduped AS (
                        SELECT
                            cep_prefix,
                            COALESCE(localidade, '') AS city,
                            COALESCE(uf, '') AS state_code,
                            COALESCE(estado, '') AS state_name,
                            COALESCE(regiao, '') AS region,
                            COALESCE(bairro, '') AS neighborhood,
                            ROW_NUMBER() OVER (PARTITION BY cep_prefix ORDER BY _loaded_at DESC) AS rn
                        FROM raw.cep_enrichment
                        WHERE valid = true
                    )
                    SELECT
                        ROW_NUMBER() OVER (ORDER BY cep_prefix) AS geography_key,
                        cep_prefix, city, state_code, state_name, region, neighborhood
                    FROM deduped
                    WHERE rn = 1
                """))
                conn.execute(
                    text("ALTER TABLE analytics.dim_geography ADD PRIMARY KEY (geography_key)")
                )
                logger.info(f"Created analytics.dim_geography ({cep_count} enriched CEPs)")
            else:
                logger.info("No CEP enrichment data — skipping dim_geography")
        else:
            logger.info("CEP enrichment table not found — skipping dim_geography")

        # fact_order_items (with FX conversion columns)
        conn.execute(text("DROP TABLE IF EXISTS analytics.fact_order_items CASCADE"))

        # Check if fx_rates table exists and has data
        fx_exists = conn.execute(text("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'raw' AND table_name = 'fx_rates'
            )
        """)).scalar()

        if fx_exists:
            fx_count = conn.execute(text("SELECT COUNT(*) FROM raw.fx_rates")).scalar()
        else:
            fx_count = 0

        if fx_count > 0:
            conn.execute(text("""
                CREATE TABLE analytics.fact_order_items AS
                WITH customers AS (
                    SELECT customer_key, customer_id
                    FROM analytics.dim_customers WHERE is_current = true
                ),
                products AS (
                    SELECT product_key, product_id
                    FROM analytics.dim_products WHERE is_current = true
                ),
                sellers AS (
                    SELECT seller_key, seller_id
                    FROM analytics.dim_sellers WHERE is_current = true
                ),
                dates AS (
                    SELECT date_key, full_date FROM analytics.dim_dates
                ),
                latest_fx AS (
                    SELECT target_currency, rate
                    FROM raw.fx_rates
                    WHERE base_currency = 'BRL'
                      AND fetched_date = (SELECT MAX(fetched_date) FROM raw.fx_rates)
                )
                SELECT
                    md5(oi.order_id || '-' || CAST(oi.order_item_id AS varchar)) AS order_item_key,
                    COALESCE(c.customer_key, -1)    AS customer_key,
                    COALESCE(p.product_key, -1)     AS product_key,
                    COALESCE(s.seller_key, -1)      AS seller_key,
                    COALESCE(d.date_key, -1)        AS order_date_key,
                    oi.order_id,
                    oi.order_item_id,
                    o.order_status,
                    oi.price,
                    oi.freight_value,
                    oi.price + oi.freight_value     AS total_amount,
                    ROUND((oi.price + oi.freight_value) * COALESCE(fx_usd.rate, 0), 2) AS total_amount_usd,
                    ROUND((oi.price + oi.freight_value) * COALESCE(fx_eur.rate, 0), 2) AS total_amount_eur,
                    oi._loaded_at
                FROM staging.stg_order_items_batch oi
                INNER JOIN staging.stg_orders_batch o ON oi.order_id = o.order_id
                LEFT JOIN customers c ON o.customer_id = c.customer_id
                LEFT JOIN products p ON oi.product_id = p.product_id
                LEFT JOIN sellers s ON oi.seller_id = s.seller_id
                LEFT JOIN dates d ON o.order_purchase_timestamp::date = d.full_date
                LEFT JOIN latest_fx fx_usd ON fx_usd.target_currency = 'USD'
                LEFT JOIN latest_fx fx_eur ON fx_eur.target_currency = 'EUR'
            """))
        else:
            conn.execute(text("""
                CREATE TABLE analytics.fact_order_items AS
                WITH customers AS (
                    SELECT customer_key, customer_id
                    FROM analytics.dim_customers WHERE is_current = true
                ),
                products AS (
                    SELECT product_key, product_id
                    FROM analytics.dim_products WHERE is_current = true
                ),
                sellers AS (
                    SELECT seller_key, seller_id
                    FROM analytics.dim_sellers WHERE is_current = true
                ),
                dates AS (
                    SELECT date_key, full_date FROM analytics.dim_dates
                )
                SELECT
                    md5(oi.order_id || '-' || CAST(oi.order_item_id AS varchar)) AS order_item_key,
                    COALESCE(c.customer_key, -1)    AS customer_key,
                    COALESCE(p.product_key, -1)     AS product_key,
                    COALESCE(s.seller_key, -1)      AS seller_key,
                    COALESCE(d.date_key, -1)        AS order_date_key,
                    oi.order_id,
                    oi.order_item_id,
                    o.order_status,
                    oi.price,
                    oi.freight_value,
                    oi.price + oi.freight_value     AS total_amount,
                    CAST(0 AS numeric(12,2))        AS total_amount_usd,
                    CAST(0 AS numeric(12,2))        AS total_amount_eur,
                    oi._loaded_at
                FROM staging.stg_order_items_batch oi
                INNER JOIN staging.stg_orders_batch o ON oi.order_id = o.order_id
                LEFT JOIN customers c ON o.customer_id = c.customer_id
                LEFT JOIN products p ON oi.product_id = p.product_id
                LEFT JOIN sellers s ON oi.seller_id = s.seller_id
                LEFT JOIN dates d ON o.order_purchase_timestamp::date = d.full_date
            """))
        logger.info("Created analytics.fact_order_items")

        # fact_order_payments
        conn.execute(text("DROP TABLE IF EXISTS analytics.fact_order_payments CASCADE"))
        conn.execute(text("""
            CREATE TABLE analytics.fact_order_payments AS
            WITH dates AS (
                SELECT date_key, full_date FROM analytics.dim_dates
            )
            SELECT
                md5(p.order_id || '-' || CAST(p.payment_sequential AS varchar)) AS payment_key,
                COALESCE(d.date_key, -1) AS order_date_key,
                p.order_id,
                p.payment_sequential,
                p.payment_type,
                p.payment_installments,
                p.payment_value,
                p._loaded_at
            FROM staging.stg_payments_batch p
            INNER JOIN staging.stg_orders_batch o ON p.order_id = o.order_id
            LEFT JOIN dates d ON o.order_purchase_timestamp::date = d.full_date
        """))
        logger.info("Created analytics.fact_order_payments")

    logger.info("All staging views + analytics tables created successfully.")


if __name__ == "__main__":
    run()
