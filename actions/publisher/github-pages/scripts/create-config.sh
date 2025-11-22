#!/usr/bin/env bash
#
# Creates configuration JSON for GitHub Pages builder.
# Reads metadata from scan-context.json in outdir (created by artifact upload actions).
#
# Usage: create-config.sh <outdir> <output_json> [config_overrides_json] [dashboard_build_dir]
#
# Required arguments:
#   outdir              - Directory containing scan outputs and scan-context.json
#   output_json         - Path to write config JSON
#
# Optional arguments:
#   config_overrides_json - Path to JSON with configuration overrides (reserved for future use)
#   dashboard_build_dir   - Path to dashboard build directory (default: uses RUNNER_TEMP)
#
# The scan-context.json file must contain at minimum:
#   - channel: Channel name for organizing scans
#   - timestamp: Scan timestamp
#
# It may also contain (optional):
#   - branch, repository, commitSha, scanId, ciJobName, ciJobUrl, actorName

set -euo pipefail

if [ $# -lt 2 ]; then
    echo "Usage: $0 <outdir> <output_json> [config_overrides_json] [dashboard_build_dir]"
    exit 1
fi

OUTDIR="$(cd "$1" 2>/dev/null && pwd || realpath "$1")"
OUTPUT_JSON="$2"
CONFIG_OVERRIDES="${3:-}"
DASHBOARD_BUILD_DIR="${4:-${RUNNER_TEMP:-/tmp}/dashboard-build}"

# Hardcoded: always use repository root
PAGES_ROOT="$(pwd)"

# Require scan-context.json in outdir
SCAN_CONTEXT="$OUTDIR/scan-context.json"
if [ ! -f "$SCAN_CONTEXT" ]; then
    echo "❌ ERROR: scan-context.json not found in $OUTDIR"
    echo ""
    echo "   The artifact must include scan-context.json with channel metadata."
    echo "   Use the following actions to create artifacts with proper metadata:"
    echo "   - actions/artifacts/filesystem-for-scanning/upload"
    echo "   - actions/artifacts/docker-image-for-scanning/upload"
    echo "   - actions/artifacts/test-reports/upload"
    exit 1
fi

echo "📋 Reading metadata from scan-context.json"
cat "$SCAN_CONTEXT"

# Extract required field: channel
CHANNEL=$(jq -r '.channel // empty' "$SCAN_CONTEXT")
if [ -z "$CHANNEL" ]; then
    echo "❌ ERROR: 'channel' field missing or empty in scan-context.json"
    exit 1
fi

# Extract other metadata fields (with defaults)
TIMESTAMP=$(jq -r '.timestamp // empty' "$SCAN_CONTEXT")
TIMESTAMP="${TIMESTAMP:-$(date -u +'%Y-%m-%d-%H%M%SZ')}"
BRANCH=$(jq -r '.branch // empty' "$SCAN_CONTEXT")
BRANCH="${BRANCH:-${GITHUB_REF_NAME:-}}"
REPOSITORY=$(jq -r '.repository // empty' "$SCAN_CONTEXT")
REPOSITORY="${REPOSITORY:-${GITHUB_REPOSITORY:-}}"
COMMIT_SHA=$(jq -r '.commitSha // empty' "$SCAN_CONTEXT")
COMMIT_SHA="${COMMIT_SHA:-${GITHUB_SHA:-}}"
SCAN_ID=$(jq -r '.scanId // empty' "$SCAN_CONTEXT")
SCAN_ID="${SCAN_ID:-${GITHUB_RUN_ID:-}}"
CI_JOB_NAME=$(jq -r '.ciJobName // empty' "$SCAN_CONTEXT")
CI_JOB_NAME="${CI_JOB_NAME:-${GITHUB_WORKFLOW:-}}"
CI_JOB_URL=$(jq -r '.ciJobUrl // empty' "$SCAN_CONTEXT")
CI_JOB_URL="${CI_JOB_URL:-${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}}"
ACTOR_NAME=$(jq -r '.actorName // empty' "$SCAN_CONTEXT")
ACTOR_NAME="${ACTOR_NAME:-${GITHUB_ACTOR:-}}"

# Organization/tenant display metadata (from client config)
ORG_DISPLAY_NAME=$(jq -r '.orgDisplayName // empty' "$SCAN_CONTEXT")
ORG_LOGO_URL=$(jq -r '.orgLogoUrl // empty' "$SCAN_CONTEXT")
REPO_DISPLAY_NAME=$(jq -r '.repoDisplayName // empty' "$SCAN_CONTEXT")

echo ""
echo "📋 Creating builder configuration..."
echo "   📂 Output dir: $OUTDIR"
echo "   🏷️  Channel: $CHANNEL"
echo "   ⏰ Timestamp: $TIMESTAMP"
echo "   📦 Pages root: $PAGES_ROOT (repository root)"

# Build configuration
CONFIG=$(jq -n \
  --arg outdir "$OUTDIR" \
  --arg pagesRoot "$PAGES_ROOT" \
  --arg dashboardBuildDir "$DASHBOARD_BUILD_DIR" \
  --arg channel "$CHANNEL" \
  --arg timestamp "$TIMESTAMP" \
  --arg repository "$REPOSITORY" \
  --arg commitSha "$COMMIT_SHA" \
  --arg branch "$BRANCH" \
  --arg scanId "$SCAN_ID" \
  --arg ciJobName "$CI_JOB_NAME" \
  --arg ciJobUrl "$CI_JOB_URL" \
  --arg actorName "$ACTOR_NAME" \
  --arg orgDisplayName "$ORG_DISPLAY_NAME" \
  --arg orgLogoUrl "$ORG_LOGO_URL" \
  --arg repoDisplayName "$REPO_DISPLAY_NAME" \
  '{
    input: {
      outdir: $outdir,
      pagesRoot: $pagesRoot,
      dashboardBuildDir: $dashboardBuildDir
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
      actorName: $actorName,
      orgDisplayName: $orgDisplayName,
      orgLogoUrl: $orgLogoUrl,
      repoDisplayName: $repoDisplayName
    }
  }')

# Merge with config overrides if provided (reserved for future use)
if [ -n "$CONFIG_OVERRIDES" ] && [ -f "$CONFIG_OVERRIDES" ]; then
    echo "   📝 Applying configuration overrides"
    CONFIG=$(echo "$CONFIG" | jq --slurpfile overrides "$CONFIG_OVERRIDES" '. * $overrides[0]')
fi

echo "$CONFIG" > "$OUTPUT_JSON"
echo "   ✅ Configuration written to: $OUTPUT_JSON"
