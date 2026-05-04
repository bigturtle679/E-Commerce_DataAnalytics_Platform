with source as (
    select * from {{ source('raw', 'api_users') }}
),

renamed as (
    select
        cast(id as integer)                                     as user_id,
        cast(coalesce(email, '') as varchar(255))               as email,
        cast(coalesce(username, '') as varchar(100))             as username,
        cast(coalesce(lower(trim(firstname)), '') as varchar(100)) as first_name,
        cast(coalesce(lower(trim(lastname)), '') as varchar(100))  as last_name,
        cast(coalesce(phone, '') as varchar(50))                as phone,
        cast(coalesce(lower(trim(city)), 'unknown') as varchar(100)) as city,
        cast(coalesce(street, '') as varchar(200))              as street,
        cast(coalesce(zipcode, '') as varchar(20))              as zipcode,
        cast("_loaded_at" as timestamp)                         as _loaded_at
    from source
    where id is not null
),

deduplicated as (
    select *,
        row_number() over (partition by user_id order by _loaded_at desc) as _rn
    from renamed
)

select * from deduplicated where _rn = 1
