with source as (
    select * from {{ source('raw', 'order_reviews') }}
),

renamed as (
    select
        cast(review_id as varchar(50))                         as review_id,
        cast(order_id as varchar(50))                          as order_id,
        cast(coalesce(review_score, 0) as integer)             as review_score,
        cast(coalesce(review_comment_title, '') as text)       as review_comment_title,
        cast(coalesce(review_comment_message, '') as text)     as review_comment_message,
        cast(review_creation_date as timestamp)                as review_creation_date,
        cast(review_answer_timestamp as timestamp)             as review_answer_timestamp,
        cast("_loaded_at" as timestamp)                        as _loaded_at
    from source
    where review_id is not null
),

deduplicated as (
    select *,
        row_number() over (partition by review_id order by _loaded_at desc) as _rn
    from renamed
)

select * from deduplicated where _rn = 1
