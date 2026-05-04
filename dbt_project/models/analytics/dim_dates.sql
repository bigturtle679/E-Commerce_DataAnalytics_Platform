{{
    config(
        materialized='table'
    )
}}

with date_spine as (
    select
        generate_series(
            '2016-01-01'::date,
            '2019-12-31'::date,
            '1 day'::interval
        )::date as full_date
),

final as (
    select
        cast(to_char(full_date, 'YYYYMMDD') as integer) as date_key,
        full_date,
        extract(year from full_date)::integer    as year,
        extract(quarter from full_date)::integer as quarter,
        extract(month from full_date)::integer   as month,
        to_char(full_date, 'Month')              as month_name,
        extract(day from full_date)::integer     as day,
        extract(dow from full_date)::integer     as day_of_week,
        to_char(full_date, 'Day')                as day_name,
        case when extract(dow from full_date) in (0, 6) then true else false end as is_weekend
    from date_spine
)

select * from final
