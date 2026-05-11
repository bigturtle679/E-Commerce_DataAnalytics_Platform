"""API ingestion pipeline — fetches from FakeStore API and loads into raw.api_* tables.

Emits pipeline metrics for observability.
"""

import json

import pandas as pd

from config.settings import RAW_SCHEMA
from ingestion.api.fakestore_client import FakeStoreClient
from ingestion.utils.db import ensure_schemas, save_api_sync_state, upsert_dataframe
from ingestion.utils.logger import get_logger
from ingestion.utils.metrics import track_pipeline

logger = get_logger("api_ingest")


def _flatten_products(products: list[dict]) -> pd.DataFrame:
    rows = []
    for p in products:
        rating = p.get("rating", {})
        rows.append(
            {
                "id": int(p["id"]),
                "title": str(p.get("title", "")),
                "price": float(p.get("price", 0)),
                "description": str(p.get("description", "")),
                "category": str(p.get("category", "")),
                "image": str(p.get("image", "")),
                "rating_rate": float(rating.get("rate", 0)),
                "rating_count": int(rating.get("count", 0)),
            }
        )
    return pd.DataFrame(rows)


def _flatten_users(users: list[dict]) -> pd.DataFrame:
    rows = []
    for u in users:
        name = u.get("name", {})
        address = u.get("address", {})
        rows.append(
            {
                "id": int(u["id"]),
                "email": str(u.get("email", "")),
                "username": str(u.get("username", "")),
                "firstname": str(name.get("firstname", "")),
                "lastname": str(name.get("lastname", "")),
                "phone": str(u.get("phone", "")),
                "city": str(address.get("city", "")),
                "street": str(address.get("street", "")),
                "zipcode": str(address.get("zipcode", "")),
            }
        )
    return pd.DataFrame(rows)


def _flatten_carts(carts: list[dict]) -> pd.DataFrame:
    rows = []
    for c in carts:
        rows.append(
            {
                "id": int(c["id"]),
                "user_id": int(c.get("userId", 0)),
                "date": str(c.get("date", "")),
                "products_json": json.dumps(c.get("products", [])),
            }
        )
    return pd.DataFrame(rows)


def ingest_products(client: FakeStoreClient) -> int:
    data = client.get_products()
    if not data:
        logger.warning("No products returned from API")
        return 0
    df = _flatten_products(data)
    count = upsert_dataframe(df, "api_products", RAW_SCHEMA, conflict_columns=["id"])
    save_api_sync_state("products")
    return count


def ingest_users(client: FakeStoreClient) -> int:
    data = client.get_users()
    if not data:
        logger.warning("No users returned from API")
        return 0
    df = _flatten_users(data)
    count = upsert_dataframe(df, "api_users", RAW_SCHEMA, conflict_columns=["id"])
    save_api_sync_state("users")
    return count


def ingest_carts(client: FakeStoreClient) -> int:
    data = client.get_carts()
    if not data:
        logger.warning("No carts returned from API")
        return 0
    df = _flatten_carts(data)
    count = upsert_dataframe(df, "api_carts", RAW_SCHEMA, conflict_columns=["id"])
    save_api_sync_state("carts")
    return count


def run_api_ingestion() -> dict[str, int]:
    ensure_schemas()
    client = FakeStoreClient()
    logger.info("Starting API ingestion")

    results = {}
    for name, func in [
        ("api_products", ingest_products),
        ("api_users", ingest_users),
        ("api_carts", ingest_carts),
    ]:
        with track_pipeline("api_ingestion", name) as ctx:
            try:
                count = func(client)
                ctx["rows_processed"] = count
                results[name] = count
                logger.info(f"✓ {name}: {count} rows")
            except Exception as e:
                logger.error(f"✗ {name}: {e}", exc_info=True)
                results[name] = -1
                raise  # re-raise so track_pipeline records failure

    logger.info(f"API ingestion complete: {results}")
    return results


if __name__ == "__main__":
    run_api_ingestion()
