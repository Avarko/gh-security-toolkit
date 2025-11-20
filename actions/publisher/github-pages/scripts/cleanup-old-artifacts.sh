#!/usr/bin/env bash
#
# Cleans up old GitHub Actions artifacts, keeping only the most recent one.
# This script is reusable for any artifact type.
#
# Usage: cleanup-old-artifacts.sh <repository> <artifact_name> <current_artifact_id>
#
# Arguments:
#   repository          - GitHub repository in format "owner/repo"
#   artifact_name       - Name of the artifact to clean up
#   current_artifact_id - ID of the current artifact to keep (will not be deleted)
#
# Environment:
#   GH_TOKEN - GitHub token for artifact operations

set -euo pipefail

if [ $# -lt 3 ]; then
    echo "Usage: $0 <repository> <artifact_name> <current_artifact_id>"
    exit 1
fi

REPOSITORY="$1"
ARTIFACT_NAME="$2"
CURRENT_ARTIFACT_ID="$3"

echo "🧹 Cleaning up old artifacts: $ARTIFACT_NAME"
echo "   Current artifact ID: $CURRENT_ARTIFACT_ID"

# List all artifacts with this name
ARTIFACTS=$(gh api \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "/repos/$REPOSITORY/actions/artifacts?name=$ARTIFACT_NAME&per_page=100" \
    --jq '.artifacts[] | select(.id != '"$CURRENT_ARTIFACT_ID"') | .id')

if [ -z "$ARTIFACTS" ]; then
    echo "   ✅ No old artifacts to clean up"
    exit 0
fi

# Delete old artifacts
DELETED=0
for ARTIFACT_ID in $ARTIFACTS; do
    echo "   🗑️  Deleting artifact ID: $ARTIFACT_ID"
    gh api \
        --method DELETE \
        -H "Accept: application/vnd.github+json" \
        -H "X-GitHub-Api-Version: 2022-11-28" \
        "/repos/$REPOSITORY/actions/artifacts/$ARTIFACT_ID" || echo "   ⚠️  Failed to delete artifact $ARTIFACT_ID (may already be deleted)"
    DELETED=$((DELETED + 1))
done

echo "   ✅ Deleted $DELETED old artifact(s)"
