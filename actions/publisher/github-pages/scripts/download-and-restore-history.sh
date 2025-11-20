#!/usr/bin/env bash
#
# Downloads and restores GitHub Pages site data artifact (all channels, all tenants).
# Combines download + restore into a single operation.
#
# Usage: download-and-restore-history.sh <repository> <pages_root> <github_output_path>
#
# Arguments:
#   repository         - GitHub repository in format "owner/repo"
#   pages_root         - Root directory for GitHub Pages (usually: .)
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
PAGES_ROOT="$(cd "$2" 2>/dev/null && pwd || realpath "$2")"
GITHUB_OUTPUT="$3"

ARTIFACT_NAME="__gh_security_toolkit__github_pages_site_data"
OUTPUT_DIR="/tmp/github-pages-site-data-artifact"

echo "==> Searching for artifact: $ARTIFACT_NAME"

# Find the most recent artifact with this name (sorted by created_at DESC)
ARTIFACT_URL=$(gh api \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "/repos/$REPOSITORY/actions/artifacts?name=$ARTIFACT_NAME&per_page=100" \
    --jq '.artifacts | sort_by(.created_at) | reverse | .[0].archive_download_url // empty')

if [ -z "$ARTIFACT_URL" ]; then
    echo "==> No artifact found with name: $ARTIFACT_NAME"
    echo "found=false" >> "$GITHUB_OUTPUT"
    echo "ℹ️  No existing scan data found - starting fresh"
    mkdir -p "$PAGES_ROOT/data"
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

# Restore GitHub Pages site data
SITE_DATA_ARCHIVE="$OUTPUT_DIR/scan-history.tar.gz"

if [ -f "$SITE_DATA_ARCHIVE" ]; then
    echo "📦 Restoring GitHub Pages site data from artifact..."
    mkdir -p "$PAGES_ROOT"
    tar -xzf "$SITE_DATA_ARCHIVE" -C "$PAGES_ROOT" 2>/dev/null || echo "⚠️  Archive extraction had warnings (may be legacy format)"

    # Count existing scans across all channels and tenants
    if [ -d "$PAGES_ROOT/data" ]; then
        TOTAL_SCANS=$(find "$PAGES_ROOT/data" -path "*/runs/*/*" -type d 2>/dev/null | wc -l)
        TENANTS=$(find "$PAGES_ROOT/data" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l)
        echo "   ✅ Restored $TOTAL_SCANS runs across $TENANTS tenant(s) (all channels)"
    fi
else
    echo "⚠️  Archive file not found in artifact, creating fresh data directory"
    mkdir -p "$PAGES_ROOT/data"
fi
