with source as (
    select * from {{ source('raw', 'order_items') }}
),

renamed as (
    select
        cast(order_id as varchar(50))        as order_id,
        cast(order_item_id as integer)       as order_item_id,
        cast(product_id as varchar(50))      as product_id,
        cast(seller_id as varchar(50))       as seller_id,
        cast(shipping_limit_date as timestamp) as shipping_limit_date,
        cast(price as numeric(10,2))         as price,
        cast(freight_value as numeric(10,2)) as freight_value,
        cast("_loaded_at" as timestamp)      as _loaded_at
    from source
    where order_id is not null and product_id is not null
),

deduplicated as (
    select *,
        row_number() over (
            partition by order_id, order_item_id
            order by _loaded_at desc
        ) as _rn
    from renamed
)

select * from deduplicated where _rn = 1
