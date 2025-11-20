#!/usr/bin/env bash
#
# Archives scan history data directory to a tar.gz file.
#
# Usage: archive-scan-history.sh <pages_root> <output_dir>
#
# Arguments:
#   pages_root - Root directory for GitHub Pages (e.g., "docs")
#   output_dir - Directory where archive will be created
#
# Output:
#   Creates <output_dir>/scan-history.tar.gz

set -euo pipefail

if [ $# -lt 2 ]; then
    echo "Usage: $0 <pages_root> <output_dir>"
    exit 1
fi

PAGES_ROOT="$1"
ARCHIVE_DIR="$2"

echo "📦 Archiving scan data..."

mkdir -p "$ARCHIVE_DIR"

# Archive entire /data directory (contains all tenant UUIDs)
if [ -d "$PAGES_ROOT/data" ]; then
    tar -czf "$ARCHIVE_DIR/scan-history.tar.gz" -C "$PAGES_ROOT" data
    SIZE=$(du -h "$ARCHIVE_DIR/scan-history.tar.gz" | cut -f1)
    RUN_COUNT=$(find "$PAGES_ROOT/data" -path "*/runs/*/*" -type d 2>/dev/null | wc -l)
    TENANTS=$(find "$PAGES_ROOT/data" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l)
    echo "   ✅ Archived $RUN_COUNT runs across $TENANTS tenant(s) ($SIZE)"
else
    echo "   ⚠️  No data directory found"
    tar -czf "$ARCHIVE_DIR/scan-history.tar.gz" -T /dev/null
fi
