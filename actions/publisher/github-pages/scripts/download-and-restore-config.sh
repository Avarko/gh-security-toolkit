#!/usr/bin/env bash
#
# Downloads and restores multi-tenant configuration artifact.
# Combines download + restore into a single operation.
#
# Usage: download-and-restore-config.sh <repository> <pages_root> <github_output_path>
#
# Arguments:
#   repository         - GitHub repository in format "owner/repo"
#   pages_root         - Root directory for GitHub Pages (e.g., "docs")
#   github_output_path - Path to GITHUB_OUTPUT file for setting outputs
#
# Outputs (written to GITHUB_OUTPUT):
#   found - "true" if artifact was found and restored, "false" otherwise
#
# Environment:
#   GH_TOKEN - GitHub token for artifact operations

set -euo pipefail

if [ $# -lt 3 ]; then
    echo "Usage: $0 <repository> <pages_root> <github_output_path>"
    exit 1
fi

REPOSITORY="$1"
PAGES_ROOT="$2"
GITHUB_OUTPUT="$3"

ARTIFACT_NAME="__gh_security_toolkit__multi-tenant-config"
OUTPUT_DIR="/tmp/multi-tenant-config-artifact"

echo "==> Searching for artifact: $ARTIFACT_NAME"

# Find the most recent artifact with this name (sorted by created_at DESC)
ARTIFACT_URL=$(gh api \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "/repos/$REPOSITORY/actions/artifacts?name=$ARTIFACT_NAME&per_page=100" \
    --jq '.artifacts | sort_by(.created_at) | reverse | .[0].archive_download_url // empty')

if [ -z "$ARTIFACT_URL" ]; then
    echo "==> No artifact found with name: $ARTIFACT_NAME"
    echo "   ℹ️  This is expected on first run"
    echo "found=false" >> "$GITHUB_OUTPUT"
    echo "ℹ️  No existing tenant registry found - will create new on first run"
    mkdir -p "$PAGES_ROOT/config"
    exit 0
fi

echo "==> Downloading artifact from: $ARTIFACT_URL"
mkdir -p "$OUTPUT_DIR"

# Download and extract artifact
gh api "$ARTIFACT_URL" > "$OUTPUT_DIR/artifact.zip"
cd "$OUTPUT_DIR"
unzip -q artifact.zip
rm artifact.zip

echo "==> Artifact downloaded successfully"
echo "found=true" >> "$GITHUB_OUTPUT"

# Restore tenant registry
CONFIG_ARCHIVE="$OUTPUT_DIR/multi-tenant-config.tar.gz"

if [ -f "$CONFIG_ARCHIVE" ]; then
    echo "📦 Restoring tenant registry from artifact..."
    mkdir -p "$PAGES_ROOT"
    tar -xzf "$CONFIG_ARCHIVE" -C "$PAGES_ROOT" 2>/dev/null || echo "⚠️  Archive extraction had warnings"

    # Verify restoration
    if [ -f "$PAGES_ROOT/config/tenant-registry.json" ]; then
        TENANT_COUNT=$(jq '.tenants | length' "$PAGES_ROOT/config/tenant-registry.json")
        echo "   ✅ Restored tenant registry with $TENANT_COUNT tenant(s)"
        echo "   🔑 GUID persistence enabled"
    fi
else
    echo "⚠️  Archive file not found in artifact, creating fresh config directory"
    mkdir -p "$PAGES_ROOT/config"
fi
