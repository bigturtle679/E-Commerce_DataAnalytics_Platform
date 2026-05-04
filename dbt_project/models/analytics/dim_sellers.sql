{{
    config(
        materialized='table'
    )
}}

with source as (
    select * from {{ ref('stg_sellers_batch') }}
),

final as (
    select
        row_number() over (order by seller_id) as seller_key,
        seller_id,
        city,
        state,
        zip_code_prefix,
        now() as valid_from,
        cast(null as timestamp) as valid_to,
        true as is_current
    from source
)

select * from final
