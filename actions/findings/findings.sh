#!/usr/bin/env bash
#
# Normalises the reports in a scan output directory (actions/scan, plus an
# optional trufflehog.json) into one findings.json, and, given the previous
# run's findings.json, says which findings are new and which were fixed.
#
# A finding's identity is what it is and where, not how many there are:
#   vuln     scanner | target | package | vulnerability ID
#   misconf  config  | file   | check ID
#   secret   scanner | file   | rule/detector
#   sast     semgrep | file   | rule
# Line numbers are left out on purpose: an edit above a finding moves it, and
# a moved finding is not a new one. Comparing counts instead, as the Pages
# Slack notifier does, misses one fixed and one introduced in the same run.
#
# Usage: findings.sh <scan-output-dir> [previous-findings.json]
# Writes <scan-output-dir>/findings.json and <scan-output-dir>/FINDINGS.md.

set -euo pipefail

dir=${1:?usage: findings.sh <scan-output-dir> [previous-findings.json]}
prev=${2:-}
[ -d "$dir" ] || { echo "no such directory: $dir" >&2; exit 1; }
if [ -n "$prev" ] && ! jq -e '.format_version and (.findings | type == "array")' "$prev" >/dev/null 2>&1; then
	echo "::warning::previous findings '$prev' is not a findings.json; comparing against nothing" >&2
	prev=""
fi

