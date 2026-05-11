"""Startup verification — lightweight healthcheck for all platform services.

Usage:
    python scripts/verify_startup.py

Checks PostgreSQL, API, and Frontend readiness with retries.
Exit code 0 = all healthy, 1 = something failed.
"""

import socket
import sys
import time
import urllib.error
import urllib.request

CHECKS = [
    {
        "name": "PostgreSQL",
        "host": "localhost",
        "port": 5432,
        "type": "tcp",
        "retries": 15,
        "delay": 2,
    },
    {
        "name": "FastAPI",
        "url": "http://localhost:8000/api/health/ping",
        "type": "http",
        "retries": 10,
        "delay": 3,
    },
    {
        "name": "Frontend",
        "url": "http://localhost:3000",
        "type": "http",
        "retries": 10,
        "delay": 3,
    },
]

GREEN = "\033[0;32m"
RED = "\033[0;31m"
CYAN = "\033[0;36m"
YELLOW = "\033[0;33m"
NC = "\033[0m"


def check_tcp(host: str, port: int, timeout: float = 2.0) -> bool:
    """Check if a TCP port is accepting connections."""
    try:
        sock = socket.create_connection((host, port), timeout=timeout)
        sock.close()
        return True
    except (TimeoutError, ConnectionRefusedError, OSError):
        return False


def check_http(url: str, timeout: float = 5.0) -> bool:
    """Check if an HTTP endpoint returns 2xx."""
    try:
        req = urllib.request.Request(url, method="GET")
        resp = urllib.request.urlopen(req, timeout=timeout)
        return 200 <= resp.status < 300
    except (urllib.error.URLError, urllib.error.HTTPError, OSError):
        return False


def verify_service(check: dict) -> bool:
    """Retry a service check until healthy or retries exhausted."""
    name = check["name"]
    retries = check["retries"]
    delay = check["delay"]

    print(f"  {CYAN}⏳ {name}{NC} — waiting...", end="", flush=True)

    for _attempt in range(1, retries + 1):
        if check["type"] == "tcp":
            ok = check_tcp(check["host"], check["port"])
        else:
            ok = check_http(check["url"])

        if ok:
            print(f"\r  {GREEN}✓  {name}{NC} — healthy" + " " * 20)
            return True

        time.sleep(delay)

    print(f"\r  {RED}✗  {name}{NC} — failed after {retries} retries" + " " * 10)
    return False


def main():
    print(f"\n{CYAN}Platform Startup Verification{NC}")
    print(f"{CYAN}{'=' * 30}{NC}\n")

    results = []
    for check in CHECKS:
        results.append(verify_service(check))

    print()
    if all(results):
        print(f"  {GREEN}✓ All services healthy!{NC}")
        print(f"  {GREEN}  Dashboard → http://localhost:3000{NC}")
        print(f"  {GREEN}  API       → http://localhost:8000/docs{NC}")
        print()
        return 0
    else:
        failed = [c["name"] for c, r in zip(CHECKS, results, strict=False) if not r]
        print(f"  {RED}✗ Failed: {', '.join(failed)}{NC}")
        print(f"  {YELLOW}  Run 'make logs' to inspect.{NC}")
        print()
        return 1


if __name__ == "__main__":
    sys.exit(main())
