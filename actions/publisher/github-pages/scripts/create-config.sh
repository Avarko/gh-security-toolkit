#!/usr/bin/env bash
#
# Creates configuration JSON for GitHub Pages builder.
# Auto-detects all metadata from GitHub Actions environment.
#
# Usage: create-config.sh <outdir> <channel> <output_json> [config_overrides_json]
#
# Required arguments:
#   outdir              - Directory containing scan outputs
#   channel             - Channel name
#   output_json         - Path to write config JSON
#
# Optional arguments:
#   config_overrides_json - Path to JSON with configuration overrides (reserved for future use)
#
# Environment variables (auto-detected from GitHub Actions):
#   GITHUB_REPOSITORY, GITHUB_SHA, GITHUB_REF_NAME, GITHUB_RUN_ID,
#   GITHUB_WORKFLOW, GITHUB_SERVER_URL, GITHUB_ACTOR

set -euo pipefail

if [ $# -lt 3 ]; then
    echo "Usage: $0 <outdir> <channel> <output_json> [config_overrides_json]"
    exit 1
fi

OUTDIR="$(cd "$1" 2>/dev/null && pwd || realpath "$1")"
CHANNEL="$2"
OUTPUT_JSON="$3"
CONFIG_OVERRIDES="${4:-}"

# Auto-generate timestamp
TIMESTAMP=$(date -u +'%Y-%m-%d-%H%M%SZ')

# Hardcoded: always use repository root
PAGES_ROOT="$(pwd)"

# Construct CI job URL from environment
CI_JOB_URL="${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}"

echo "📋 Creating builder configuration..."
echo "   📂 Output dir: $OUTDIR"
echo "   🏷️  Channel: $CHANNEL"
echo "   ⏰ Timestamp: $TIMESTAMP (auto-generated)"
echo "   📦 Pages root: $PAGES_ROOT (repository root)"

# Build base configuration using environment variables
CONFIG=$(jq -n \
  --arg outdir "$OUTDIR" \
  --arg pagesRoot "$PAGES_ROOT" \
  --arg channel "$CHANNEL" \
  --arg timestamp "$TIMESTAMP" \
  --arg repository "${GITHUB_REPOSITORY:-}" \
  --arg commitSha "${GITHUB_SHA:-}" \
  --arg branch "${GITHUB_REF_NAME:-}" \
  --arg scanId "${GITHUB_RUN_ID:-}" \
  --arg ciJobName "${GITHUB_WORKFLOW:-}" \
  --arg ciJobUrl "$CI_JOB_URL" \
  --arg actorName "${GITHUB_ACTOR:-}" \
  '{
    input: {
      outdir: $outdir,
      pagesRoot: $pagesRoot,
      dashboardBuildDir: "/tmp/dashboard-build"
    },
    metadata: {
      timestamp: $timestamp,
      channel: $channel,
      branch: $branch,
      repository: $repository,
      commitSha: $commitSha,
      scanId: $scanId,
      ciJobName: $ciJobName,
      ciJobUrl: $ciJobUrl,
      actorName: $actorName
    }
  }')

# Merge with config overrides if provided (reserved for future use)
if [ -n "$CONFIG_OVERRIDES" ] && [ -f "$CONFIG_OVERRIDES" ]; then
    echo "   📝 Applying configuration overrides"
    CONFIG=$(echo "$CONFIG" | jq --slurpfile overrides "$CONFIG_OVERRIDES" '. * $overrides[0]')
fi

echo "$CONFIG" > "$OUTPUT_JSON"
echo "   ✅ Configuration written to: $OUTPUT_JSON"
