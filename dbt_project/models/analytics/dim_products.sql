{{
    config(
        materialized='table'
    )
}}

-- Product dimension — Olist batch products only.
-- SCD2-ready with valid_from/valid_to/is_current fields.

with batch_products as (
    select
        product_id,
        category,
        '' as title,
        cast(null as numeric(10,2)) as price,
        weight_g,
        length_cm,
        height_cm,
        width_cm,
        'olist_batch' as source
    from {{ ref('stg_products_batch') }}
),

final as (
    select
        row_number() over (order by product_id) as product_key,
        product_id,
        category,
        title,
        price,
        weight_g,
        length_cm,
        height_cm,
        width_cm,
        source,
        now() as valid_from,
        cast(null as timestamp) as valid_to,
        true as is_current
    from batch_products
)

select * from final
