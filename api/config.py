"""API configuration — reads from project .env."""

import os
from pathlib import Path

from dotenv import load_dotenv

_PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(_PROJECT_ROOT / ".env")


def _env(key: str, default: str = "") -> str:
    return os.getenv(key, default)


def _env_int(key: str, default: int = 0) -> int:
    return int(os.getenv(key, str(default)))


POSTGRES_HOST = _env("POSTGRES_HOST", "localhost")
POSTGRES_PORT = _env_int("POSTGRES_PORT", 5432)
POSTGRES_DB = _env("POSTGRES_DB", "ecommerce")
POSTGRES_USER = _env("POSTGRES_USER", "postgres")
POSTGRES_PASSWORD = _env("POSTGRES_PASSWORD", "postgres")
DATABASE_URL = (
    f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}"
    f"@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"
)

API_HOST = _env("API_HOST", "0.0.0.0")
API_PORT = _env_int("API_PORT", 8000)
CORS_ORIGINS = _env("CORS_ORIGINS", "http://localhost:3000").split(",")
