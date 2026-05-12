"""ViaCEP geographic enrichment client.

Fetches address data for Brazilian CEP (zip code) prefixes from ViaCEP API.
Enriches the top N most-used CEPs by customer/order frequency.
Results cached permanently in raw.cep_enrichment.
"""

import time

import requests
from sqlalchemy import text

from config.settings import RAW_SCHEMA
from ingestion.utils.db import get_engine
from ingestion.utils.logger import get_logger
from ingestion.utils.metrics import track_pipeline

logger = get_logger("viacep_client")

VIACEP_BASE_URL = "https://viacep.com.br/ws"
REQUEST_DELAY = 0.15  # seconds between requests (~7/sec, respectful rate)
REQUEST_TIMEOUT = 10
MAX_RETRIES = 3
BACKOFF_BASE = 2

_CREATE_TABLE = f"""
CREATE TABLE IF NOT EXISTS {RAW_SCHEMA}.cep_enrichment (
    cep             VARCHAR(9) PRIMARY KEY,
    cep_prefix      VARCHAR(5) NOT NULL,
    localidade      VARCHAR(200),
    uf              VARCHAR(2),
    estado          VARCHAR(100),
    regiao          VARCHAR(50),
    bairro          VARCHAR(200),
    logradouro      VARCHAR(300),
    valid           BOOLEAN NOT NULL DEFAULT true,
    _loaded_at      TIMESTAMP DEFAULT NOW()
)
"""


def _ensure_table(engine) -> None:
    with engine.begin() as conn:
        conn.execute(text(_CREATE_TABLE))


def _get_top_ceps(engine, limit: int = 1000) -> list[str]:
    """Get top N most-used CEP prefixes by customer count."""
    sql = f"""
        SELECT customer_zip_code_prefix AS cep_prefix, COUNT(*) AS cnt
        FROM {RAW_SCHEMA}.customers
        WHERE customer_zip_code_prefix IS NOT NULL
          AND customer_zip_code_prefix != ''
        GROUP BY customer_zip_code_prefix
        ORDER BY cnt DESC
        LIMIT :limit
    """
    with engine.begin() as conn:
        rows = conn.execute(text(sql), {"limit": limit}).fetchall()
    return [str(row[0]).strip() for row in rows]


def _get_cached_prefixes(engine) -> set[str]:
    """Get already-enriched CEP prefixes."""
    sql = f"SELECT cep_prefix FROM {RAW_SCHEMA}.cep_enrichment"
    with engine.begin() as conn:
        rows = conn.execute(text(sql)).fetchall()
    return {row[0] for row in rows}


def _pad_cep(prefix: str) -> str:
    """Pad 5-digit CEP prefix to 8-digit full CEP for API lookup."""
    prefix = prefix.strip().replace("-", "")
    if len(prefix) <= 5:
        return prefix.ljust(8, "0")
    return prefix[:8]


def _fetch_cep(cep: str) -> dict | None:
    """Fetch single CEP from ViaCEP with retry."""
    url = f"{VIACEP_BASE_URL}/{cep}/json/"
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = requests.get(url, timeout=REQUEST_TIMEOUT)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("erro"):
                    return None  # Invalid CEP
                return data
            if resp.status_code in (429, 500, 502, 503, 504):
                wait = BACKOFF_BASE**attempt
                logger.warning(f"ViaCEP {resp.status_code} for {cep}, retry in {wait}s")
                time.sleep(wait)
                continue
            logger.warning(f"ViaCEP returned {resp.status_code} for {cep}")
            return None
        except requests.exceptions.RequestException as e:
            wait = BACKOFF_BASE**attempt
            logger.warning(f"ViaCEP error for {cep}: {e}, retry in {wait}s")
            time.sleep(wait)
    logger.error(f"ViaCEP failed after {MAX_RETRIES} attempts for {cep}")
    return None


def _save_enrichment(engine, prefix: str, data: dict | None) -> None:
    """Insert or update a single CEP enrichment record."""
    if data:
        sql = text(f"""
            INSERT INTO {RAW_SCHEMA}.cep_enrichment
                (cep, cep_prefix, localidade, uf, estado, regiao, bairro, logradouro, valid, _loaded_at)
            VALUES
                (:cep, :prefix, :localidade, :uf, :estado, :regiao, :bairro, :logradouro, true, NOW())
            ON CONFLICT (cep) DO UPDATE SET
                localidade = EXCLUDED.localidade,
                uf = EXCLUDED.uf,
                estado = EXCLUDED.estado,
                regiao = EXCLUDED.regiao,
                bairro = EXCLUDED.bairro,
                logradouro = EXCLUDED.logradouro,
                valid = true,
                _loaded_at = NOW()
        """)
        params = {
            "cep": data.get("cep", ""),
            "prefix": prefix,
            "localidade": data.get("localidade", ""),
            "uf": data.get("uf", ""),
            "estado": data.get("estado", ""),
            "regiao": data.get("regiao", ""),
            "bairro": data.get("bairro", ""),
            "logradouro": data.get("logradouro", ""),
        }
    else:
        sql = text(f"""
            INSERT INTO {RAW_SCHEMA}.cep_enrichment
                (cep, cep_prefix, valid, _loaded_at)
            VALUES
                (:cep, :prefix, false, NOW())
            ON CONFLICT (cep) DO NOTHING
        """)
        params = {"cep": _pad_cep(prefix), "prefix": prefix}

    with engine.begin() as conn:
        conn.execute(sql, params)


def enrich_ceps(limit: int = 1000) -> int:
    """Enrich top N CEPs from customer data via ViaCEP API.

    Skips already-cached CEPs. Returns count of newly enriched CEPs.
    """
    engine = get_engine()
    _ensure_table(engine)

    top_prefixes = _get_top_ceps(engine, limit=limit)
    cached = _get_cached_prefixes(engine)

    to_enrich = [p for p in top_prefixes if p not in cached]
    logger.info(
        f"CEP enrichment: {len(top_prefixes)} top CEPs, "
        f"{len(cached)} cached, {len(to_enrich)} to enrich"
    )

    if not to_enrich:
        logger.info("All top CEPs already enriched")
        return 0

    enriched = 0
    for i, prefix in enumerate(to_enrich, 1):
        full_cep = _pad_cep(prefix)
        data = _fetch_cep(full_cep)
        _save_enrichment(engine, prefix, data)
        enriched += 1

        if i % 50 == 0:
            logger.info(f"Progress: {i}/{len(to_enrich)} CEPs enriched")

        time.sleep(REQUEST_DELAY)

    logger.info(f"CEP enrichment complete: {enriched} new CEPs enriched")
    return enriched


def run_cep_enrichment() -> int:
    """Entry point for pipeline integration."""
    with track_pipeline("enrichment", "viacep_cep") as ctx:
        count = enrich_ceps(limit=1000)
        ctx["rows_processed"] = count
    return count


if __name__ == "__main__":
    run_cep_enrichment()
