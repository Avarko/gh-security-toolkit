.EXPORT_ALL_VARIABLES:

.DEFAULT_GOAL := help

# Avarko/gh-security-toolkit security scanner Makefile inclusion
include $(shell __GHST_FILE=.gh-security-toolkit/Makefile; \
	mkdir -p .gh-security-toolkit; \
	[ -f $$__GHST_FILE ] || curl -fsSL "https://raw.githubusercontent.com/Avarko/gh-security-toolkit/main/Makefile.scanners" -o $$__GHST_FILE; \
	echo $$__GHST_FILE)

.PHONY: help dashboard-dev dashboard-build dashboard-test-data dashboard-clean \
        localstack-start localstack-stop localstack-setup localstack-dev

help: ## Print help
	@awk 'BEGIN {FS = ":.*?## "} \
	     /^[a-zA-Z0-9_./-]+:.*?## / {printf "\033[36m%-25s\033[0m%s\n", $$1, $$2}' \
	     $(MAKEFILE_LIST) \
	| sort -u

# Dashboard commands (delegated to dashboard/Makefile)
dashboard-dev: ##  Start dashboard dev server (localhost:5173)"
	@$(MAKE) -C dashboard dev

dashboard-build: ##  Build production dashboard
	@$(MAKE) -C dashboard build

dashboard-test-data: ##  Generate realistic test scan data
	@$(MAKE) -C dashboard test-data

dashboard-clean: ##  Clean dashboard build artifacts
	@$(MAKE) -C dashboard clean

# LocalStack commands (delegated to dashboard/Makefile)
localstack-start: ##  Start LocalStack container
	@$(MAKE) -C dashboard localstack-start

localstack-stop: ##  Stop LocalStack container
	@$(MAKE) -C dashboard localstack-stop

localstack-setup: ##  Initialize S3 buckets with test data
	@$(MAKE) -C dashboard localstack-setup

localstack-dev: ##  Full dev workflow (start + setup + dev server)
	@$(MAKE) -C dashboard localstack-dev
