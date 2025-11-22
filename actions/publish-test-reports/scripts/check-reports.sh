#!/usr/bin/env bash
#
# Checks which test reports exist and validates that at least one is present.
#
# Usage: check-reports.sh
#
# Environment variables:
#   INPUT_JACOCO_REPORT_PATH   - Path to JaCoCo HTML report directory
#   INPUT_SUREFIRE_REPORT_PATH - Path to Surefire HTML report directory
#   GITHUB_OUTPUT              - GitHub Actions output file (set automatically)
#
# Outputs (written to GITHUB_OUTPUT):
#   has_jacoco  - "true" if JaCoCo report exists
#   has_surefire - "true" if Surefire report exists

set -euo pipefail

JACOCO_PATH="${INPUT_JACOCO_REPORT_PATH:-}"
SUREFIRE_PATH="${INPUT_SUREFIRE_REPORT_PATH:-}"

HAS_JACOCO="false"
HAS_SUREFIRE="false"

echo "📋 Checking test report paths..."

if [ -n "$JACOCO_PATH" ] && [ -d "$JACOCO_PATH" ]; then
  echo "   ✅ JaCoCo report found at: $JACOCO_PATH"
  HAS_JACOCO="true"
elif [ -n "$JACOCO_PATH" ]; then
  echo "   ⚠️  JaCoCo path provided but not found: $JACOCO_PATH"
fi

if [ -n "$SUREFIRE_PATH" ] && [ -d "$SUREFIRE_PATH" ]; then
  echo "   ✅ Surefire report found at: $SUREFIRE_PATH"
  HAS_SUREFIRE="true"
elif [ -n "$SUREFIRE_PATH" ]; then
  echo "   ⚠️  Surefire path provided but not found: $SUREFIRE_PATH"
fi

if [ "$HAS_JACOCO" = "false" ] && [ "$HAS_SUREFIRE" = "false" ]; then
  echo ""
  echo "❌ ERROR: No test reports found!"
  echo "   JaCoCo path: ${JACOCO_PATH:-<not provided>}"
  echo "   Surefire path: ${SUREFIRE_PATH:-<not provided>}"
  exit 1
fi

echo ""
echo "📊 Report summary:"
echo "   JaCoCo: $HAS_JACOCO"
echo "   Surefire: $HAS_SUREFIRE"

echo "has_jacoco=$HAS_JACOCO" >> "$GITHUB_OUTPUT"
echo "has_surefire=$HAS_SUREFIRE" >> "$GITHUB_OUTPUT"
