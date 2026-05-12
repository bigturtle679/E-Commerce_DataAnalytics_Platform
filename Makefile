# ─── Meridian — Data Platform ─────────────────────────────────
# Developer-friendly Makefile for common operations.
# Usage: make <target>
#
# Requires: Docker, Docker Compose (for stack commands)
# Quality commands (lint, format, ci) run locally — no Docker needed.

.PHONY: help up down rebuild logs ingest enrich transform test lint format \
        ci check test-unit frontend-check reset-db precommit monitoring \
        api frontend airflow status clean verify psql shell

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
	@echo "$(CYAN)Meridian — Data Platform$(NC)"
	@echo "$(CYAN)========================$(NC)"
	@echo ""
	@echo "$(YELLOW)Stack Lifecycle$(NC)"
	@grep -E '^(up|down|rebuild|clean):.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-18s$(NC) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(YELLOW)Code Quality (local)$(NC)"
	@grep -E '^(lint|format|test-unit|frontend-check|ci|check):.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-18s$(NC) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(YELLOW)Pipeline (Docker)$(NC)"
	@grep -E '^(ingest|transform|seed|test):.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-18s$(NC) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(YELLOW)Operations$(NC)"
	@grep -E '^(logs|status|verify|psql|shell|reset-db|airflow|monitoring):.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-18s$(NC) %s\n", $$1, $$2}'
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

# ── Code Quality (runs locally — no Docker needed) ───────────
lint: ## Lint Python code (ruff + black --check)
	@echo "$(CYAN)▸ Ruff linting...$(NC)"
	@python -m ruff check .
	@echo "$(CYAN)▸ Black format check...$(NC)"
	@python -m black --check --quiet .
	@echo "$(GREEN)✓ All lint checks passed.$(NC)"

format: ## Auto-format Python code (black + ruff --fix)
	@echo "$(CYAN)▸ Formatting with Black...$(NC)"
	@python -m black .
	@echo "$(CYAN)▸ Fixing lint issues with Ruff...$(NC)"
	@python -m ruff check --fix .
	@echo "$(GREEN)✓ Formatting complete.$(NC)"

test-unit: ## Run unit tests (no database required)
	@echo "$(CYAN)▸ Running unit tests...$(NC)"
	@python -m pytest tests/test_ingestion.py -v -m "not integration"
	@echo "$(GREEN)✓ Unit tests passed.$(NC)"

frontend-check: ## Validate frontend (lint + typecheck + build)
	@echo "$(CYAN)▸ ESLint...$(NC)"
	@cd frontend && npm run lint
	@echo "$(CYAN)▸ TypeScript validation...$(NC)"
	@cd frontend && npm run typecheck
	@echo "$(CYAN)▸ Production build verification...$(NC)"
	@cd frontend && npm run build
	@echo "$(GREEN)✓ Frontend validation passed.$(NC)"

ci: lint test-unit frontend-check ## Full CI validation (local)
	@echo ""
	@echo "$(GREEN)═══════════════════════════════════════$(NC)"
	@echo "$(GREEN)  ✓ All CI checks passed successfully  $(NC)"
	@echo "$(GREEN)═══════════════════════════════════════$(NC)"

check: ci ## Alias for 'make ci'

precommit: ## Install and run pre-commit hooks
	@echo "$(CYAN)▸ Running pre-commit hooks...$(NC)"
	@pre-commit run --all-files
	@echo "$(GREEN)✓ Pre-commit checks passed.$(NC)"

# ── Data Pipeline (Docker) ────────────────────────────────────
ingest: ## Run full ingestion (batch CSVs + enrichment APIs)
	@echo "$(CYAN)▸ Ingesting batch CSVs...$(NC)"
	$(EXEC_API) python -m ingestion.batch.ingest_csv
	@echo "$(CYAN)▸ Running enrichment (ViaCEP + FX rates)...$(NC)"
	$(EXEC_API) python -m ingestion.api.ingest_api
	@echo "$(GREEN)✓ Ingestion complete.$(NC)"

enrich: ## Run enrichment only (ViaCEP + FX rates)
	@echo "$(CYAN)▸ Running enrichment pipelines...$(NC)"
	$(EXEC_API) python -m ingestion.api.ingest_api
	@echo "$(GREEN)✓ Enrichment complete.$(NC)"

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

test: ## Run full test suite in Docker
	@echo "$(CYAN)▸ Running tests in container...$(NC)"
	$(EXEC_API) python -m pytest tests/ -v
	@echo "$(GREEN)✓ Tests complete.$(NC)"

# ── Logs ──────────────────────────────────────────────────────
logs: ## Tail logs for all services
	$(COMPOSE) logs -f --tail=100

logs-api: ## Tail API logs only
	$(COMPOSE) logs -f --tail=100 api

logs-db: ## Tail PostgreSQL logs only
	$(COMPOSE) logs -f --tail=100 postgres

# ── Individual Services ───────────────────────────────────────
api: ## Open API docs in browser
	@echo "$(GREEN)▸ API: http://localhost:8000/docs$(NC)"

frontend: ## Open frontend dashboard in browser
	@echo "$(GREEN)▸ Dashboard: http://localhost:3000$(NC)"

airflow: ## Start Airflow services (scheduler + webserver)
	@echo "$(CYAN)▸ Starting Airflow...$(NC)"
	$(COMPOSE) --profile airflow up -d --build
	@echo "$(GREEN)▸ Airflow UI: http://localhost:8080 (admin/admin)$(NC)"

monitoring: ## Start monitoring stack (Prometheus + Grafana)
	@echo "$(CYAN)▸ Starting monitoring stack...$(NC)"
	$(COMPOSE) --profile monitoring up -d --build
	@echo "$(GREEN)▸ Prometheus: http://localhost:9090$(NC)"
	@echo "$(GREEN)▸ Grafana:    http://localhost:3001 (admin/admin)$(NC)"

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

reset-db: ## Reset database (stop + delete volume + restart)
	@echo "$(RED)▸ Resetting database...$(NC)"
	$(COMPOSE) stop postgres
	$(COMPOSE) rm -f postgres
	docker volume rm ecommerce-postgres-data 2>/dev/null || true
	@echo "$(CYAN)▸ Restarting with fresh database...$(NC)"
	$(COMPOSE) up -d postgres
	@echo "$(YELLOW)⏳ Waiting for PostgreSQL to be ready...$(NC)"
	@sleep 5
	@echo "$(GREEN)✓ Database reset complete. Run 'make seed' to repopulate.$(NC)"
