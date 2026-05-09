# ─── E-Commerce Data Platform ─────────────────────────────────
# Developer-friendly Makefile for common operations.
# Usage: make <target>
#
# Requires: Docker, Docker Compose

.PHONY: help up down rebuild logs ingest transform test lint \
        api frontend airflow status clean verify

# ── Config ────────────────────────────────────────────────────
COMPOSE  = docker compose --env-file .env.docker
EXEC_API = $(COMPOSE) exec api

# Colors (ANSI)
GREEN  = \033[0;32m
CYAN   = \033[0;36m
YELLOW = \033[0;33m
RED    = \033[0;31m
NC     = \033[0m

# ── Default ───────────────────────────────────────────────────
help: ## Show this help
	@echo ""
	@echo "$(CYAN)E-Commerce Data Platform$(NC)"
	@echo "$(CYAN)========================$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-14s$(NC) %s\n", $$1, $$2}'
	@echo ""

# ── Stack Lifecycle ───────────────────────────────────────────
up: ## Start all services (postgres + api + frontend)
	@echo "$(GREEN)▸ Starting platform...$(NC)"
	$(COMPOSE) up -d --build
	@echo "$(GREEN)✓ Stack is starting. Run 'make status' to check health.$(NC)"

down: ## Stop all services (preserves data)
	@echo "$(YELLOW)▸ Stopping platform...$(NC)"
	$(COMPOSE) down
	@echo "$(YELLOW)✓ All services stopped. Data preserved.$(NC)"

rebuild: ## Force rebuild all images and restart
	@echo "$(CYAN)▸ Rebuilding images...$(NC)"
	$(COMPOSE) down
	$(COMPOSE) build --no-cache
	$(COMPOSE) up -d
	@echo "$(GREEN)✓ Rebuild complete.$(NC)"

clean: ## Stop services and remove ALL data (volumes)
	@echo "$(RED)▸ Removing all containers and volumes...$(NC)"
	$(COMPOSE) down -v --remove-orphans
	@echo "$(RED)✓ All data removed.$(NC)"

# ── Logs ──────────────────────────────────────────────────────
logs: ## Tail logs for all services
	$(COMPOSE) logs -f --tail=100

logs-api: ## Tail API logs only
	$(COMPOSE) logs -f --tail=100 api

logs-db: ## Tail PostgreSQL logs only
	$(COMPOSE) logs -f --tail=100 postgres

# ── Data Pipeline ─────────────────────────────────────────────
ingest: ## Run full ingestion (batch CSVs + API)
	@echo "$(CYAN)▸ Ingesting batch CSVs...$(NC)"
	$(EXEC_API) python -m ingestion.batch.ingest_csv
	@echo "$(CYAN)▸ Ingesting FakeStore API...$(NC)"
	$(EXEC_API) python -m ingestion.api.ingest_api
	@echo "$(GREEN)✓ Ingestion complete.$(NC)"

transform: ## Run model materialization + indexes
	@echo "$(CYAN)▸ Materializing staging views + analytics tables...$(NC)"
	$(EXEC_API) python -m scripts.materialize_models
	@echo "$(CYAN)▸ Creating performance indexes...$(NC)"
	$(EXEC_API) python -m ingestion.utils.performance
	@echo "$(GREEN)✓ Transformation complete.$(NC)"

seed: ## Full pipeline: ingest + transform (first-time setup)
	@echo "$(CYAN)▸ Running full data pipeline...$(NC)"
	@$(MAKE) ingest
	@$(MAKE) transform
	@echo "$(GREEN)✓ Data pipeline complete. Dashboard is ready.$(NC)"

# ── Individual Services ───────────────────────────────────────
api: ## Open API docs in browser
	@echo "$(GREEN)▸ API: http://localhost:8000/docs$(NC)"

frontend: ## Open frontend dashboard in browser
	@echo "$(GREEN)▸ Dashboard: http://localhost:3000$(NC)"

airflow: ## Start Airflow services (scheduler + webserver)
	@echo "$(CYAN)▸ Starting Airflow...$(NC)"
	$(COMPOSE) --profile airflow up -d --build
	@echo "$(GREEN)▸ Airflow UI: http://localhost:8080 (admin/admin)$(NC)"

# ── Quality ───────────────────────────────────────────────────
test: ## Run Python test suite
	@echo "$(CYAN)▸ Running tests...$(NC)"
	$(EXEC_API) python -m pytest tests/ -v
	@echo "$(GREEN)✓ Tests complete.$(NC)"

lint: ## Run Python linting (ruff)
	@echo "$(CYAN)▸ Linting...$(NC)"
	$(EXEC_API) python -m ruff check . || true
	@echo "$(GREEN)✓ Lint complete.$(NC)"

# ── Operations ────────────────────────────────────────────────
status: ## Show service health status
	@echo "$(CYAN)▸ Service status:$(NC)"
	@$(COMPOSE) ps
	@echo ""
	@echo "$(CYAN)▸ Healthchecks:$(NC)"
	@$(COMPOSE) ps --format "table {{.Name}}\t{{.Status}}" 2>/dev/null || $(COMPOSE) ps

verify: ## Verify all services are healthy
	@echo "$(CYAN)▸ Running startup verification...$(NC)"
	@python scripts/verify_startup.py

psql: ## Open PostgreSQL shell
	$(COMPOSE) exec postgres psql -U postgres -d ecommerce

shell: ## Open bash shell in API container
	$(EXEC_API) bash
