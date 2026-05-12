-- Cleaned CEP enrichment from ViaCEP API.
-- Filters to valid CEPs only.

SELECT
    cep,
    cep_prefix,
    COALESCE(localidade, '')  AS city,
    COALESCE(uf, '')          AS state_code,
    COALESCE(estado, '')      AS state_name,
    COALESCE(regiao, '')      AS region,
    COALESCE(bairro, '')      AS neighborhood,
    _loaded_at
FROM {{ source('raw', 'cep_enrichment') }}
WHERE valid = true
