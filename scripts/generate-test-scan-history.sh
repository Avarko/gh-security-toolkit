#!/bin/bash
set -euo pipefail

# Generate realistic scan-history.json with 20 nightly scans
# Simulates security vulnerability remediation over time

OUTPUT_FILE="${1:-scan-history.json}"
CHANNEL="${2:-nightly}"

echo "Generating realistic scan history: $OUTPUT_FILE"

# Start JSON
echo '{' > "$OUTPUT_FILE"
echo '  "version": 2,' >> "$OUTPUT_FILE"
echo '  "scans": [' >> "$OUTPUT_FILE"

# Generate 20 nightly scans (starting 19 days ago, ending today)
for i in {19..0}; do
  # Calculate date (i days ago)
  if [ "$(uname)" = "Darwin" ]; then
    SCAN_DATE=$(date -u -v-${i}d +'%Y-%m-%d')
  else
    SCAN_DATE=$(date -u -d "$i days ago" +'%Y-%m-%d')
  fi
  TIMESTAMP="${SCAN_DATE}-020000Z"

  # Simulate vulnerability trends over time
  # Days 0-9 (oldest): High vulnerabilities (initial state)
  # Day 10: Major fix applied - dramatic drop
  # Days 11-19 (recent): Gradual improvement to zero

  if [ $i -ge 11 ]; then
    # Early days (oldest): high vulnerability count
    CRITICAL=10
    HIGH=25
    ERRORS=15
    WARNINGS=30
  elif [ $i -eq 10 ]; then
    # Day of fix: dramatic improvement
    CRITICAL=0
    HIGH=8
    ERRORS=2
    WARNINGS=10
  else
    # After fix (recent days): gradual decline to zero
    # i ranges from 0-9, where 0 is today (should be cleanest)
    # and 9 is one day after the fix
    DAYS_SINCE_FIX=$((10 - i))
    CRITICAL=0
    HIGH=$((8 - DAYS_SINCE_FIX))
    ERRORS=$((2 - DAYS_SINCE_FIX / 5))
    WARNINGS=$((10 - DAYS_SINCE_FIX))

    # Ensure non-negative
    [ $HIGH -lt 0 ] && HIGH=0
    [ $ERRORS -lt 0 ] && ERRORS=0
    [ $WARNINGS -lt 0 ] && WARNINGS=0
  fi

  # Add some randomness for realism (±20%)
  CRITICAL=$((CRITICAL + RANDOM % 3 - 1))
  HIGH=$((HIGH + RANDOM % 5 - 2))
  ERRORS=$((ERRORS + RANDOM % 3 - 1))
  WARNINGS=$((WARNINGS + RANDOM % 6 - 3))

  # Ensure non-negative after randomness
  [ $CRITICAL -lt 0 ] && CRITICAL=0
  [ $HIGH -lt 0 ] && HIGH=0
  [ $ERRORS -lt 0 ] && ERRORS=0
  [ $WARNINGS -lt 0 ] && WARNINGS=0

  # Random values for medium/low/info (less important)
  MEDIUM=$((RANDOM % 10 + 5))
  LOW=$((RANDOM % 20 + 10))
  INFO=$((RANDOM % 15 + 5))

  # Generate fake commit SHA
  COMMIT_SHA=$(printf '%040x' $((RANDOM * RANDOM * RANDOM)))

  # Determine if this is the last entry (no trailing comma)
  COMMA=","
  [ $i -eq 0 ] && COMMA=""

  # Write entry in ScanMetadata format
  cat >> "$OUTPUT_FILE" << EOF
    {
      "channel": "$CHANNEL",
      "timestamp": "$TIMESTAMP",
      "branch": "main",
      "commit": "$COMMIT_SHA",
      "trivyFsResults": {
        "totalVulnerabilities": {
          "CRITICAL": $CRITICAL,
          "HIGH": $HIGH,
          "MEDIUM": $MEDIUM,
          "LOW": $LOW
        }
      },
      "trivyImageResults": {
        "totalVulnerabilities": {
          "CRITICAL": 0,
          "HIGH": 0,
          "MEDIUM": 0,
          "LOW": 0
        }
      },
      "semgrepResults": {
        "totalErrors": $ERRORS,
        "totalWarnings": $WARNINGS,
        "totalInfos": $INFO
      }
    }$COMMA
EOF
done

# Close JSON
echo '  ]' >> "$OUTPUT_FILE"
echo '}' >> "$OUTPUT_FILE"

echo "✅ Generated $OUTPUT_FILE with 20 nightly scans"
echo "   Timeline simulation:"
echo "   - Days 1-10 (oldest):  High vulnerabilities (C:10, H:25, E:15, W:30)"
echo "   - Day 11 (19 days ago): Major fix applied (C:0, H:8, E:2, W:10)"
echo "   - Days 12-20 (recent): Gradual improvement → zero (today)"
