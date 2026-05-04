"""dbt test wrapper — runs dbt test and asserts exit code."""

import subprocess
import sys
from pathlib import Path

import pytest

DBT_PROJECT_DIR = Path(__file__).resolve().parent.parent / "dbt_project"


@pytest.mark.skipif(
    not (DBT_PROJECT_DIR / "dbt_project.yml").exists(),
    reason="dbt project not found"
)
class TestDbt:
    def _run_dbt(self, *args):
        cmd = [
            sys.executable, "-m", "dbt",
            *args,
            "--project-dir", str(DBT_PROJECT_DIR),
            "--profiles-dir", str(DBT_PROJECT_DIR),
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, cwd=str(DBT_PROJECT_DIR))
        return result

    def test_dbt_debug(self):
        result = self._run_dbt("debug")
        assert result.returncode == 0, f"dbt debug failed:\n{result.stdout}\n{result.stderr}"

    def test_dbt_compile(self):
        result = self._run_dbt("compile")
        assert result.returncode == 0, f"dbt compile failed:\n{result.stdout}\n{result.stderr}"

    def test_dbt_test(self):
        result = self._run_dbt("test")
        assert result.returncode == 0, f"dbt test failed:\n{result.stdout}\n{result.stderr}"
