#!/usr/bin/env bash
#
# Reads client configuration from .gh-security-toolkit/config.yaml
# Merges with provided defaults (action inputs take priority over config file).
#
# Usage: read-client-config.sh <github_output_file>
#
# Arguments:
#   github_output_file - Path to $GITHUB_OUTPUT file
#
# Environment variables (inputs with defaults):
#   INPUT_ORG_DISPLAY_NAME  - Organization display name override
#   INPUT_ORG_LOGO_URL      - Organization logo URL override
#   INPUT_REPO_DISPLAY_NAME - Repository display name override
#   INPUT_TRIVY_SEVERITY    - Trivy severity levels (default: "MEDIUM,HIGH,CRITICAL")
#   INPUT_SEMGREP_CONFIGS   - Semgrep configurations (default: "p/owasp-top-ten,...")
#   INPUT_RETENTION_KEEP    - Number of releases to keep (default: "10")
#   INPUT_RETENTION_DAYS    - Days to keep releases (default: "30")
#
# Outputs (written to GITHUB_OUTPUT):
#   org_display_name, org_logo_url, repo_display_name,
#   trivy_severity, semgrep_configs, retention_keep, retention_days

set -euo pipefail

if [ $# -lt 1 ]; then
    echo "Usage: $0 <github_output_file>"
    exit 1
fi

GITHUB_OUTPUT="$1"
CONFIG_FILE=".gh-security-toolkit/config.yaml"

# Initialize outputs with action inputs (highest priority)
ORG_DISPLAY_NAME="${INPUT_ORG_DISPLAY_NAME:-}"
ORG_LOGO_URL="${INPUT_ORG_LOGO_URL:-}"
REPO_DISPLAY_NAME="${INPUT_REPO_DISPLAY_NAME:-}"
TRIVY_SEVERITY="${INPUT_TRIVY_SEVERITY:-MEDIUM,HIGH,CRITICAL}"
SEMGREP_CONFIGS="${INPUT_SEMGREP_CONFIGS:-p/owasp-top-ten,p/java,p/javascript,p/dockerfile,p/terraform,p/secrets}"
RETENTION_KEEP="${INPUT_RETENTION_KEEP:-10}"
RETENTION_DAYS="${INPUT_RETENTION_DAYS:-30}"

# Check for config file
if [ -f "$CONFIG_FILE" ]; then
  echo "📋 Found client config: $CONFIG_FILE"

  # Read values from config (only if action input is empty)
  if [ -z "$ORG_DISPLAY_NAME" ]; then
    ORG_DISPLAY_NAME=$(yq -r '.organization.display_name // ""' "$CONFIG_FILE" 2>/dev/null || echo "")
  fi
  if [ -z "$ORG_LOGO_URL" ]; then
    ORG_LOGO_URL=$(yq -r '.organization.logo_url // ""' "$CONFIG_FILE" 2>/dev/null || echo "")
  fi
  if [ -z "$REPO_DISPLAY_NAME" ]; then
    REPO_DISPLAY_NAME=$(yq -r '.repository.display_name // ""' "$CONFIG_FILE" 2>/dev/null || echo "")
  fi

  # Scanning defaults (action inputs take priority)
  if [ "$TRIVY_SEVERITY" = "MEDIUM,HIGH,CRITICAL" ]; then
    CONFIG_TRIVY_SEVERITY=$(yq -r '.scanning.trivy.severity // ""' "$CONFIG_FILE" 2>/dev/null || echo "")
    [ -n "$CONFIG_TRIVY_SEVERITY" ] && TRIVY_SEVERITY="$CONFIG_TRIVY_SEVERITY"
  fi
  if [ "$SEMGREP_CONFIGS" = "p/owasp-top-ten,p/java,p/javascript,p/dockerfile,p/terraform,p/secrets" ]; then
    CONFIG_SEMGREP=$(yq -r '.scanning.semgrep.configs | join(",") // ""' "$CONFIG_FILE" 2>/dev/null || echo "")
    [ -n "$CONFIG_SEMGREP" ] && SEMGREP_CONFIGS="$CONFIG_SEMGREP"
  fi

  # Publishing defaults
  if [ "$RETENTION_KEEP" = "10" ]; then
    CONFIG_RETENTION_KEEP=$(yq -r '.publishing.retention_keep // ""' "$CONFIG_FILE" 2>/dev/null || echo "")
    [ -n "$CONFIG_RETENTION_KEEP" ] && RETENTION_KEEP="$CONFIG_RETENTION_KEEP"
  fi
  if [ "$RETENTION_DAYS" = "30" ]; then
    CONFIG_RETENTION_DAYS=$(yq -r '.publishing.retention_days // ""' "$CONFIG_FILE" 2>/dev/null || echo "")
    [ -n "$CONFIG_RETENTION_DAYS" ] && RETENTION_DAYS="$CONFIG_RETENTION_DAYS"
  fi

  echo "   ✅ Config loaded"
else
  echo "ℹ️  No client config file found at $CONFIG_FILE (using defaults)"
fi

# Output resolved values
echo "org_display_name=$ORG_DISPLAY_NAME" >> "$GITHUB_OUTPUT"
echo "org_logo_url=$ORG_LOGO_URL" >> "$GITHUB_OUTPUT"
echo "repo_display_name=$REPO_DISPLAY_NAME" >> "$GITHUB_OUTPUT"
echo "trivy_severity=$TRIVY_SEVERITY" >> "$GITHUB_OUTPUT"
echo "semgrep_configs=$SEMGREP_CONFIGS" >> "$GITHUB_OUTPUT"
echo "retention_keep=$RETENTION_KEEP" >> "$GITHUB_OUTPUT"
echo "retention_days=$RETENTION_DAYS" >> "$GITHUB_OUTPUT"

echo ""
echo "📊 Resolved configuration:"
echo "   Organization: ${ORG_DISPLAY_NAME:-<not set>}"
echo "   Logo URL: ${ORG_LOGO_URL:-<not set>}"
echo "   Repository: ${REPO_DISPLAY_NAME:-<not set>}"
echo "   Trivy severity: $TRIVY_SEVERITY"
echo "   Semgrep configs: $SEMGREP_CONFIGS"
echo "   Retention keep: $RETENTION_KEEP"
echo "   Retention days: $RETENTION_DAYS"
