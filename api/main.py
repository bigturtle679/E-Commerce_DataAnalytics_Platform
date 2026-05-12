"""FastAPI application — read-only API for the data platform dashboard."""

from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator

from api.auth import verify_api_key
from api.config import CORS_ORIGINS
from api.database import close_pool, ensure_metrics_table, init_pool
from api.routers import analytics, health, pipeline, quality


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_pool()
    ensure_metrics_table()
    yield
    close_pool()


app = FastAPI(
    title="Meridian API",
    version="2.0.0",
    description="Read-only API for pipeline observability and analytics",
    lifespan=lifespan,
    dependencies=[Depends(verify_api_key)],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)

# Prometheus instrumentation — exposes /metrics endpoint
Instrumentator(
    should_ignore_untemplated=True,
    excluded_handlers=["/metrics", "/docs", "/openapi.json"],
).instrument(app).expose(app, include_in_schema=False)

app.include_router(pipeline.router)
app.include_router(health.router)
app.include_router(analytics.router)
app.include_router(quality.router)


@app.get("/")
def root():
    return {"service": "meridian-api", "version": "2.0.0"}
