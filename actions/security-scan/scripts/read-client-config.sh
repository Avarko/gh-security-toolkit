#!/usr/bin/env bash
#
# Reads client configuration from .gh-security-toolkit/config.yaml
# and applies overrides from config_overrides input.
#
# Priority (highest to lowest):
#   1. config_overrides input (YAML string)
#   2. .gh-security-toolkit/config.yaml file
#   3. Built-in defaults
#
# Usage: read-client-config.sh
#
# Environment variables:
#   INPUT_CONFIG_OVERRIDES  - Optional YAML string with config overrides
#   GITHUB_OUTPUT           - GitHub Actions output file (set automatically)
#
# Outputs (written to GITHUB_OUTPUT):
#   org_display_name, org_logo_url, repo_display_name,
#   trivy_severity, semgrep_configs, retention_keep, retention_days

set -euo pipefail

CONFIG_FILE=".gh-security-toolkit/config.yaml"

# Initialize with defaults
ORG_DISPLAY_NAME=""
ORG_LOGO_URL=""
REPO_DISPLAY_NAME=""
TRIVY_CONFIG=""
TRIVY_SEVERITY="MEDIUM,HIGH,CRITICAL"
SEMGREP_CONFIGS="p/owasp-top-ten,p/java,p/javascript,p/dockerfile,p/terraform,p/secrets"
RETENTION_KEEP="10"
RETENTION_DAYS="30"

# Layer 1: Read from config file (if exists)
if [ -f "$CONFIG_FILE" ]; then
  echo "📋 Found client config: $CONFIG_FILE"

  # Read values from config file
  FILE_ORG=$(yq -r '.organization.display_name // ""' "$CONFIG_FILE" 2>/dev/null || echo "")
  [ -n "$FILE_ORG" ] && ORG_DISPLAY_NAME="$FILE_ORG"

  FILE_LOGO=$(yq -r '.organization.logo_url // ""' "$CONFIG_FILE" 2>/dev/null || echo "")
  [ -n "$FILE_LOGO" ] && ORG_LOGO_URL="$FILE_LOGO"

  FILE_REPO=$(yq -r '.repository.display_name // ""' "$CONFIG_FILE" 2>/dev/null || echo "")
  [ -n "$FILE_REPO" ] && REPO_DISPLAY_NAME="$FILE_REPO"

  FILE_SEVERITY=$(yq -r '.scanning.trivy.severity // ""' "$CONFIG_FILE" 2>/dev/null || echo "")
  [ -n "$FILE_SEVERITY" ] && TRIVY_SEVERITY="$FILE_SEVERITY"

  FILE_TRIVY_CONFIG=$(yq -r '.scanning.trivy.config // ""' "$CONFIG_FILE" 2>/dev/null || echo "")
  [ -n "$FILE_TRIVY_CONFIG" ] && TRIVY_CONFIG="$FILE_TRIVY_CONFIG"

  FILE_SEMGREP=$(yq -r '.scanning.semgrep.configs | join(",") // ""' "$CONFIG_FILE" 2>/dev/null || echo "")
  [ -n "$FILE_SEMGREP" ] && SEMGREP_CONFIGS="$FILE_SEMGREP"

  FILE_KEEP=$(yq -r '.publishing.retention_keep // ""' "$CONFIG_FILE" 2>/dev/null || echo "")
  [ -n "$FILE_KEEP" ] && RETENTION_KEEP="$FILE_KEEP"

  FILE_DAYS=$(yq -r '.publishing.retention_days // ""' "$CONFIG_FILE" 2>/dev/null || echo "")
  [ -n "$FILE_DAYS" ] && RETENTION_DAYS="$FILE_DAYS"

  echo "   ✅ Config file loaded"
else
  echo "ℹ️  No client config file found at $CONFIG_FILE (using defaults)"
fi

