#!/usr/bin/env bash
#
# Checks that GitHub Pages is configured as Private (not Public)
# to prevent accidental exposure of security scan results.
#
# Usage: check-pages-visibility.sh <repository>
#
# Arguments:
#   repository - GitHub repository in format "owner/repo"
#
# Environment:
#   GH_TOKEN - GitHub token for API access
#
# Exit codes:
#   0 - Pages is private or unknown (safe to proceed)
#   1 - Pages is public (deployment blocked)

set -euo pipefail

if [ $# -lt 1 ]; then
    echo "Usage: $0 <repository>"
    exit 1
fi

REPOSITORY="$1"

echo "🔍 Checking GitHub Pages visibility..."

# Query GitHub Pages configuration (single API call)
echo "📡 DEBUG: Querying GitHub API for Pages configuration..."
FULL_RESPONSE=$(gh api \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "/repos/$REPOSITORY/pages" 2>&1) || FULL_RESPONSE=""

echo "📦 DEBUG: Full API response:"
echo "$FULL_RESPONSE"
echo ""

# Extract .public field from response (handle null vs false properly)
if [ -n "$FULL_RESPONSE" ]; then
    IS_PUBLIC=$(echo "$FULL_RESPONSE" | jq -r 'if .public == null then "unknown" else (.public | tostring) end' 2>/dev/null) || IS_PUBLIC="unknown"
else
    IS_PUBLIC="unknown"
fi

echo "🔎 DEBUG: Extracted .public value: '$IS_PUBLIC'"
echo ""

if [ "$IS_PUBLIC" = "true" ]; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "❌ ERROR: GitHub Pages is configured as PUBLIC"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Security scan results MUST NOT be published to a public Pages site."
    echo ""
    echo "To fix this:"
    echo "  1. Go to: Settings → Pages"
    echo "  2. Under 'Visibility', select 'Private'"
    echo "  3. Click 'Save'"
    echo ""
    echo "Note: Private Pages requires GitHub Enterprise Cloud."
    echo "      If not available, use 'publish_to: github-release' instead."
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    exit 1
elif [ "$IS_PUBLIC" = "false" ]; then
    echo "✅ GitHub Pages is configured as Private - proceeding with deployment"
elif [ "$IS_PUBLIC" = "null" ] || [ "$IS_PUBLIC" = "unknown" ]; then
    echo "⚠️  Warning: Could not query GitHub Pages configuration."
    echo "   Pages may not be enabled yet, or visibility setting is not available."
    echo "   Proceeding with deployment."
    echo ""
    echo "   ⚠️  IMPORTANT: After first deployment, verify in Settings → Pages that:"
    echo "      • Pages is enabled and deployed from 'gh-pages' branch"
    echo "      • Visibility is set to 'Private' (requires GitHub Enterprise Cloud)"
    echo "      • If Private Pages is not available, use 'publish_to: github-release' instead"
else
    echo "⚠️  Warning: Unexpected visibility value: $IS_PUBLIC"
    echo "   Proceeding with deployment, but please verify Pages configuration."
fi
