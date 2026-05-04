with source as (
    select * from {{ source('raw', 'api_carts') }}
),

flattened as (
    select
        cast(id as integer)             as cart_id,
        cast(user_id as integer)        as user_id,
        cast(date as timestamp)         as cart_date,
        cast(elem->>'productId' as integer)  as product_id,
        cast(elem->>'quantity' as integer)   as quantity,
        cast("_loaded_at" as timestamp)      as _loaded_at
    from source,
        lateral jsonb_array_elements(products_json::jsonb) as elem
    where id is not null
),

deduplicated as (
    select *,
        row_number() over (
            partition by cart_id, product_id
            order by _loaded_at desc
        ) as _rn
    from flattened
)

select * from deduplicated where _rn = 1
