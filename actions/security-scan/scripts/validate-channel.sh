#!/usr/bin/env bash
#
# Validates a channel name for use in security scan tags and releases.
#
# Usage: validate-channel.sh
#
# Environment:
#   INPUT_CHANNEL - The channel name to validate
#
# Validation rules:
#   - Required (cannot be empty)
#   - Max 35 characters
#   - Only alphanumeric characters, dashes, and underscores
#   - Cannot start or end with dash or underscore
#
# Exit codes:
#   0 - Channel name is valid
#   1 - Channel name is invalid (error message printed to stdout)

set -euo pipefail

CHANNEL="${INPUT_CHANNEL:-}"

# Check if empty
if [ -z "$CHANNEL" ]; then
  echo "Error: channel is required but empty"
  exit 1
fi

# Check length (max 35 characters)
if [ ${#CHANNEL} -gt 35 ]; then
  echo "Error: channel name too long (max 35 characters): '$CHANNEL'"
  exit 1
fi

# Check for invalid characters (only allow: a-z, A-Z, 0-9, dash, underscore)
if ! echo "$CHANNEL" | grep -qE '^[a-zA-Z0-9_-]+$'; then
  echo "Error: channel contains invalid characters: '$CHANNEL'"
  echo "   Allowed: a-z, A-Z, 0-9, dash (-), underscore (_)"
  exit 1
fi

# Check it doesn't start/end with dash or underscore
if echo "$CHANNEL" | grep -qE '^[-_]|[-_]$'; then
  echo "Error: channel cannot start or end with dash/underscore: '$CHANNEL'"
  exit 1
fi

echo "Channel name is valid: '$CHANNEL'"
