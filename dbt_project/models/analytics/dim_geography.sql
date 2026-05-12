{{
    config(
        materialized='table'
    )
}}

-- Geography dimension — enriched from ViaCEP API.
-- One row per unique CEP prefix with city, state, and region.

with cep_data as (
    select * from {{ ref('stg_cep_enrichment') }}
),

-- Deduplicate: one row per cep_prefix (take first valid match)
deduped as (
    select
        cep_prefix,
        city,
        state_code,
        state_name,
        region,
        neighborhood,
        row_number() over (partition by cep_prefix order by _loaded_at desc) as rn
    from cep_data
)

select
    row_number() over (order by cep_prefix) as geography_key,
    cep_prefix,
    city,
    state_code,
    state_name,
    region,
    neighborhood
from deduped
where rn = 1
