"""Create staging views and analytics tables directly via SQL.

This replaces `dbt run` for environments where dbt is not compatible
(e.g., Python 3.14). The SQL logic is identical to the dbt model definitions.
"""

from sqlalchemy import text
from ingestion.utils.db import get_engine, ensure_schemas
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

        # ── Staging views (API) ───────────────────────────────────
        logger.info("Creating staging views (API)...")

        conn.execute(text("""
            CREATE OR REPLACE VIEW staging.stg_products_api AS
            SELECT
                id::varchar(50)                      AS product_id,
                COALESCE(category, 'uncategorized')  AS category,
                COALESCE(title, '')                   AS title,
                COALESCE(price::numeric(10,2), 0)    AS price,
                description,
                image,
                _loaded_at
            FROM raw.api_products
        """))

        conn.execute(text("""
            CREATE OR REPLACE VIEW staging.stg_users_api AS
            SELECT
                id::integer                          AS user_id,
                COALESCE(username, '')               AS username,
                email,
                firstname,
                lastname,
                phone,
                COALESCE(city, '')                   AS city,
                COALESCE(zipcode, '')                AS zipcode,
                _loaded_at
            FROM raw.api_users
        """))

        conn.execute(text("""
            CREATE OR REPLACE VIEW staging.stg_carts_api AS
            SELECT
                id::integer                          AS cart_id,
                user_id::integer                     AS user_id,
                date                                 AS cart_date,
                _loaded_at
            FROM raw.api_carts
        """))

        logger.info("Staging views (API) created: 3 views")

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
        conn.execute(text(
            "ALTER TABLE analytics.dim_dates ADD PRIMARY KEY (date_key)"
        ))
        logger.info("Created analytics.dim_dates")

        # dim_customers
        conn.execute(text("DROP TABLE IF EXISTS analytics.dim_customers CASCADE"))
        conn.execute(text("""
            CREATE TABLE analytics.dim_customers AS
            WITH batch_customers AS (
                SELECT customer_id, customer_unique_id, city, state, zip_code_prefix,
                       'olist_batch' AS source
                FROM staging.stg_customers_batch
            ),
            api_customers AS (
                SELECT
                    CAST(user_id AS varchar(50)) AS customer_id,
                    CAST(user_id AS varchar(50)) AS customer_unique_id,
                    city,
                    '' AS state,
                    zipcode AS zip_code_prefix,
                    'fakestore_api' AS source
                FROM staging.stg_users_api
            ),
            merged AS (
                SELECT * FROM batch_customers
                UNION ALL
                SELECT * FROM api_customers
            )
            SELECT
                ROW_NUMBER() OVER (ORDER BY customer_id) AS customer_key,
                customer_id, customer_unique_id, city, state, zip_code_prefix, source,
                NOW() AS valid_from,
                CAST(NULL AS timestamp) AS valid_to,
                true AS is_current
            FROM merged
        """))
        conn.execute(text(
            "ALTER TABLE analytics.dim_customers ADD PRIMARY KEY (customer_key)"
        ))
        logger.info("Created analytics.dim_customers")

        # dim_products
        conn.execute(text("DROP TABLE IF EXISTS analytics.dim_products CASCADE"))
        conn.execute(text("""
            CREATE TABLE analytics.dim_products AS
            WITH batch_products AS (
                SELECT product_id, category, '' AS title,
                       CAST(NULL AS numeric(10,2)) AS price,
                       weight_g, length_cm, height_cm, width_cm,
                       'olist_batch' AS source
                FROM staging.stg_products_batch
            ),
            api_products AS (
                SELECT product_id, category, title, price,
                       CAST(NULL AS numeric(10,2)) AS weight_g,
                       CAST(NULL AS numeric(10,2)) AS length_cm,
                       CAST(NULL AS numeric(10,2)) AS height_cm,
                       CAST(NULL AS numeric(10,2)) AS width_cm,
                       'fakestore_api' AS source
                FROM staging.stg_products_api
            ),
            merged AS (
                SELECT * FROM batch_products
                UNION ALL
                SELECT * FROM api_products
            )
            SELECT
                ROW_NUMBER() OVER (ORDER BY product_id) AS product_key,
                product_id, category, title, price, weight_g, length_cm, height_cm, width_cm, source,
                NOW() AS valid_from,
                CAST(NULL AS timestamp) AS valid_to,
                true AS is_current
            FROM merged
        """))
        conn.execute(text(
            "ALTER TABLE analytics.dim_products ADD PRIMARY KEY (product_key)"
        ))
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
        conn.execute(text(
            "ALTER TABLE analytics.dim_sellers ADD PRIMARY KEY (seller_key)"
        ))
        logger.info("Created analytics.dim_sellers")

        # fact_order_items
        conn.execute(text("DROP TABLE IF EXISTS analytics.fact_order_items CASCADE"))
        conn.execute(text("""
            CREATE TABLE analytics.fact_order_items AS
            WITH customers AS (
                SELECT customer_key, customer_id FROM analytics.dim_customers WHERE is_current = true
            ),
            products AS (
                SELECT product_key, product_id FROM analytics.dim_products WHERE is_current = true
            ),
            sellers AS (
                SELECT seller_key, seller_id FROM analytics.dim_sellers WHERE is_current = true
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
