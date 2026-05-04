with source as (
    select * from {{ source('raw', 'customers') }}
),

renamed as (
    select
        cast(customer_id as varchar(50))                         as customer_id,
        cast(customer_unique_id as varchar(50))                  as customer_unique_id,
        cast(coalesce(customer_zip_code_prefix, '') as varchar(10)) as zip_code_prefix,
        cast(coalesce(lower(trim(customer_city)), 'unknown') as varchar(100)) as city,
        cast(coalesce(upper(trim(customer_state)), 'XX') as varchar(5))       as state,
        cast("_loaded_at" as timestamp)                          as _loaded_at
    from source
    where customer_id is not null
),

deduplicated as (
    select *,
        row_number() over (partition by customer_id order by _loaded_at desc) as _rn
    from renamed
)

select * from deduplicated where _rn = 1
