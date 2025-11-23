#!/usr/bin/env bash
# Simulate test report publishing for local dev
set -euo pipefail

RUN_ID="run-$(date +%s)"
TENANT="test-tenant-uuid-001"
RUN_DIR="../local-dev/data/$TENANT/runs/$RUN_ID"
mkdir -p "$RUN_DIR/jacoco"
mkdir -p "$RUN_DIR/surefire"
cp ../scripts/test-fixtures/jacoco.html "$RUN_DIR/jacoco/index.html"
cp ../scripts/test-fixtures/surefire.html "$RUN_DIR/surefire/index.html"

echo "Simulated test reports for $TENANT/$RUN_ID."