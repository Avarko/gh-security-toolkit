#!/usr/bin/env bash
# Simulate a security scan for local dev
set -euo pipefail

# Example: copy static fixtures to run dir
RUN_ID="run-$(date +%s)"
TENANT="test-tenant-uuid-001"
RUN_DIR="../local-dev/data/$TENANT/runs/$RUN_ID"
mkdir -p "$RUN_DIR"
cp ../scripts/test-fixtures/trivy-fs-results.json "$RUN_DIR/trivy-fs-results.json"
cp ../scripts/test-fixtures/semgrep-results.json "$RUN_DIR/semgrep-results.json"

# Update scan-history.json (simulate builder)
java -jar ../scripts/github_pages_builder.java --data-root ../local-dev/data --channel manual --timestamp $(date +%Y%m%d-%H%M%S)

echo "Simulated security scan for $TENANT/$RUN_ID."