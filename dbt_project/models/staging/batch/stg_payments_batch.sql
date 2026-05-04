with source as (
    select * from {{ source('raw', 'order_payments') }}
),

renamed as (
    select
        cast(order_id as varchar(50))                           as order_id,
        cast(payment_sequential as integer)                     as payment_sequential,
        cast(coalesce(lower(payment_type), 'unknown') as varchar(30)) as payment_type,
        cast(coalesce(payment_installments, 1) as integer)      as payment_installments,
        cast(coalesce(payment_value, 0) as numeric(10,2))       as payment_value,
        cast("_loaded_at" as timestamp)                         as _loaded_at
    from source
    where order_id is not null
),

deduplicated as (
    select *,
        row_number() over (
            partition by order_id, payment_sequential
            order by _loaded_at desc
        ) as _rn
    from renamed
)

select * from deduplicated where _rn = 1