# Layer 2: Apply config_overrides (highest priority)
if [ -n "${INPUT_CONFIG_OVERRIDES:-}" ]; then
  echo "📝 Applying config_overrides..."

  OVERRIDE_ORG=$(echo "$INPUT_CONFIG_OVERRIDES" | yq -r '.org_display_name // ""' 2>/dev/null || echo "")
  [ -n "$OVERRIDE_ORG" ] && ORG_DISPLAY_NAME="$OVERRIDE_ORG"

  OVERRIDE_LOGO=$(echo "$INPUT_CONFIG_OVERRIDES" | yq -r '.org_logo_url // ""' 2>/dev/null || echo "")
  [ -n "$OVERRIDE_LOGO" ] && ORG_LOGO_URL="$OVERRIDE_LOGO"

  OVERRIDE_REPO=$(echo "$INPUT_CONFIG_OVERRIDES" | yq -r '.repo_display_name // ""' 2>/dev/null || echo "")
  [ -n "$OVERRIDE_REPO" ] && REPO_DISPLAY_NAME="$OVERRIDE_REPO"

  OVERRIDE_SEVERITY=$(echo "$INPUT_CONFIG_OVERRIDES" | yq -r '.trivy_severity // ""' 2>/dev/null || echo "")
  [ -n "$OVERRIDE_SEVERITY" ] && TRIVY_SEVERITY="$OVERRIDE_SEVERITY"

  OVERRIDE_TRIVY_CONFIG=$(echo "$INPUT_CONFIG_OVERRIDES" | yq -r '.trivy_config // ""' 2>/dev/null || echo "")
  [ -n "$OVERRIDE_TRIVY_CONFIG" ] && TRIVY_CONFIG="$OVERRIDE_TRIVY_CONFIG"

  OVERRIDE_SEMGREP=$(echo "$INPUT_CONFIG_OVERRIDES" | yq -r '.semgrep_configs // ""' 2>/dev/null || echo "")
  [ -n "$OVERRIDE_SEMGREP" ] && SEMGREP_CONFIGS="$OVERRIDE_SEMGREP"

  OVERRIDE_KEEP=$(echo "$INPUT_CONFIG_OVERRIDES" | yq -r '.retention_keep // ""' 2>/dev/null || echo "")
  [ -n "$OVERRIDE_KEEP" ] && RETENTION_KEEP="$OVERRIDE_KEEP"

  OVERRIDE_DAYS=$(echo "$INPUT_CONFIG_OVERRIDES" | yq -r '.retention_days // ""' 2>/dev/null || echo "")
  [ -n "$OVERRIDE_DAYS" ] && RETENTION_DAYS="$OVERRIDE_DAYS"

  echo "   ✅ Overrides applied"
fi

# Output resolved values
echo "org_display_name=$ORG_DISPLAY_NAME" >> "$GITHUB_OUTPUT"
echo "org_logo_url=$ORG_LOGO_URL" >> "$GITHUB_OUTPUT"
echo "repo_display_name=$REPO_DISPLAY_NAME" >> "$GITHUB_OUTPUT"
echo "trivy_config=$TRIVY_CONFIG" >> "$GITHUB_OUTPUT"
echo "trivy_severity=$TRIVY_SEVERITY" >> "$GITHUB_OUTPUT"
echo "semgrep_configs=$SEMGREP_CONFIGS" >> "$GITHUB_OUTPUT"
echo "retention_keep=$RETENTION_KEEP" >> "$GITHUB_OUTPUT"
echo "retention_days=$RETENTION_DAYS" >> "$GITHUB_OUTPUT"

echo ""
echo "📊 Resolved configuration:"
echo "   Organization: ${ORG_DISPLAY_NAME:-<not set>}"
echo "   Logo URL: ${ORG_LOGO_URL:-<not set>}"
echo "   Repository: ${REPO_DISPLAY_NAME:-<not set>}"
echo "   Trivy config: ${TRIVY_CONFIG:-<not set>}"
echo "   Trivy severity: $TRIVY_SEVERITY"
echo "   Semgrep configs: $SEMGREP_CONFIGS"
echo "   Retention keep: $RETENTION_KEEP"
echo "   Retention days: $RETENTION_DAYS"
