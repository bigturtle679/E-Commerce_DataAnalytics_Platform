"""FastAPI application — read-only API for the data platform dashboard."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.config import CORS_ORIGINS
from api.database import init_pool, close_pool, ensure_metrics_table
from api.routers import pipeline, health, analytics, quality


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_pool()
    ensure_metrics_table()
    yield
    close_pool()


app = FastAPI(
    title="E-Commerce Data Platform API",
    version="1.0.0",
    description="Read-only API for pipeline observability and analytics",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(pipeline.router)
app.include_router(health.router)
app.include_router(analytics.router)
app.include_router(quality.router)


@app.get("/")
def root():
    return {"service": "ecommerce-data-platform-api", "version": "1.0.0"}
