{{
    config(
        materialized='incremental',
        unique_key='order_item_key'
    )
}}

with order_items as (
    select * from {{ ref('stg_order_items_batch') }}
),

orders as (
    select * from {{ ref('stg_orders_batch') }}
),

customers as (
    select customer_key, customer_id
    from {{ ref('dim_customers') }}
    where is_current = true
),

products as (
    select product_key, product_id
    from {{ ref('dim_products') }}
    where is_current = true
),

sellers as (
    select seller_key, seller_id
    from {{ ref('dim_sellers') }}
    where is_current = true
),

dates as (
    select date_key, full_date
    from {{ ref('dim_dates') }}
),

joined as (
    select
        md5(oi.order_id || '-' || cast(oi.order_item_id as varchar)) as order_item_key,
        coalesce(c.customer_key, -1)    as customer_key,
        coalesce(p.product_key, -1)     as product_key,
        coalesce(s.seller_key, -1)      as seller_key,
        coalesce(d.date_key, -1)        as order_date_key,
        oi.order_id,
        oi.order_item_id,
        o.order_status,
        oi.price,
        oi.freight_value,
        oi.price + oi.freight_value     as total_amount,
        oi._loaded_at
    from order_items oi
    inner join orders o on oi.order_id = o.order_id
    left join customers c on o.customer_id = c.customer_id
    left join products p on oi.product_id = p.product_id
    left join sellers s on oi.seller_id = s.seller_id
    left join dates d on o.order_purchase_timestamp::date = d.full_date
)

select * from joined

{% if is_incremental() %}
where _loaded_at > (select max(_loaded_at) from {{ this }})
{% endif %}
