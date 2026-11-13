#!/usr/bin/env bash
#
# Runs the toolkit's scans on a checkout with the scanner image this release
# names by digest, and writes the reports and a manifest to one directory.
#
# The scans are the Makefile.scanners targets scanx runs on a developer's
# machine, from the same release of that file, so a finding here can be
# reproduced locally with `scanx scan` on the same commit. Nothing is
# installed on the runner: every tool runs inside the image, offline except
# for the database update and Semgrep's rulesets.
#
# Environment (set by action.yml):
#   ACTION_PATH, ACTION_REF, ACTION_REPOSITORY  - where this action came from
#   INPUT_PATH, INPUT_IMAGE_REF, INPUT_SCANNERS,
#   INPUT_OUTPUT_DIR, INPUT_FAIL_ON_ERROR        - the action's inputs
#   RUNNER_TEMP, GITHUB_*                         - from the runner

set -euo pipefail

die() {
	echo "::error::$*" >&2
	exit 1
}

for tool in docker make jq git realpath; do
	command -v "$tool" >/dev/null 2>&1 || die "actions/scan needs $tool on the runner"
done

root=$(cd "$ACTION_PATH/../.." && pwd -P)

# Every value below reaches make's command line, where make expands it before
# any check of its own sees it: '$(shell ...)' in an output-dir would run on
# the runner. The Makefile also splits mounts on spaces. So paths and refs are
# held to characters that mean nothing to make or to sh, and anything else is
# refused here rather than half-working later.
safe_path='^[A-Za-z0-9._/@+=,:~-]+$'
safe_ref='^[A-Za-z0-9._/:@-]+$'

# The image this release was tested with. A tag here would let the scanner
# change under a pinned release, which is the one thing pinning promises not
# to happen, so only a digest is accepted.
image=$(grep -v -E '^[[:space:]]*(#|$)' "$ACTION_PATH/image.ref" | head -n 1 | tr -d '[:space:]' || true)
[[ $image =~ ^ghcr\.io/avarko/gh-security-toolkit@sha256:[0-9a-f]{64}$ ]] \
	|| die "actions/scan/image.ref does not name the scanner image by digest: '$image'"

# Which release of the toolkit this is: the ref the caller pinned (v2,
# v2.1.0 or a commit), or "local" for `uses: ./actions/scan` in this
# repository's own workflows.
release=${ACTION_REF:-local}
[[ $release =~ $safe_ref ]] || die "unexpected action ref '$release'"

image_ref=${INPUT_IMAGE_REF:-}
[ -z "$image_ref" ] || [[ $image_ref =~ $safe_ref ]] \
	|| die "image-ref '$image_ref' is not an image reference: letters, digits and . _ / : @ - only"

scanners=$(printf '%s' "${INPUT_SCANNERS:-}" | tr '\n' ',')
if [ -z "${scanners//[ ,]/}" ]; then
	scanners="fs,config,semgrep"
	[ -z "$image_ref" ] || scanners="$scanners,image"
fi
IFS=', ' read -r -a scanner_list <<<"$scanners"
for s in "${scanner_list[@]}"; do
	case $s in
		fs | config | semgrep) ;;
		image) [ -n "$image_ref" ] || die "scanner 'image' needs the image-ref input" ;;
		*) die "unknown scanner '$s'; expected fs, config, semgrep or image" ;;
	esac
done

scan_dir=$(cd "${INPUT_PATH:-.}" 2>/dev/null && pwd -P) || die "path '${INPUT_PATH:-.}' does not exist"
[[ $scan_dir =~ $safe_path ]] \
	|| die "the scanned path '$scan_dir' has characters the scan cannot pass on safely: use letters, digits and . _ / @ + = , : ~ -"

# Relative to the workspace, like path, and resolved before anything is
# created, so a refused output-dir leaves nothing behind in the checkout.
out=$(realpath -m -- "${INPUT_OUTPUT_DIR:-${RUNNER_TEMP:-/tmp}/gh-security-toolkit}")
[[ $out =~ $safe_path ]] \
	|| die "output-dir '$out' has characters the scan cannot pass on safely: use letters, digits and . _ / @ + = , : ~ -"
