#!/usr/bin/env bash
#
# Validates that required GitHub context variables are present.
#
# Usage: validate-github-context.sh <repository_owner> <repository>
#
# Arguments:
#   repository_owner - GitHub repository owner (e.g., "myorg")
#   repository       - GitHub repository in format "owner/repo"
#
# Exit codes:
#   0 - All required variables are present
#   1 - One or more required variables are missing

set -euo pipefail

if [ $# -lt 2 ]; then
    echo "Usage: $0 <repository_owner> <repository>"
    exit 1
fi

REPOSITORY_OWNER="$1"
REPOSITORY="$2"

if [ -z "$REPOSITORY_OWNER" ]; then
    echo "❌ ERROR: repository_owner is empty"
    echo "   This should be automatically provided by GitHub Actions."
    exit 1
fi

if [ -z "$REPOSITORY" ]; then
    echo "❌ ERROR: repository is empty"
    echo "   This should be automatically provided by GitHub Actions."
    exit 1
fi

echo "✅ GitHub context is valid:"
echo "   Owner: $REPOSITORY_OWNER"
echo "   Repository: $REPOSITORY"
