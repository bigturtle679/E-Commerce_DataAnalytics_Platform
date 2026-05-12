"""FX exchange rate enrichment client.

Fetches BRL → USD/EUR exchange rates from ExchangeRate API.
Results cached in raw.fx_rates — only fetches if no rate exists for today.
"""

import os
from datetime import UTC, datetime

import requests
from sqlalchemy import text

from config.settings import RAW_SCHEMA
from ingestion.utils.db import get_engine
from ingestion.utils.logger import get_logger
from ingestion.utils.metrics import track_pipeline

logger = get_logger("fx_client")

EXCHANGE_RATE_API_KEY = os.getenv("EXCHANGE_RATE_API_KEY", "")
EXCHANGE_RATE_BASE_URL = "https://v6.exchangerate-api.com/v6"
REQUEST_TIMEOUT = 15
TARGET_CURRENCIES = ["USD", "EUR"]

_CREATE_TABLE = f"""
CREATE TABLE IF NOT EXISTS {RAW_SCHEMA}.fx_rates (
    id              SERIAL,
    base_currency   VARCHAR(3)  NOT NULL,
    target_currency VARCHAR(3)  NOT NULL,
    rate            NUMERIC(12,6) NOT NULL,
    fetched_date    DATE        NOT NULL,
    _loaded_at      TIMESTAMP   DEFAULT NOW(),
    PRIMARY KEY (base_currency, target_currency, fetched_date)
)
"""


def _ensure_table(engine) -> None:
    with engine.begin() as conn:
        conn.execute(text(_CREATE_TABLE))


def _has_today_rates(engine) -> bool:
    """Check if we already have rates for today."""
    sql = f"""
        SELECT COUNT(*) FROM {RAW_SCHEMA}.fx_rates
        WHERE fetched_date = CURRENT_DATE AND base_currency = 'BRL'
    """
    with engine.begin() as conn:
        count = conn.execute(text(sql)).scalar()
    return count >= len(TARGET_CURRENCIES)


def _fetch_rates() -> dict | None:
    """Fetch latest BRL exchange rates from ExchangeRate API."""
    if not EXCHANGE_RATE_API_KEY:
        logger.warning("EXCHANGE_RATE_API_KEY not set — skipping FX enrichment")
        return None

    url = f"{EXCHANGE_RATE_BASE_URL}/{EXCHANGE_RATE_API_KEY}/latest/BRL"
    try:
        resp = requests.get(url, timeout=REQUEST_TIMEOUT)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("result") == "success":
                return data.get("conversion_rates", {})
            logger.warning(f"FX API error: {data.get('error-type', 'unknown')}")
            return None
        logger.error(f"FX API returned {resp.status_code}")
        return None
    except requests.exceptions.RequestException as e:
        logger.error(f"FX API request failed: {e}")
        return None


def fetch_fx_rates() -> int:
    """Fetch and store today's BRL exchange rates.

    Returns number of rates stored. Skips if today's rates already exist.
    """
    engine = get_engine()
    _ensure_table(engine)

    if _has_today_rates(engine):
        logger.info("FX rates already fetched for today — skipping")
        return 0

    rates = _fetch_rates()
    if not rates:
        return 0

    today = datetime.now(UTC).date()
    stored = 0

    for currency in TARGET_CURRENCIES:
        rate = rates.get(currency)
        if rate is None:
            logger.warning(f"No rate found for BRL → {currency}")
            continue

        sql = text(f"""
            INSERT INTO {RAW_SCHEMA}.fx_rates
                (base_currency, target_currency, rate, fetched_date, _loaded_at)
            VALUES
                ('BRL', :currency, :rate, :date, NOW())
            ON CONFLICT (base_currency, target_currency, fetched_date) DO UPDATE SET
                rate = EXCLUDED.rate,
                _loaded_at = NOW()
        """)
        with engine.begin() as conn:
            conn.execute(sql, {"currency": currency, "rate": rate, "date": today})
        stored += 1
        logger.info(f"Stored FX rate: BRL -> {currency} = {rate}")

    logger.info(f"FX enrichment complete: {stored} rates stored for {today}")
    return stored


def run_fx_enrichment() -> int:
    """Entry point for pipeline integration."""
    with track_pipeline("enrichment", "fx_rates") as ctx:
        count = fetch_fx_rates()
        ctx["rows_processed"] = count
    return count


if __name__ == "__main__":
    run_fx_enrichment()
