#!/usr/bin/env bash
#
# Builds a filesystem scan root directory from a list of paths.
# Validates paths for security (no absolute paths, path traversal, or shell metacharacters).
# Copies valid paths using rsync --relative to preserve directory structure.
#
# Usage: build-fsroot.sh <target_root> <github_output_file>
#
# Arguments:
#   target_root         - Directory where paths will be copied
#   github_output_file  - Path to $GITHUB_OUTPUT file
#
# Environment:
#   FILESYSTEM_PATHS - Newline-separated list of paths to process
#
# Outputs (written to GITHUB_OUTPUT):
#   scan_root    - Path to the created scan root directory
#   has_fs_scan  - "true" if scan root was created successfully

set -euo pipefail

if [ $# -lt 2 ]; then
    echo "Usage: $0 <target_root> <github_output_file>"
    exit 1
fi

ROOT="$1"
GITHUB_OUTPUT="$2"
PATHS="${FILESYSTEM_PATHS:-}"

if [ -z "$PATHS" ]; then
    echo "Error: FILESYSTEM_PATHS environment variable is empty"
    exit 1
fi

mkdir -p "$ROOT"

echo "📁 Building filesystem scan root at: $ROOT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Count for summary
VALID_COUNT=0
INVALID_COUNT=0
INVALID_PATHS=""

# Process newline-separated paths
while IFS= read -r path || [ -n "$path" ]; do
  # Skip empty lines and comments
  [ -z "$path" ] && continue
  [[ "$path" =~ ^[[:space:]]*# ]] && continue

  # Trim whitespace
  path="${path#"${path%%[![:space:]]*}"}"   # trim left
  path="${path%"${path##*[![:space:]]}"}"   # trim right
  [ -z "$path" ] && continue

  # Security: reject absolute paths (must be relative to workspace)
  if [[ "$path" = /* ]]; then
    echo "❌ REJECTED (absolute path not allowed): '$path'"
    INVALID_COUNT=$((INVALID_COUNT + 1))
    INVALID_PATHS="${INVALID_PATHS}\n  - $path (absolute path)"
    continue
  fi

  # Security: reject path traversal attempts
  if [[ "$path" =~ \.\. ]]; then
    echo "❌ REJECTED (path traversal not allowed): '$path'"
    INVALID_COUNT=$((INVALID_COUNT + 1))
    INVALID_PATHS="${INVALID_PATHS}\n  - $path (path traversal)"
    continue
  fi

  # Security: reject paths with shell metacharacters
  if [[ "$path" =~ [\;\|\&\$\`\(\)\{\}\[\]\<\>\!\*\?] ]]; then
    echo "❌ REJECTED (invalid characters): '$path'"
    INVALID_COUNT=$((INVALID_COUNT + 1))
    INVALID_PATHS="${INVALID_PATHS}\n  - $path (invalid characters)"
    continue
  fi

  # Validate: check path exists
  if [ ! -e "$path" ]; then
    echo "❌ REJECTED (path not found): '$path'"
    INVALID_COUNT=$((INVALID_COUNT + 1))
    INVALID_PATHS="${INVALID_PATHS}\n  - $path (not found)"
    continue
  fi

  # Copy with rsync preserving relative path structure
  echo "✅ Adding: '$path'"
  rsync -a --relative "$path" "$ROOT/"
  VALID_COUNT=$((VALID_COUNT + 1))
done <<< "$PATHS"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Summary: $VALID_COUNT valid paths, $INVALID_COUNT rejected"

# Fail fast if any paths were invalid
if [ "$INVALID_COUNT" -gt 0 ]; then
  echo ""
  echo "❌ ERROR: $INVALID_COUNT path(s) failed validation:${INVALID_PATHS}"
  echo ""
  echo "Please fix the filesystem_paths input and retry."
  exit 1
fi

# Fail if no valid paths were found
if [ "$VALID_COUNT" -eq 0 ]; then
  echo ""
  echo "❌ ERROR: No valid paths found in filesystem_paths input."
  echo "   Provided input was:"
  echo "$PATHS" | head -20
  exit 1
fi

# Show what was copied
echo ""
echo "📦 File type summary:"
FILE_LIST="$ROOT/.filelist"
if ! find "$ROOT" -type f > "$FILE_LIST"; then
  echo "  (find failed, skipping summary)"
else
  if [ ! -s "$FILE_LIST" ]; then
    echo "  (no files found)"
  else
    declare -A ext_counts=()
    while IFS= read -r f; do
      filename=${f##*/}        # basename
      ext=${filename##*.}

      if [ "$filename" = "$ext" ]; then
        ext="(none)"
      fi
      if [[ -v "ext_counts[$ext]" ]]; then
        ext_counts["$ext"]=$(( ext_counts["$ext"] + 1 ))
      else
        ext_counts["$ext"]=1
      fi
    done < "$FILE_LIST"
    total=0
    for ext in "${!ext_counts[@]}"; do
      count=${ext_counts[$ext]}
      printf "  %-10s %6d files\n" "$ext" "$count"
      total=$(( total + count ))
    done
    echo "  --------------------------"
    echo "  Total files: $total"
  fi
fi

echo "scan_root=$ROOT" >> "$GITHUB_OUTPUT"
echo "has_fs_scan=true" >> "$GITHUB_OUTPUT"
