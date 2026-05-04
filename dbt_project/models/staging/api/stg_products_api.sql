with source as (
    select * from {{ source('raw', 'api_products') }}
),

renamed as (
    select
        cast(id as integer)                                     as product_id,
        cast(coalesce(title, '') as varchar(255))               as title,
        cast(coalesce(price, 0) as numeric(10,2))               as price,
        cast(coalesce(description, '') as text)                 as description,
        cast(coalesce(lower(trim(category)), 'uncategorized') as varchar(100)) as category,
        cast(coalesce(image, '') as text)                       as image_url,
        cast(coalesce(rating_rate, 0) as numeric(3,1))          as rating_rate,
        cast(coalesce(rating_count, 0) as integer)              as rating_count,
        cast("_loaded_at" as timestamp)                         as _loaded_at
    from source
    where id is not null
),

deduplicated as (
    select *,
        row_number() over (partition by product_id order by _loaded_at desc) as _rn
    from renamed
)

select * from deduplicated where _rn = 1
