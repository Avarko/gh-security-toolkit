#!/usr/bin/env bash
#
# Archives multi-tenant configuration (tenant registry) to a tar.gz file.
#
# Usage: archive-multi-tenant-config.sh <pages_root> <output_dir>
#
# Arguments:
#   pages_root - Root directory for GitHub Pages (usually: .)
#   output_dir - Directory where archive will be created
#
# Output:
#   Creates <output_dir>/multi-tenant-config.tar.gz

set -euo pipefail

if [ $# -lt 2 ]; then
    echo "Usage: $0 <pages_root> <output_dir>"
    exit 1
fi

PAGES_ROOT="$(cd "$1" 2>/dev/null && pwd || realpath "$1")"
ARCHIVE_DIR="$2"

echo "📦 Archiving multi-tenant configuration..."

mkdir -p "$ARCHIVE_DIR"

# Archive tenant registry (CRITICAL for GUID persistence!)
if [ -f "$PAGES_ROOT/config/tenant-registry.json" ]; then
    tar -czf "$ARCHIVE_DIR/multi-tenant-config.tar.gz" -C "$PAGES_ROOT" config/tenant-registry.json
    SIZE=$(du -h "$ARCHIVE_DIR/multi-tenant-config.tar.gz" | cut -f1)
    TENANT_COUNT=$(jq '.tenants | length' "$PAGES_ROOT/config/tenant-registry.json")
    echo "   ✅ Archived tenant registry with $TENANT_COUNT tenant(s) ($SIZE)"
else
    echo "   ℹ️  No tenant registry found (first run) - creating empty archive"
    tar -czf "$ARCHIVE_DIR/multi-tenant-config.tar.gz" -T /dev/null
fi
