#!/usr/bin/env bash
#
# Runs TruffleHog from the scanner image actions/scan pins, and writes a
# report of what it found with the secret values removed.
#
# The raw TruffleHog output is never printed and never leaves this script: it
# carries every secret it found in full (Raw, RawV2, Redacted, SecretParts),
# and a workflow log is readable by everyone with read access to the
# repository, for as long as the log is kept. The previous version of this
# action printed it with cat.
#
# Environment (set by action.yml): ACTION_PATH, INPUT_*; RUNNER_TEMP, GITHUB_*.

set -euo pipefail

die() {
	echo "::error::$*" >&2
	exit 1
}

for tool in docker jq git realpath; do
	command -v "$tool" >/dev/null 2>&1 || die "the TruffleHog action needs $tool on the runner"
done

image_ref_file="$ACTION_PATH/../../scan/image.ref"
image=$(grep -v -E '^[[:space:]]*(#|$)' "$image_ref_file" | head -n 1 | tr -d '[:space:]' || true)
[[ $image =~ ^ghcr\.io/avarko/gh-security-toolkit@sha256:[0-9a-f]{64}$ ]] \
	|| die "actions/scan/image.ref does not name the scanner image by digest: '$image'"

scan_dir=$(cd "${INPUT_PATH:-.}" 2>/dev/null && pwd -P) || die "path '${INPUT_PATH:-.}' does not exist"

scan_type=${INPUT_SCAN_TYPE:-auto}
if [ "$scan_type" = auto ]; then
	if git -c safe.directory="$scan_dir" -C "$scan_dir" rev-parse --is-inside-work-tree >/dev/null 2>&1 \
		&& [ "$(git -c safe.directory="$scan_dir" -C "$scan_dir" rev-parse --show-toplevel)" = "$scan_dir" ]; then
		scan_type=git
	else
		scan_type=filesystem
	fi
fi
case $scan_type in
	git | filesystem) ;;
	*) die "scan_type must be git, filesystem or auto, not '$scan_type'" ;;
esac

results=${INPUT_RESULTS:-verified,unverified,unknown}
[[ $results =~ ^(verified|unverified|unknown|filtered_unverified)(,(verified|unverified|unknown|filtered_unverified))*$ ]] \
	|| die "results must be a comma-separated list of verified, unverified, unknown, filtered_unverified: '$results'"

verify=false
[ "${INPUT_VERIFY:-false}" = true ] && verify=true

out=$(realpath -m -- "${INPUT_OUTPUT_DIR:-${RUNNER_TEMP:-/tmp}/trufflehog}")
case "$out/" in
	"$scan_dir/"*) die "output_dir must be outside the scanned path ($scan_dir)" ;;
esac
mkdir -p "$out"
report="$out/trufflehog.json"
raw="$out/.trufflehog-raw.jsonl"
log="$out/.trufflehog.log"
excl_file="$out/.trufflehog-exclude"
rm -f "$report" "$raw" "$log" "$excl_file"
# The raw output holds the secrets in full; it and the scratch files are
# deleted however this exits.
trap 'rm -f "$raw" "$log" "$excl_file"' EXIT

# The exclude file is read inside the container, so it has to be under the
# mounted path; anything else is copied next to the report and mounted there.
excl_host=""
if [ -n "${INPUT_EXCLUDE_PATHS_FILE:-}" ]; then
	excl_host=$(realpath -e -- "$INPUT_EXCLUDE_PATHS_FILE" 2>/dev/null) \
		|| die "exclude_paths_file '$INPUT_EXCLUDE_PATHS_FILE' does not exist"
elif [ -f "$scan_dir/.trufflehogignore" ]; then
	excl_host="$scan_dir/.trufflehogignore"
fi
{
	# A filesystem scan of a checkout reads .git/objects too, which is the
	# history compressed: every finding there is a duplicate of a file finding
	# or belongs to the git scan. Not wanted in either mode.
	echo '^\.git/'
	if [ -n "$excl_host" ]; then
		grep -v -E '^[[:space:]]*(#|$)' "$excl_host" || true
	fi
} >"$excl_file"

