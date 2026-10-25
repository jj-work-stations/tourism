SHELL := /bin/bash
COMPOSE := docker compose
PYTHON := .venv/bin/python
PIP := .venv/bin/pip
PYTEST := .venv/bin/pytest
RUFF := .venv/bin/ruff

.PHONY: help setup env up down dev logs ps build test lint migrate seed clean gateway

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

env: ## Create .env from the example if missing
	@test -f .env || (cp .env.example .env && echo "created .env")

setup: env ## Install local backend and frontend dependencies
	cd backend && python3 -m venv .venv && .venv/bin/pip install -e ".[dev]"
	cd frontend && npm ci

up: env ## Build and start the full stack
	$(COMPOSE) up --build -d
	@echo "web:  http://localhost:3000"
	@echo "api:  http://localhost:8000/docs"

gateway: env ## Start the stack plus the nginx edge on :8080
	$(COMPOSE) --profile gateway up --build -d
	@echo "edge: http://localhost:8080"

dev: env ## Run the stack with hot reload
	$(COMPOSE) -f docker-compose.yml -f docker-compose.dev.yml up --build

down: ## Stop containers (volumes are preserved)
	$(COMPOSE) down

logs: ## Tail all service logs
	$(COMPOSE) logs -f --tail=200

ps: ## Show service status
	$(COMPOSE) ps

build: ## Build production images
	$(COMPOSE) build

test: ## Run backend tests
	cd backend && $(PYTEST) -q

lint: ## Run backend lint and frontend typecheck
	cd backend && $(RUFF) check app tests
	cd frontend && npm run typecheck

migrate: ## Apply database migrations locally
	cd backend && .venv/bin/alembic upgrade head

seed: ## Seed demo data locally (idempotent)
	cd backend && $(PYTHON) -m app.db.seed

clean: ## Remove build artifacts and stop the stack
	$(COMPOSE) down --remove-orphans
	rm -rf frontend/.next frontend/tsconfig.tsbuildinfo
	find backend -type d -name __pycache__ -prune -exec rm -rf {} +
