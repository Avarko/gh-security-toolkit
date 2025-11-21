#!/usr/bin/env bash
#
# Copies test reports to the output directory with proper structure.
#
# Usage: copy-reports.sh
#
# Environment variables:
#   INPUT_OUTPUT_DIR           - Target directory for reports
#   INPUT_JACOCO_REPORT_PATH   - Path to JaCoCo HTML report directory
#   INPUT_SUREFIRE_REPORT_PATH - Path to Surefire HTML report directory
#   INPUT_HAS_JACOCO           - "true" if JaCoCo report should be copied
#   INPUT_HAS_SUREFIRE         - "true" if Surefire report should be copied

set -euo pipefail

OUTPUT_DIR="${INPUT_OUTPUT_DIR:?INPUT_OUTPUT_DIR is required}"
JACOCO_PATH="${INPUT_JACOCO_REPORT_PATH:-}"
SUREFIRE_PATH="${INPUT_SUREFIRE_REPORT_PATH:-}"
HAS_JACOCO="${INPUT_HAS_JACOCO:-false}"
HAS_SUREFIRE="${INPUT_HAS_SUREFIRE:-false}"

echo "📁 Creating site structure..."
mkdir -p "$OUTPUT_DIR/coverage"
mkdir -p "$OUTPUT_DIR/tests"

if [ "$HAS_JACOCO" = "true" ] && [ -n "$JACOCO_PATH" ]; then
  echo "📊 Copying JaCoCo coverage report..."
  cp -r "$JACOCO_PATH"/* "$OUTPUT_DIR/coverage/"
  echo "   ✅ JaCoCo report copied to $OUTPUT_DIR/coverage/"
fi

if [ "$HAS_SUREFIRE" = "true" ] && [ -n "$SUREFIRE_PATH" ]; then
  echo "✅ Copying Surefire test report..."
  cp -r "$SUREFIRE_PATH"/* "$OUTPUT_DIR/tests/"

  # Rename surefire.html to index.html if it exists
  if [ -f "$OUTPUT_DIR/tests/surefire.html" ]; then
    mv "$OUTPUT_DIR/tests/surefire.html" "$OUTPUT_DIR/tests/index.html"
    echo "   ✅ Surefire report copied and renamed to index.html"
  else
    echo "   ✅ Surefire report copied to $OUTPUT_DIR/tests/"
  fi
fi

echo ""
echo "📦 Output directory structure:"
ls -la "$OUTPUT_DIR/"
