.PHONY: up down build test lint migrate shell-auth shell-ingestion logs

up:
	docker compose up -d

down:
	docker compose down

build:
	docker compose build

build-nocache:
	docker compose build --no-cache

logs:
	docker compose logs -f

# Run all backend tests
test:
	docker compose run --rm auth-service pytest tests/ -v --cov=app
	docker compose run --rm api-gateway pytest tests/ -v --cov=app
	docker compose run --rm data-ingestion-service pytest tests/ -v --cov=app

# Lint all backend services
lint:
	@for svc in api-gateway auth-service data-ingestion-service; do \
		echo "=== Linting $$svc ==="; \
		cd services/$$svc && black --check app/ tests/ && isort --check-only app/ tests/ && flake8 app/ tests/ --max-line-length 100; \
		cd ../..; \
	done

# Run Alembic migrations inside the auth-service container
migrate:
	docker compose run --rm auth-service flask db upgrade

# Generate a new Alembic migration (usage: make migration MSG="add table foo")
migration:
	docker compose run --rm auth-service flask db migrate -m "$(MSG)"

shell-auth:
	docker compose exec auth-service /bin/bash

shell-ingestion:
	docker compose exec data-ingestion-service /bin/bash

# Install pre-commit hooks locally
hooks:
	pre-commit install
