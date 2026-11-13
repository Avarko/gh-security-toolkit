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

for tool in docker make jq git; do
	command -v "$tool" >/dev/null 2>&1 || die "actions/scan needs $tool on the runner"
done

root=$(cd "$ACTION_PATH/../.." && pwd -P)

# The image this release was tested with. A tag here would let the scanner
# change under a pinned release, which is the one thing pinning promises not
# to happen, so only a digest is accepted.
image=$(grep -v -E '^[[:space:]]*(#|$)' "$ACTION_PATH/image.ref" | head -n 1 | tr -d '[:space:]')
[[ $image =~ ^ghcr\.io/avarko/gh-security-toolkit@sha256:[0-9a-f]{64}$ ]] \
	|| die "actions/scan/image.ref does not name the scanner image by digest: '$image'"

# Which release of the toolkit this is: the ref the caller pinned (v2,
# v2.1.0 or a commit), or "local" for `uses: ./actions/scan` in this
# repository's own workflows.
release=${ACTION_REF:-local}

scanners=${INPUT_SCANNERS:-}
if [ -z "$scanners" ]; then
	scanners="fs,config,semgrep"
	[ -z "${INPUT_IMAGE_REF:-}" ] || scanners="$scanners,image"
fi
IFS=', ' read -r -a scanner_list <<<"$scanners"
for s in "${scanner_list[@]}"; do
	case $s in
		fs | config | semgrep) ;;
		image) [ -n "${INPUT_IMAGE_REF:-}" ] || die "scanner 'image' needs the image-ref input" ;;
		*) die "unknown scanner '$s'; expected fs, config, semgrep or image" ;;
	esac
done

out=${INPUT_OUTPUT_DIR:-$RUNNER_TEMP/gh-security-toolkit}
mkdir -p "$out"
out=$(cd "$out" && pwd -P)
rm -f "$out"/trivy-*.json "$out/semgrep.json" "$out/manifest.json"

cd "${INPUT_PATH:-.}" || die "path '${INPUT_PATH:-.}' does not exist"
scan_dir=$(pwd -P)

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

echo "::group::Vulnerability databases"
db_rc=0
make "${make_args[@]}" sec/db/update || db_rc=$?
echo "::endgroup::"

# One make run per scanner, so each gets its own status: a scan that fails
# must not hide the reports of the others, and the manifest has to say which
# one it was.
status_json='{}'
failed=0
for s in "${scanner_list[@]}"; do
	case $s in
		fs) target=sec/scan/trivy/fs file=trivy-fs.json extra=() ;;
		config) target=sec/scan/trivy/config file=trivy-config.json extra=() ;;
		image) target=sec/scan/trivy/img file=trivy-image.json extra=("IMAGE=$INPUT_IMAGE_REF") ;;
		semgrep) target=sec/scan/semgrep file=semgrep.json extra=() ;;
	esac
	echo "::group::Scan: $s"
	rc=0
	make "${make_args[@]}" "${extra[@]}" "$target" || rc=$?
	echo "::endgroup::"

	# A scan counts as done when it left a report its tool would recognise,
	# whatever it exited with: a trivy.yaml may set exit-code to fail on
	# findings, and that is a result, not a breakage. No report, or one that
	# is not the tool's JSON, is a failure -- the case a reader must never
	# mistake for "no findings".
	if [ "$s" = semgrep ]; then
		check='has("results")'
	else
		check='has("SchemaVersion")'
	fi
	if [ -s "$out/$file" ] && jq -e "$check" "$out/$file" >/dev/null 2>&1; then
		state=ok
	else
		state=failed
		failed=$((failed + 1))
		rm -f "$out/$file"
		echo "::error::Scanner '$s' produced no report (exit $rc)" >&2
	fi
	status_json=$(jq -c --arg s "$s" --arg state "$state" --argjson rc "$rc" --arg file "$file" \
		'.[$s] = {status: $state, exit_code: $rc, file: (if $state == "ok" then $file else null end)}' \
		<<<"$status_json")
done
for s in fs config image semgrep; do
	if ! jq -e --arg s "$s" 'has($s)' <<<"$status_json" >/dev/null; then
		status_json=$(jq -c --arg s "$s" '.[$s] = {status: "skipped", exit_code: null, file: null}' <<<"$status_json")
	fi
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

commit="" describe="" remote=""
if git -C "$scan_dir" rev-parse --git-dir >/dev/null 2>&1; then
	commit=$(git -C "$scan_dir" rev-parse HEAD 2>/dev/null || true)
	describe=$(git -C "$scan_dir" describe --tags --always --dirty 2>/dev/null || true)
	# Credentials a checkout may have embedded in the URL stay out of it.
	remote=$(git -C "$scan_dir" remote get-url origin 2>/dev/null | sed -E 's#//[^/@]*@#//#' || true)
fi

image_target=null
if [ -n "${INPUT_IMAGE_REF:-}" ]; then
	image_target=$(jq -n --arg ref "$INPUT_IMAGE_REF" \
		--arg id "$(docker image inspect "$INPUT_IMAGE_REF" --format '{{.Id}}' 2>/dev/null || true)" \
		--arg repo_digest "$(docker image inspect "$INPUT_IMAGE_REF" --format '{{if .RepoDigests}}{{index .RepoDigests 0}}{{end}}' 2>/dev/null || true)" \
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
	die "$failed scanner(s) failed; see manifest.json"
fi
