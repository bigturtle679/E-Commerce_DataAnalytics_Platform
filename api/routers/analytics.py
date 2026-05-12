"""Analytics endpoints — pre-aggregated business metrics.

All aggregation happens in SQL to keep API payloads minimal
and avoid heavy client-side computation.
"""

from fastapi import APIRouter, Query

from api.database import execute_query
from api.schemas import (
    CustomerTrend,
    GeoDistribution,
    OrderGrowth,
    RevenueDataPoint,
    TopProduct,
)

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/revenue", response_model=list[RevenueDataPoint])
def get_revenue_trends(months: int = Query(default=24, ge=1, le=60)):
    """Monthly revenue trends from fact_order_items."""
    sql = """
        SELECT
            TO_CHAR(d.full_date, 'YYYY-MM') AS period,
            ROUND(SUM(f.total_amount)::numeric, 2) AS total_revenue,
            COUNT(DISTINCT f.order_id) AS order_count
        FROM analytics.fact_order_items f
        JOIN analytics.dim_dates d ON f.order_date_key = d.date_key
        WHERE f.order_date_key != -1
        GROUP BY TO_CHAR(d.full_date, 'YYYY-MM')
        ORDER BY period DESC
        LIMIT %(months)s
    """
    return execute_query(sql, {"months": months})


@router.get("/top-products", response_model=list[TopProduct])
def get_top_products(limit: int = Query(default=10, ge=1, le=50)):
    """Top products by total revenue."""
    sql = """
        SELECT
            p.product_id,
            COALESCE(NULLIF(p.title, ''), p.category, 'Unknown') AS product_name,
            p.category,
            ROUND(SUM(f.total_amount)::numeric, 2) AS total_revenue,
            COUNT(*) AS units_sold
        FROM analytics.fact_order_items f
        JOIN analytics.dim_products p ON f.product_key = p.product_key
        WHERE f.product_key != -1
        GROUP BY p.product_id, p.title, p.category
        ORDER BY total_revenue DESC
        LIMIT %(limit)s
    """
    return execute_query(sql, {"limit": limit})


@router.get("/customers", response_model=list[CustomerTrend])
def get_customer_trends(months: int = Query(default=24, ge=1, le=60)):
    """Monthly customer acquisition trends."""
    sql = """
        WITH first_orders AS (
            SELECT
                f.customer_key,
                MIN(TO_CHAR(d.full_date, 'YYYY-MM')) AS first_month
            FROM analytics.fact_order_items f
            JOIN analytics.dim_dates d ON f.order_date_key = d.date_key
            WHERE f.customer_key != -1 AND f.order_date_key != -1
            GROUP BY f.customer_key
        )
        SELECT
            first_month AS period,
            COUNT(*) AS new_customers,
            SUM(COUNT(*)) OVER (ORDER BY first_month) AS total_customers
        FROM first_orders
        GROUP BY first_month
        ORDER BY period DESC
        LIMIT %(months)s
    """
    return execute_query(sql, {"months": months})


@router.get("/orders", response_model=list[OrderGrowth])
def get_order_growth(months: int = Query(default=24, ge=1, le=60)):
    """Monthly order volume and average order value."""
    sql = """
        SELECT
            TO_CHAR(d.full_date, 'YYYY-MM') AS period,
            COUNT(DISTINCT f.order_id) AS order_count,
            COUNT(*) AS total_items,
            ROUND(
                SUM(f.total_amount)::numeric
                / NULLIF(COUNT(DISTINCT f.order_id), 0), 2
            ) AS avg_order_value
        FROM analytics.fact_order_items f
        JOIN analytics.dim_dates d ON f.order_date_key = d.date_key
        WHERE f.order_date_key != -1
        GROUP BY TO_CHAR(d.full_date, 'YYYY-MM')
        ORDER BY period DESC
        LIMIT %(months)s
    """
    return execute_query(sql, {"months": months})


@router.get("/geo", response_model=list[GeoDistribution])
def get_geo_distribution(limit: int = Query(default=20, ge=1, le=50)):
    """Geographic distribution by customer state."""
    sql = """
        SELECT
            COALESCE(c.state, 'Unknown') AS state,
            COUNT(DISTINCT c.customer_key) AS customer_count,
            COUNT(DISTINCT f.order_id) AS order_count
        FROM analytics.fact_order_items f
        JOIN analytics.dim_customers c ON f.customer_key = c.customer_key
        WHERE f.customer_key != -1 AND c.state IS NOT NULL AND c.state != ''
        GROUP BY c.state
        ORDER BY customer_count DESC
        LIMIT %(limit)s
    """
    return execute_query(sql, {"limit": limit})


@router.get("/fx-rates")
def get_fx_rates():
    """Latest FX exchange rates (BRL → USD/EUR)."""
    sql = """
        SELECT
            target_currency,
            rate,
            fetched_date
        FROM raw.fx_rates
        WHERE base_currency = 'BRL'
          AND fetched_date = (SELECT MAX(fetched_date) FROM raw.fx_rates)
        ORDER BY target_currency
    """
    return execute_query(sql)


@router.get("/revenue-fx")
def get_revenue_with_fx(months: int = Query(default=12, ge=1, le=60)):
    """Monthly revenue with USD/EUR conversions."""
    sql = """
        SELECT
            TO_CHAR(d.full_date, 'YYYY-MM') AS period,
            ROUND(SUM(f.total_amount)::numeric, 2) AS total_revenue_brl,
            ROUND(SUM(f.total_amount_usd)::numeric, 2) AS total_revenue_usd,
            ROUND(SUM(f.total_amount_eur)::numeric, 2) AS total_revenue_eur,
            COUNT(DISTINCT f.order_id) AS order_count
        FROM analytics.fact_order_items f
        JOIN analytics.dim_dates d ON f.order_date_key = d.date_key
        WHERE f.order_date_key != -1
        GROUP BY TO_CHAR(d.full_date, 'YYYY-MM')
        ORDER BY period DESC
        LIMIT %(months)s
    """
    return execute_query(sql, {"months": months})
