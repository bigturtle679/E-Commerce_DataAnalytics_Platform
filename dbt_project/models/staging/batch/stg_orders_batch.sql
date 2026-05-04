with source as (
    select * from {{ source('raw', 'orders') }}
),

renamed as (
    select
        cast(order_id as varchar(50))                     as order_id,
        cast(customer_id as varchar(50))                  as customer_id,
        cast(coalesce(order_status, 'unknown') as varchar(20)) as order_status,
        cast(order_purchase_timestamp as timestamp)       as order_purchase_timestamp,
        cast(order_approved_at as timestamp)              as order_approved_at,
        cast(order_delivered_carrier_date as timestamp)   as order_delivered_carrier_date,
        cast(order_delivered_customer_date as timestamp)  as order_delivered_customer_date,
        cast(order_estimated_delivery_date as timestamp)  as order_estimated_delivery_date,
        cast("_loaded_at" as timestamp)                   as _loaded_at
    from source
    where order_id is not null
),

deduplicated as (
    select *,
        row_number() over (partition by order_id order by _loaded_at desc) as _rn
    from renamed
)

select * from deduplicated where _rn = 1
