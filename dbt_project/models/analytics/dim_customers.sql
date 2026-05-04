{{
    config(
        materialized='table'
    )
}}

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

api_customers as (
    select
        cast(user_id as varchar(50)) as customer_id,
        cast(user_id as varchar(50)) as customer_unique_id,
        city,
        '' as state,
        zipcode as zip_code_prefix,
        'fakestore_api' as source
    from {{ ref('stg_users_api') }}
),

merged as (
    select * from batch_customers
    union all
    select * from api_customers
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
    from merged
)

select * from final