# Inside the scanned tree the reports would be scanned themselves (Semgrep's
# secrets rules over Trivy's output), and clearing old ones would delete the
# project's own files of the same names.
case "$out/" in
	"$scan_dir/"*) die "output-dir must be outside the scanned path ($scan_dir)" ;;
esac
mkdir -p "$out"
cd "$scan_dir"
rm -f "$out"/trivy-*.json "$out/semgrep.json" "$out/manifest.json"

# GHST_RELEASE turns off the checks that only make sense for a clone that
# updates itself (see Makefile.scanners). The image tag is a name for the
# banner and the stamps; the image itself is the digest.
make_args=(
	--no-print-directory -s -f "$root/Makefile.scanners"
	SCANX_HOME="$root" PWD="$scan_dir"
	__GHST_IMAGE="$image" __GHST_IMAGE_TAG=actions-scan
	GHST_RELEASE="$release" GHST_PROGRESS=0
	__GHST_REPORT_DIR="$out"
)

started_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
failed=0

# A failed update is an error even though the scans still run: they then use
# whatever the cache held, which a restored actions/cache can make old. The
# manifest records the database dates either way.
echo "::group::Vulnerability databases"
db_rc=0
make "${make_args[@]}" sec/db/update || db_rc=$?
echo "::endgroup::"
if [ "$db_rc" -ne 0 ]; then
	failed=$((failed + 1))
	echo "::error::The vulnerability database update failed; scans use the cached copy, if any" >&2
fi

# Every known scanner has an entry, in a fixed order, so a reader can rely on
# the key being there; those not asked for stay "skipped".
status_json='{"fs":{"status":"skipped","file":null},"config":{"status":"skipped","file":null},"image":{"status":"skipped","file":null},"semgrep":{"status":"skipped","file":null}}'

# One make run per scanner, so each gets its own status: a scan that fails
# must not hide the reports of the others, and the manifest has to say which
# one it was.
for s in "${scanner_list[@]}"; do
	case $s in
		fs) target=sec/scan/trivy/fs file=trivy-fs.json extra=() ;;
		config) target=sec/scan/trivy/config file=trivy-config.json extra=() ;;
		image) target=sec/scan/trivy/img file=trivy-image.json extra=("IMAGE=$image_ref") ;;
		semgrep) target=sec/scan/semgrep file=semgrep.json extra=() ;;
	esac
	echo "::group::Scan: $s"
	rc=0
	make "${make_args[@]}" "${extra[@]}" "$target" || rc=$?
	echo "::endgroup::"

	# "ok" means the tool finished and left its own JSON -- findings or not.
	# For Trivy that is the report, whatever the exit status: a trivy.yaml may
	# set exit-code to fail on findings, and that is a result, not a breakage.
	# Semgrep runs without --error, so it exits non-zero only when it could
	# not do its job (a ruleset it could not fetch, a .semgrep.yaml it could
	# not parse); it still writes a JSON report then, with nothing scanned,
	# which must not read as a clean scan.
	if [ "$s" = semgrep ]; then
		check='has("results") and has("errors")'
	else
		check='has("SchemaVersion")'
	fi
	report=null
	if [ -s "$out/$file" ] && jq -e "$check" "$out/$file" >/dev/null 2>&1; then
		report=$file
		state=ok
		[ "$s" != semgrep ] || [ "$rc" -eq 0 ] || state=failed
	else
		rm -f "$out/$file"
		state=failed
	fi
	if [ "$state" = failed ]; then
		failed=$((failed + 1))
		echo "::error::Scanner '$s' did not complete; see the log above" >&2
	fi
	status_json=$(jq -c --arg s "$s" --arg state "$state" --arg file "$report" \
		'.[$s] = {status: $state, file: (if $file == "null" then null else $file end)}' \
		<<<"$status_json")
done

finished_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# What produced the reports. Read from the image's labels and the database
# helper rather than restated here, so the manifest cannot claim a version
# that did not run.
label() {
	docker image inspect "$image" --format "{{with index .Config.Labels \"$1\"}}{{.}}{{end}}" 2>/dev/null || true
}
db_status=$(make "${make_args[@]}" sec/db/status 2>/dev/null || true)
db_version() {
	printf '%s\n' "$db_status" | sed -n -E "s/^[[:space:]]*$1:[[:space:]]+([0-9]{8}).*/\\1/p" | head -n 1
}