# Each extractor emits one JSON object per finding. Missing reports emit
# nothing; whether a scanner ran at all is the manifest's business, copied in
# below so a reader can tell "no findings" from "did not run".
trivy_vulns() { # $1 = file, $2 = scanner name
	[ -s "$1" ] || return 0
	jq -c --arg sc "$2" '
		.Results[]? | .Target as $t |
		(.Vulnerabilities[]? | {
			kind: "vuln", scanner: $sc, severity: .Severity, target: $t,
			id: .VulnerabilityID, package: .PkgName, installed: .InstalledVersion,
			fixed: (.FixedVersion // ""), title: (.Title // "")
		}),
		(.Secrets[]? | {
			kind: "secret", scanner: $sc, severity: .Severity, target: $t,
			id: .RuleID, title: (.Title // ""), line: .StartLine
		})' "$1"
}
trivy_misconf() {
	[ -s "$1" ] || return 0
	jq -c '
		.Results[]? | .Target as $t |
		.Misconfigurations[]? | select(.Status == "FAIL") | {
			kind: "misconf", scanner: "config", severity: .Severity, target: $t,
			id: .ID, title: (.Title // ""), line: (.CauseMetadata.StartLine // null)
		}' "$1"
}
semgrep() {
	[ -s "$1" ] || return 0
	# Semgrep's severities mapped onto Trivy's scale, so one threshold
	# (e.g. HIGH and above) means the same thing for every scanner.
	jq -c '
		.results[]? | {
			kind: "sast", scanner: "semgrep",
			severity: ({ERROR: "HIGH", WARNING: "MEDIUM", INFO: "LOW"}[.extra.severity] // "UNKNOWN"),
			target: .path, id: .check_id, title: ((.extra.message // "") | .[0:200]), line: .start.line
		}' "$1"
}
trufflehog() {
	[ -s "$1" ] || return 0
	# Every leaked credential is critical: there is no severity to a secret
	# that works, and one that does not is a false positive to mark, not a
	# lower priority to leave.
	jq -c '
		.findings[]? | {
			kind: "secret", scanner: "trufflehog", severity: "CRITICAL", target: .file,
			id: .detector, title: (if .verified then "Verified live credential" else "Potential credential" end),
			line: .line, commit: .commit
		}' "$1"
}

manifest=null
[ -s "$dir/manifest.json" ] && manifest=$(cat "$dir/manifest.json")

{
	trivy_vulns "$dir/trivy-fs.json" fs
	trivy_vulns "$dir/trivy-image.json" image
	trivy_misconf "$dir/trivy-config.json"
	semgrep "$dir/semgrep.json"
	trufflehog "$dir/trufflehog.json"
} | jq -s \
	--argjson manifest "$manifest" \
	--slurpfile prev <(if [ -n "$prev" ]; then cat "$prev"; else echo null; fi) '
	def rank: {CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1}[.] // 0;
	def key: [.kind, .scanner, .target, (.package // ""), .id] | join("|");
	def counts: reduce .[] as $f ({CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0};
		.[($f.severity // "UNKNOWN") | if rank > 0 then . else "UNKNOWN" end] += 1);

	# The same package can be reported once per lockfile line; one identity
	# is one finding.
	(map(. + {key: key}) | unique_by(.key) | sort_by(-(.severity | rank), .key)) as $all |
	($prev[0]) as $p |
	(if $p == null then null else ($p.findings | map(.key)) end) as $prev_keys |
	($all | map(.key)) as $keys |
	{
		format_version: "1",
		generated_at: (now | todate),
		scan: (if $manifest == null then null else {
			commit: $manifest.target.git.commit,
			describe: $manifest.target.git.describe,
			run_url: $manifest.run.url,
			finished_at: $manifest.run.finished_at,
			toolkit_release: $manifest.toolkit.release,
			config_files: $manifest.target.config_files,
			scanners: ($manifest.scanners | map_values(.status))
		} end),
		counts: ($all | counts),
		findings: $all,
		comparison: (if $prev_keys == null then null else
			($all | map(select(.key as $k | $prev_keys | index($k) | not))) as $new |
			($p.findings | map(select(.key as $k | $keys | index($k) | not))) as $fixed |
			{
				previous: ($p.scan // null | if . == null then null else {commit, describe, run_url, finished_at} end),
				new: $new, fixed: $fixed,
				new_counts: ($new | counts), fixed_counts: ($fixed | counts)
			} end)
	}' >"$dir/findings.json"

# A Markdown summary for the job summary and the release body. Every value is
# from scanned content (file names, titles), so table metacharacters are
# escaped; GitHub sanitises HTML in both places, but a | still breaks a table.
jq -r '
	def md: tostring | gsub("(?<c>[|`<>\\[\\]*_])"; "\\\(.c)");
	def row: "| \(.severity) | \(.kind) | \(.id | md) | \((.package // "") | md) | \(.target | md) | \((.fixed // "") | md) |";
	def table($rows; $max):
		if ($rows | length) == 0 then "_None._\n" else
		"| Severity | Kind | ID | Package | Where | Fixed in |\n|---|---|---|---|---|---|\n" +
		($rows[:$max] | map(row) | join("\n")) +
		(if ($rows | length) > $max then "\n\n…and \(($rows | length) - $max) more in findings.json." else "" end) + "\n" end;
	def countline: "🔴 CRITICAL \(.CRITICAL) · 🟠 HIGH \(.HIGH) · 🟡 MEDIUM \(.MEDIUM) · 🔵 LOW \(.LOW)";

	"## 🔍 Security scan findings\n",
	(if .scan then
		"Commit `\(.scan.describe // .scan.commit // "?" | md)` · toolkit `\(.scan.toolkit_release // "?" | md)` · scanners: " +
		(.scan.scanners | to_entries | map("\(.key) \(if .value == "ok" then "✅" elif .value == "skipped" then "–" else "❌ \(.value)" end)") | join(", ")) + "\n"
	else "" end),
	"**Total:** \(.counts | countline)\n",
	(if .comparison then
		"### Since the previous scan\n",
		"**New:** \(.comparison.new_counts | countline)  \n**Fixed:** \(.comparison.fixed_counts | countline)\n",
		"#### New HIGH/CRITICAL\n", table([.comparison.new[] | select(.severity == "CRITICAL" or .severity == "HIGH")]; 30)
	else "_No previous scan to compare with._\n" end),
	"### All HIGH/CRITICAL\n", table([.findings[] | select(.severity == "CRITICAL" or .severity == "HIGH")]; 50)
' "$dir/findings.json" >"$dir/FINDINGS.md"

jq -r '"findings: \(.counts | to_entries | map("\(.key)=\(.value)") | join(" "))" +
	(if .comparison then "; new: \(.comparison.new | length), fixed: \(.comparison.fixed | length)" else "" end)' "$dir/findings.json" >&2
