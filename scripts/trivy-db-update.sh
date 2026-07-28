#!/usr/bin/env bash

# Thin wrapper around the database helper.
#
# The update logic itself lives in the helper binary rather than here. It
# outgrew what is comfortable to keep portable — date arithmetic, size
# formatting and atomic directory swaps all differ between GNU and BSD
# userland — and the toolkit has to behave identically on Linux and macOS.
# The helper is cross-compiled for both, so this script only has to find it.

set -euo pipefail

# Prefer an explicitly configured helper, then one next to this script, then
# PATH. Inside the toolkit container it is installed as /usr/local/bin.
find_helper() {
    if [ -n "${GHST_DB_HELPER:-}" ]; then
        echo "$GHST_DB_HELPER"
        return
    fi

    local here
    here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

    local candidate
    for candidate in \
        "$here/../bin/trivy-db-helper" \
        "$here/trivy-db-helper" \
        "/usr/local/bin/trivy-db-helper"
    do
        if [ -x "$candidate" ]; then
            echo "$candidate"
            return
        fi
    done

    if command -v trivy-db-helper >/dev/null 2>&1; then
        echo "trivy-db-helper"
        return
    fi

    echo "error: trivy-db-helper not found" >&2
    echo "  set GHST_DB_HELPER to its path, or pull the toolkit image" >&2
    return 1
}

case "${1:-}" in
    update|ensure|status)
        exec "$(find_helper)" -command "$1"
        ;;
    *)
        cat >&2 <<'USAGE'
Usage: trivy-db-update.sh {update|ensure|status}

  update  Fetch database updates now
  ensure  Update only if the cache is stale (used by scan targets)
  status  Show cache location, age and versions

Environment:
  GHST_DB_CACHE         Cache directory
  GHST_DB_REPO          Registry holding the published databases
  GHST_DB_MAX_AGE_DAYS  Age at which an offline cache warns (default 14)
  GHST_OFFLINE=1        Use the existing cache, never fetch
  GHST_DB_HELPER        Path to the helper binary
USAGE
        exit 1
        ;;
esac
