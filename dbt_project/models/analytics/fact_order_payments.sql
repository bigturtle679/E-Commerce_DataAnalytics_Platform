{{
    config(
        materialized='incremental',
        unique_key='payment_key'
    )
}}

with payments as (
    select * from {{ ref('stg_payments_batch') }}
),

orders as (
    select order_id, customer_id, order_purchase_timestamp
    from {{ ref('stg_orders_batch') }}
),

customers as (
    select customer_key, customer_id
    from {{ ref('dim_customers') }}
    where is_current = true
),

dates as (
    select date_key, full_date
    from {{ ref('dim_dates') }}
),

joined as (
    select
        md5(p.order_id || '-' || cast(p.payment_sequential as varchar)) as payment_key,
        coalesce(c.customer_key, -1)  as customer_key,
        coalesce(d.date_key, -1)      as order_date_key,
        p.order_id,
        p.payment_sequential,
        p.payment_type,
        p.payment_installments,
        p.payment_value,
        p._loaded_at
    from payments p
    inner join orders o on p.order_id = o.order_id
    left join customers c on o.customer_id = c.customer_id
    left join dates d on o.order_purchase_timestamp::date = d.full_date
)

select * from joined

{% if is_incremental() %}
where _loaded_at > (select max(_loaded_at) from {{ this }})
{% endif %}
