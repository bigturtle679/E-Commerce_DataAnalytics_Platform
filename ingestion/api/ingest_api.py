"""API enrichment pipeline — ViaCEP geographic data + FX exchange rates.

Replaces the former FakeStore API ingestion with coherent enrichment
that aligns with the Brazilian e-commerce dataset.

Emits pipeline metrics for observability.
"""

from ingestion.api.fx_client import run_fx_enrichment
from ingestion.api.viacep_client import run_cep_enrichment
from ingestion.utils.db import ensure_schemas
from ingestion.utils.logger import get_logger

logger = get_logger("api_ingest")


def run_api_ingestion() -> dict[str, int]:
    """Run all enrichment pipelines.

    1. ViaCEP — enrich top 1000 CEPs with geographic data
    2. FX rates — fetch today's BRL → USD/EUR exchange rates
    """
    ensure_schemas()
    logger.info("Starting enrichment ingestion")

    results = {}

    # CEP geographic enrichment
    try:
        cep_count = run_cep_enrichment()
        results["cep_enrichment"] = cep_count
        logger.info(f"✓ CEP enrichment: {cep_count} new CEPs")
    except Exception as e:
        logger.error(f"✗ CEP enrichment failed: {e}", exc_info=True)
        results["cep_enrichment"] = -1

    # FX exchange rate enrichment
    try:
        fx_count = run_fx_enrichment()
        results["fx_rates"] = fx_count
        logger.info(f"✓ FX enrichment: {fx_count} rates")
    except Exception as e:
        logger.error(f"✗ FX enrichment failed: {e}", exc_info=True)
        results["fx_rates"] = -1

    logger.info(f"Enrichment ingestion complete: {results}")
    return results


if __name__ == "__main__":
    run_api_ingestion()
