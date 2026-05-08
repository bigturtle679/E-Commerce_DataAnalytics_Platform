"""Observability setup — creates SQL views idempotently."""

from pathlib import Path
from sqlalchemy import text
from ingestion.utils.db import get_engine
from ingestion.utils.logger import get_logger

logger = get_logger("observability")

SQL_DIR = Path(__file__).parent / "sql"


def create_observability_views() -> None:
    """Execute create_views.sql to set up observability schema."""
    sql_file = SQL_DIR / "create_views.sql"
    sql = sql_file.read_text()

    engine = get_engine()
    with engine.begin() as conn:
        for statement in sql.split(";"):
            statement = statement.strip()
            if statement:
                conn.execute(text(statement))

    logger.info("Observability views created/updated")


if __name__ == "__main__":
    create_observability_views()
    print("Observability views ready.")
