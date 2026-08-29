.EXPORT_ALL_VARIABLES:

.DEFAULT_GOAL := help

# Avarko/gh-security-toolkit security scanner Makefile inclusion.
#
# Pin GHST_REF to a release tag. The fetched file is make code that runs on
# this machine, so what it is pinned to is a trust decision: `main` means
# whatever landed there most recently, with no review boundary between a commit
# and every developer executing it.
#
# .gh-security-toolkit/REF records which ref the cached copy came from, and the
# copy is re-fetched whenever GHST_REF no longer matches it. It used to be
# fetched once and kept forever regardless, so a security fix here never
# reached an existing checkout and developers ran copies that predated the
# targets they were calling.
#
# This is still trust-on-first-use over HTTPS: pinning to a tag decides what is
# fetched, not who served it. Verifying a signature over this file would need a
# trust anchor the consumer already has, and the only one available before the
# toolkit is bootstrapped is the checkout itself.
GHST_REF ?= main

include $(shell \
	set -e; \
	__GHST_DIR=.gh-security-toolkit; \
	__GHST_FILE=$$__GHST_DIR/Makefile; \
	__GHST_STAMP=$$__GHST_DIR/REF; \
	mkdir -p $$__GHST_DIR; \
	if [ ! -f $$__GHST_FILE ] || [ "$$(cat $$__GHST_STAMP 2>/dev/null)" != "$(GHST_REF)" ]; then \
		curl -fsSL "https://raw.githubusercontent.com/Avarko/gh-security-toolkit/$(GHST_REF)/Makefile.scanners" \
			-o $$__GHST_FILE.tmp \
		&& mv $$__GHST_FILE.tmp $$__GHST_FILE \
		&& printf '%s\n' "$(GHST_REF)" > $$__GHST_STAMP; \
	fi; \
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
