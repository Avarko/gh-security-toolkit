#!/usr/bin/env bash
#
# Creates scan-context.json metadata file for security scan or test report results.
#
# Usage: create-scan-context.sh
#
# Environment variables (required):
#   INPUT_OUTPUT_FILE       - Path where scan-context.json will be written
#   INPUT_CHANNEL           - Channel name for the scan
#
# Environment variables (optional):
#   INPUT_TYPE              - Type: "security-scan" (default) or "test-report"
#   INPUT_ORG_DISPLAY_NAME  - Organization display name
#   INPUT_ORG_LOGO_URL      - Organization logo URL
#   INPUT_REPO_DISPLAY_NAME - Repository display name
#
# Environment variables (from GitHub Actions context):
#   GITHUB_REF_NAME, GITHUB_REPOSITORY, GITHUB_SHA, GITHUB_RUN_ID,
#   GITHUB_WORKFLOW, GITHUB_SERVER_URL, GITHUB_ACTOR

set -euo pipefail

OUTPUT_FILE="${INPUT_OUTPUT_FILE:?INPUT_OUTPUT_FILE is required}"
TYPE="${INPUT_TYPE:-security-scan}"

jq -n \
  --arg type "$TYPE" \
  --arg channel "${INPUT_CHANNEL:-}" \
  --arg timestamp "$(date -u +'%Y-%m-%d-%H%M%SZ')" \
  --arg branch "${GITHUB_REF_NAME:-}" \
  --arg repository "${GITHUB_REPOSITORY:-}" \
  --arg commitSha "${GITHUB_SHA:-}" \
  --arg scanId "${GITHUB_RUN_ID:-}" \
  --arg ciJobName "${GITHUB_WORKFLOW:-}" \
  --arg ciJobUrl "${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}" \
  --arg actorName "${GITHUB_ACTOR:-}" \
  --arg orgDisplayName "${INPUT_ORG_DISPLAY_NAME:-}" \
  --arg orgLogoUrl "${INPUT_ORG_LOGO_URL:-}" \
  --arg repoDisplayName "${INPUT_REPO_DISPLAY_NAME:-}" \
  '{
    type: $type,
    channel: $channel,
    timestamp: $timestamp,
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
  }' > "$OUTPUT_FILE"

echo "Created scan-context.json:"
cat "$OUTPUT_FILE"