# safe.directory: a checkout made by another user, as in a container job,
# would otherwise come back with no commit at all.
g() { git -c safe.directory="$scan_dir" -C "$scan_dir" "$@" 2>/dev/null; }
commit="" describe="" remote=""
if g rev-parse --git-dir >/dev/null; then
	commit=$(g rev-parse HEAD || true)
	describe=$(g describe --tags --always --dirty || true)
	# Credentials a checkout may have embedded in the URL stay out of it.
	remote=$(g remote get-url origin | sed -E 's#//[^/@]*@#//#' || true)
fi

# The project's own configuration changes what the scans report: a
# .semgrep.yaml replaces the default rulesets, a trivy.yaml can change
# severities and skip directories, ignore files suppress findings. A reader
# deciding how much a clean result means needs to know which were there.
config_files=$(for f in trivy.yaml .trivy.yaml .trivyignore .trivyignore.yaml .semgrep.yaml .semgrep.yml .semgrepignore; do
	if [ -f "$scan_dir/$f" ]; then printf '%s\n' "$f"; fi
done | jq -R . | jq -s -c .)

image_target=null
if [ -n "$image_ref" ]; then
	image_target=$(jq -n --arg ref "$image_ref" \
		--arg id "$(docker image inspect "$image_ref" --format '{{.Id}}' 2>/dev/null || true)" \
		--arg repo_digest "$(docker image inspect "$image_ref" --format '{{if .RepoDigests}}{{index .RepoDigests 0}}{{end}}' 2>/dev/null || true)" \
		'{ref: $ref, id: ($id | select(. != "")), repo_digest: ($repo_digest | select(. != ""))}')
fi

run_url=""
if [ -n "${GITHUB_RUN_ID:-}" ]; then
	run_url="${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-}/actions/runs/${GITHUB_RUN_ID}/attempts/${GITHUB_RUN_ATTEMPT:-1}"
fi

jq -n \
	--arg release "$release" \
	--arg action_repository "${ACTION_REPOSITORY:-}" \
	--arg image "$image" \
	--arg trivy "$(label fi.evolver.ghst.trivy.version)" \
	--arg semgrep "$(label fi.evolver.ghst.semgrep.version)" \
	--arg helper "$(label fi.evolver.ghst.trivy-db-helper.version)" \
	--arg revision "$(label org.opencontainers.image.revision)" \
	--arg db_main "$(db_version main)" \
	--arg db_java "$(db_version java)" \
	--argjson db_rc "$db_rc" \
	--arg path "${INPUT_PATH:-.}" \
	--arg commit "$commit" \
	--arg describe "$describe" \
	--arg remote "$remote" \
	--argjson config_files "$config_files" \
	--argjson image_target "$image_target" \
	--arg repository "${GITHUB_REPOSITORY:-}" \
	--arg run_url "$run_url" \
	--arg started_at "$started_at" \
	--arg finished_at "$finished_at" \
	--argjson scanners "$status_json" \
	'def opt: select(. != "") // null;
	{
		format_version: "2.0",
		toolkit: {
			release: $release,
			repository: ($action_repository | opt),
			image: $image,
			image_revision: ($revision | opt),
			tools: {trivy: ($trivy | opt), semgrep: ($semgrep | opt), trivy_db_helper: ($helper | opt)}
		},
		databases: {update_exit_code: $db_rc, main: ($db_main | opt), java: ($db_java | opt)},
		target: {
			path: $path,
			git: {remote: ($remote | opt), commit: ($commit | opt), describe: ($describe | opt)},
			config_files: $config_files,
			image: $image_target
		},
		run: {repository: ($repository | opt), url: ($run_url | opt), started_at: $started_at, finished_at: $finished_at},
		scanners: $scanners
	}' >"$out/manifest.json"

{
	echo "output-dir=$out"
	echo "manifest=$out/manifest.json"
} >>"${GITHUB_OUTPUT:-/dev/null}"

echo "📄 Reports and manifest: $out" >&2
jq -r '.scanners | to_entries[] | "   \(.key): \(.value.status)"' "$out/manifest.json" >&2

if [ "$failed" -gt 0 ] && [ "${INPUT_FAIL_ON_ERROR:-true}" = "true" ]; then
	die "$failed error(s): see the log and manifest.json"
fi
