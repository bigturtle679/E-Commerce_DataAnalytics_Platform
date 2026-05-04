with source as (
    select * from {{ source('raw', 'products') }}
),

translation as (
    select * from {{ source('raw', 'product_category_translation') }}
),

renamed as (
    select
        cast(p.product_id as varchar(50))                               as product_id,
        cast(coalesce(t.product_category_name_english,
                      p.product_category_name, 'uncategorized') as varchar(100)) as category,
        cast(coalesce(p.product_name_lenght, 0) as integer)             as name_length,
        cast(coalesce(p.product_description_lenght, 0) as integer)      as description_length,
        cast(coalesce(p.product_photos_qty, 0) as integer)              as photos_qty,
        cast(coalesce(p.product_weight_g, 0) as numeric(10,2))         as weight_g,
        cast(coalesce(p.product_length_cm, 0) as numeric(10,2))        as length_cm,
        cast(coalesce(p.product_height_cm, 0) as numeric(10,2))        as height_cm,
        cast(coalesce(p.product_width_cm, 0) as numeric(10,2))         as width_cm,
        cast(p."_loaded_at" as timestamp)                               as _loaded_at
    from source p
    left join translation t
        on p.product_category_name = t.product_category_name
    where p.product_id is not null
),

deduplicated as (
    select *,
        row_number() over (partition by product_id order by _loaded_at desc) as _rn
    from renamed
)

select * from deduplicated where _rn = 1
