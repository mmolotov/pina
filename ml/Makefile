.DEFAULT_GOAL := help

UV ?= uv

.PHONY: help proto lint format typecheck test run clean

help:
	@echo "make proto     - generate pina.ml.v1 gRPC modules from ../proto"
	@echo "make lint      - ruff lint + format check"
	@echo "make format    - ruff auto-format + autofix"
	@echo "make typecheck - mypy over source, tests, and scripts"
	@echo "make test      - generate gRPC modules and run pytest (coverage gate)"
	@echo "make run       - generate gRPC modules and start the service"
	@echo "make clean     - remove generated modules and tool caches"

proto:
	$(UV) run bash ../proto/scripts/generate-python.sh src

lint:
	$(UV) run ruff check .
	$(UV) run ruff format --check .

typecheck: proto
	$(UV) run mypy

format:
	$(UV) run ruff format .
	$(UV) run ruff check --fix .

test: proto
	$(UV) run pytest

run: proto
	$(UV) run pina-ml

clean:
	rm -rf src/pina .pytest_cache .ruff_cache .mypy_cache .coverage
