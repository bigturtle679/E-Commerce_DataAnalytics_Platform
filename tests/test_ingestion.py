"""Ingestion pipeline tests."""

import sys
from pathlib import Path
from unittest.mock import patch

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ingestion.batch.dtype_specs import CSV_FILE_MAP, DTYPE_SPECS, PRIMARY_KEYS


class TestDtypeSpecs:
    def test_all_tables_have_dtype_spec(self):
        for table in CSV_FILE_MAP:
            assert table in DTYPE_SPECS, f"Missing dtype spec for {table}"

    def test_all_tables_have_primary_keys(self):
        for table in CSV_FILE_MAP:
            assert table in PRIMARY_KEYS, f"Missing primary key for {table}"

    def test_dtype_specs_not_empty(self):
        for table, spec in DTYPE_SPECS.items():
            assert len(spec) > 0, f"Empty dtype spec for {table}"


class TestCSVSchemaValidation:
    @pytest.fixture
    def dataset_path(self):
        return Path(__file__).resolve().parent.parent.parent / "dataset"

    def test_csv_files_exist(self, dataset_path):
        if not dataset_path.exists():
            pytest.skip("dataset/ directory not found")
        for _table, filename in CSV_FILE_MAP.items():
            filepath = dataset_path / filename
            assert filepath.exists(), f"Missing CSV: {filename}"

    def test_csv_columns_match_dtype_spec(self, dataset_path):
        for table, filename in CSV_FILE_MAP.items():
            filepath = dataset_path / filename
            if not filepath.exists():
                pytest.skip(f"{filename} not found")
            df = pd.read_csv(filepath, nrows=0)
            expected_cols = set(DTYPE_SPECS[table].keys())
            actual_cols = set(df.columns)
            missing = expected_cols - actual_cols
            assert not missing, f"[{table}] Missing columns: {missing}"

    def test_csv_not_empty(self, dataset_path):
        for table, filename in CSV_FILE_MAP.items():
            filepath = dataset_path / filename
            if not filepath.exists():
                pytest.skip(f"{filename} not found")
            df = pd.read_csv(filepath, nrows=1)
            assert len(df) > 0, f"[{table}] CSV is empty"


class TestAPIClientConfig:
    def test_retry_config_loaded(self):
        from config.settings import (
            API_REQUEST_TIMEOUT,
            API_RETRY_BACKOFF_BASE,
            API_RETRY_BACKOFF_FACTOR,
            API_RETRY_MAX_ATTEMPTS,
        )

        assert API_RETRY_MAX_ATTEMPTS >= 1
        assert API_RETRY_BACKOFF_BASE >= 0
        assert API_RETRY_BACKOFF_FACTOR >= 1
        assert API_REQUEST_TIMEOUT > 0

    def test_api_base_url_set(self):
        from config.settings import FAKESTORE_API_BASE_URL

        assert FAKESTORE_API_BASE_URL.startswith("http")


class TestAPIResponseShape:
    @patch("ingestion.api.fakestore_client.FakeStoreClient._request_with_retry")
    def test_flatten_products(self, mock_request):
        mock_request.return_value = [
            {
                "id": 1,
                "title": "Test",
                "price": 9.99,
                "description": "desc",
                "category": "cat",
                "image": "url",
                "rating": {"rate": 4.5, "count": 10},
            }
        ]
        from ingestion.api.ingest_api import _flatten_products

        df = _flatten_products(mock_request.return_value)
        assert "id" in df.columns
        assert "rating_rate" in df.columns
        assert len(df) == 1

    @patch("ingestion.api.fakestore_client.FakeStoreClient._request_with_retry")
    def test_flatten_users(self, mock_request):
        mock_request.return_value = [
            {
                "id": 1,
                "email": "a@b.com",
                "username": "user1",
                "name": {"firstname": "John", "lastname": "Doe"},
                "phone": "123",
                "address": {"city": "NYC", "street": "5th", "zipcode": "10001"},
            }
        ]
        from ingestion.api.ingest_api import _flatten_users

        df = _flatten_users(mock_request.return_value)
        assert "firstname" in df.columns
        assert "city" in df.columns
        assert len(df) == 1


class TestDatabaseConfig:
    def test_database_url_format(self):
        from config.settings import DATABASE_URL

        assert DATABASE_URL.startswith("postgresql://")
        assert "@" in DATABASE_URL
