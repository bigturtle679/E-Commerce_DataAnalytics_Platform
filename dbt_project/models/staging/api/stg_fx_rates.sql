-- Cleaned FX exchange rates.
-- One row per base/target/date combination.

SELECT
    base_currency,
    target_currency,
    rate,
    fetched_date,
    _loaded_at
FROM {{ source('raw', 'fx_rates') }}
