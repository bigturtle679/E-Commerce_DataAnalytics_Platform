"""FakeStore API client with configurable retry, pagination scaffold, and HTTP status handling."""

import time
from typing import Any

import requests

from config.settings import (
    API_REQUEST_TIMEOUT,
    API_RETRY_BACKOFF_BASE,
    API_RETRY_BACKOFF_FACTOR,
    API_RETRY_MAX_ATTEMPTS,
    FAKESTORE_API_BASE_URL,
)
from ingestion.utils.logger import get_logger

logger = get_logger("fakestore_client")

_RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}


class FakeStoreClient:
    def __init__(self):
        self.base_url = FAKESTORE_API_BASE_URL.rstrip("/")
        self.timeout = API_REQUEST_TIMEOUT
        self.max_attempts = API_RETRY_MAX_ATTEMPTS
        self.backoff_base = API_RETRY_BACKOFF_BASE
        self.backoff_factor = API_RETRY_BACKOFF_FACTOR
        self.session = requests.Session()

    def _request_with_retry(self, url: str, params: dict | None = None) -> Any:
        for attempt in range(1, self.max_attempts + 1):
            try:
                logger.info(f"GET {url} (attempt {attempt}/{self.max_attempts})")
                response = self.session.get(url, params=params, timeout=self.timeout)

                if response.status_code == 200:
                    return response.json()

                if response.status_code == 429:
                    retry_after = int(response.headers.get("Retry-After", 0))
                    wait = max(retry_after, self._backoff_delay(attempt))
                    logger.warning(f"Rate limited (429). Waiting {wait}s")
                    time.sleep(wait)
                    continue

                if response.status_code in _RETRYABLE_STATUS_CODES:
                    wait = self._backoff_delay(attempt)
                    logger.warning(f"Server error ({response.status_code}). Retrying in {wait}s")
                    time.sleep(wait)
                    continue

                # Non-retryable client error
                logger.error(f"Client error ({response.status_code}) for {url}. Skipping.")
                response.raise_for_status()

            except requests.exceptions.ConnectionError as e:
                wait = self._backoff_delay(attempt)
                logger.warning(f"Connection error: {e}. Retrying in {wait}s")
                time.sleep(wait)
            except requests.exceptions.Timeout:
                wait = self._backoff_delay(attempt)
                logger.warning(f"Timeout for {url}. Retrying in {wait}s")
                time.sleep(wait)

        raise RuntimeError(f"Failed after {self.max_attempts} attempts: {url}")

    def _backoff_delay(self, attempt: int) -> float:
        return self.backoff_base * (self.backoff_factor ** (attempt - 1))

    def _paginated_fetch(self, endpoint: str, limit: int = 50, max_pages: int = 100) -> list[dict]:
        """Generic paginator. FakeStore returns all at once, but this scaffold
        supports offset/limit pagination for future API migrations."""
        all_results = []
        for page in range(max_pages):
            offset = page * limit
            params = {"limit": limit, "offset": offset} if page > 0 else {"limit": limit}
            url = f"{self.base_url}/{endpoint}"
            data = self._request_with_retry(url, params=params)

            if not data:
                break

            all_results.extend(data)
            if len(data) < limit:
                break  # Last page

        logger.info(f"Fetched {len(all_results)} records from /{endpoint}")
        return all_results

    def get_products(self) -> list[dict]:
        return self._paginated_fetch("products")

    def get_users(self) -> list[dict]:
        return self._paginated_fetch("users")

    def get_carts(self) -> list[dict]:
        return self._paginated_fetch("carts")
