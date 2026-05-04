{{
    config(
        materialized='table'
    )
}}

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

api_products as (
    select
        cast(product_id as varchar(50)) as product_id,
        category,
        title,
        price,
        cast(null as numeric(10,2)) as weight_g,
        cast(null as numeric(10,2)) as length_cm,
        cast(null as numeric(10,2)) as height_cm,
        cast(null as numeric(10,2)) as width_cm,
        'fakestore_api' as source
    from {{ ref('stg_products_api') }}
),

merged as (
    select * from batch_products
    union all
    select * from api_products
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
    from merged
)

select * from final