cmd=()
mode=""
if [ "$scan_type" = git ]; then
	head=${INPUT_HEAD:-HEAD}
	base=${INPUT_BASE:-}
	# A push that creates a branch has before=0000...; there is no base then.
	[[ $base =~ ^0+$ ]] && base=""
	g() { git -c safe.directory="$scan_dir" -C "$scan_dir" "$@"; }
	head_sha=$(g rev-parse --verify --quiet "$head^{commit}") \
		|| die "head '$head' is not a commit in $scan_dir (is the checkout shallow? use fetch-depth: 0)"
	cmd+=(git file:///workspace "--branch=$head_sha")
	if [ -n "$base" ]; then
		base_sha=$(g rev-parse --verify --quiet "$base^{commit}") \
			|| die "base '$base' is not a commit in $scan_dir (is the checkout shallow? use fetch-depth: 0)"
		cmd+=("--since-commit=$base_sha")
		mode="git ${base_sha:0:8}..${head_sha:0:8}"
	else
		mode="git, full history to ${head_sha:0:8}"
	fi
else
	cmd+=(filesystem .)
	mode="filesystem"
fi
cmd+=(--json --no-update "--results=$results" "--exclude-paths=/trufflehog-config/.trufflehog-exclude")
[ "$verify" = true ] || cmd+=(--no-verification)

# Locked down like every scan in Makefile.scanners: read-only image and
# workspace, no capabilities, no privilege gain, and no network unless
# verification was asked for (it is the network call).
network=none
[ "$verify" = true ] && network=bridge
echo "Running TruffleHog ($mode, results=$results, verification=$verify)"
rc=0
docker run --rm --network="$network" --read-only --tmpfs /tmp --cap-drop=ALL \
	--security-opt=no-new-privileges --user "$(id -u):$(id -g)" -e HOME=/tmp \
	-v "$scan_dir":/workspace:ro -v "$out":/trufflehog-config:ro -w /workspace \
	--entrypoint trufflehog "$image" "${cmd[@]}" >"$raw" 2>"$log" || rc=$?

# TruffleHog exits 0 with or without findings (no --fail here); anything else
# is the tool failing, and a failed scan must not read as a clean one.
if [ "$rc" -ne 0 ]; then
	# Errors only: TruffleHog does not put secrets in its log, but only the
	# lines that say what went wrong are needed.
	grep -v -E '"level":"info|info-[0-9]' "$log" | tail -n 20 >&2 || true
	die "TruffleHog failed (exit $rc); see the log above"
fi

# Keep only where and what, never the value. Lines that are not findings (if
# any log line reached stdout) are dropped by the select.
jq -s \
	--arg mode "$mode" --arg results "$results" --argjson verify "$verify" '
	[ .[] | select(type == "object" and has("SourceMetadata")) |
	  (.SourceMetadata.Data | to_entries[0].value) as $loc |
	  {
	    detector: .DetectorName,
	    verified: (.Verified == true),
	    file: ($loc.file // ""),
	    line: ($loc.line // null),
	    commit: ($loc.commit // null),
	    timestamp: ($loc.timestamp // null)
	  } ] | unique as $findings |
	{ format_version: "1", tool: "trufflehog", mode: $mode, results: $results, verify: $verify, findings: $findings }
' "$raw" >"$report"
rm -f "$raw"

count=$(jq '.findings | length' "$report")
verified=$(jq '[.findings[] | select(.verified)] | length' "$report")
has_verified=false
[ "$verified" -gt 0 ] && has_verified=true

{
	echo "findings_count=$count"
	echo "has_verified=$has_verified"
	echo "report=$report"
} >>"${GITHUB_OUTPUT:-/dev/null}"

if [ "$count" -eq 0 ]; then
	echo "✅ No secrets found"
	exit 0
fi

echo "⚠️  $count potential secret(s), $verified verified (values not shown):"
jq -r '.findings[] | "   \(.detector)  \(.file)\(if .line then ":\(.line)" else "" end)\(if .commit then "  @\(.commit[0:8])" else "" end)\(if .verified then "  VERIFIED" else "" end)"' "$report"

if [ "${INPUT_FAIL_ON_FINDINGS:-true}" = true ]; then
	echo "::error::TruffleHog reported $count potential secret(s)"
	exit 1
fi
