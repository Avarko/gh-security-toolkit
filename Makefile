.PHONY: help dashboard-dev dashboard-build dashboard-test-data dashboard-clean \
        localstack-start localstack-stop localstack-setup localstack-dev

help:
	@echo "GitHub Security Toolkit - Development Commands"
	@echo ""
	@echo "Dashboard Commands:"
	@echo "  make dashboard-dev           - Start dashboard dev server (localhost:5173)"
	@echo "  make dashboard-build         - Build production dashboard"
	@echo "  make dashboard-test-data     - Generate realistic test scan data"
	@echo "  make dashboard-clean         - Clean dashboard build artifacts"
	@echo ""
	@echo "LocalStack Commands (S3 development):"
	@echo "  make localstack-start        - Start LocalStack container"
	@echo "  make localstack-stop         - Stop LocalStack container"
	@echo "  make localstack-setup        - Initialize S3 buckets with test data"
	@echo "  make localstack-dev          - Full dev workflow (start + setup + dev server)"
	@echo ""
	@echo "For more dashboard commands, see: cd dashboard && make help"
	@echo ""

# Dashboard commands (delegated to dashboard/Makefile)
dashboard-dev:
	@$(MAKE) -C dashboard dev

dashboard-build:
	@$(MAKE) -C dashboard build

dashboard-test-data:
	@$(MAKE) -C dashboard test-data

dashboard-clean:
	@$(MAKE) -C dashboard clean

# LocalStack commands (delegated to dashboard/Makefile)
localstack-start:
	@$(MAKE) -C dashboard localstack-start

localstack-stop:
	@$(MAKE) -C dashboard localstack-stop

localstack-setup:
	@$(MAKE) -C dashboard localstack-setup

localstack-dev:
	@$(MAKE) -C dashboard localstack-dev
