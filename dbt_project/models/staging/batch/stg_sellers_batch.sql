with source as (
    select * from {{ source('raw', 'sellers') }}
),

renamed as (
    select
        cast(seller_id as varchar(50))                                    as seller_id,
        cast(coalesce(seller_zip_code_prefix, '') as varchar(10))         as zip_code_prefix,
        cast(coalesce(lower(trim(seller_city)), 'unknown') as varchar(100)) as city,
        cast(coalesce(upper(trim(seller_state)), 'XX') as varchar(5))     as state,
        cast("_loaded_at" as timestamp)                                   as _loaded_at
    from source
    where seller_id is not null
),

deduplicated as (
    select *,
        row_number() over (partition by seller_id order by _loaded_at desc) as _rn
    from renamed
)

select * from deduplicated where _rn = 1
