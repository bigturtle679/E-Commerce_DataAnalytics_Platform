{{
    config(
        materialized='table'
    )
}}

-- Customer dimension — Olist batch customers only.
-- SCD2-ready with valid_from/valid_to/is_current fields.

with batch_customers as (
    select
        customer_id,
        customer_unique_id,
        city,
        state,
        zip_code_prefix,
        'olist_batch' as source
    from {{ ref('stg_customers_batch') }}
),

final as (
    select
        row_number() over (order by customer_id) as customer_key,
        customer_id,
        customer_unique_id,
        city,
        state,
        zip_code_prefix,
        source,
        now() as valid_from,
        cast(null as timestamp) as valid_to,
        true as is_current
    from batch_customers
)

select * from final
