import os
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env")


def _env(key: str, default: str = "") -> str:
    return os.getenv(key, default)


def _env_int(key: str, default: int = 0) -> int:
    return int(os.getenv(key, str(default)))


# PostgreSQL
POSTGRES_HOST = _env("POSTGRES_HOST", "localhost")
POSTGRES_PORT = _env_int("POSTGRES_PORT", 5432)
POSTGRES_DB = _env("POSTGRES_DB", "ecommerce")
POSTGRES_USER = _env("POSTGRES_USER", "postgres")
POSTGRES_PASSWORD = _env("POSTGRES_PASSWORD", "postgres")
DATABASE_URL = (
    f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}"
    f"@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"
)

# FakeStore API
FAKESTORE_API_BASE_URL = _env("FAKESTORE_API_BASE_URL", "https://fakestoreapi.com")
API_RETRY_MAX_ATTEMPTS = _env_int("API_RETRY_MAX_ATTEMPTS", 3)
API_RETRY_BACKOFF_BASE = _env_int("API_RETRY_BACKOFF_BASE", 1)
API_RETRY_BACKOFF_FACTOR = _env_int("API_RETRY_BACKOFF_FACTOR", 2)
API_REQUEST_TIMEOUT = _env_int("API_REQUEST_TIMEOUT", 30)

# Paths
DATASET_PATH = (PROJECT_ROOT / _env("DATASET_PATH", "../dataset")).resolve()
LOG_DIR = PROJECT_ROOT / "logs"
LOG_LEVEL = _env("LOG_LEVEL", "INFO")

# Schemas
RAW_SCHEMA = "raw"
STAGING_SCHEMA = "staging"
ANALYTICS_SCHEMA = "analytics"
