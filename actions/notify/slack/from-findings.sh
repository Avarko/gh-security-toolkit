#!/usr/bin/env bash
#
# Sends a Slack message for the new findings in a findings.json (written by
# actions/findings), when any reach the notify_on threshold. Unlike the
# scan-history path of this action, it needs no GitHub Pages artifact, so it
# works on every GitHub plan.
#
# Environment: FINDINGS, NOTIFY_ON, SLACK_WEBHOOK_URL | SLACK_BOT_TOKEN +
# SLACK_CHANNEL, GITHUB_* (repository, run), GITHUB_OUTPUT.

set -euo pipefail

[ -s "${FINDINGS:-}" ] || { echo "::error::findings '${FINDINGS:-}' does not exist"; exit 1; }

case "${NOTIFY_ON:-critical_only}" in
	critical_only) threshold=4 ;;
	high_and_critical) threshold=3 ;;
	all) threshold=1 ;;
	*) echo "::error::notify_on must be critical_only, high_and_critical or all"; exit 1 ;;
esac

out=${GITHUB_OUTPUT:-/dev/null}

if [ "$(jq '.comparison == null' "$FINDINGS")" = true ]; then
	echo "No previous scan to compare with; not notifying (the first scan sets the baseline)"
	echo "has_changes=false" >>"$out"
	exit 0
fi

new=$(jq -c --argjson t "$threshold" '
	def rank: {CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1}[.] // 0;
	[.comparison.new[] | select((.severity | rank) >= $t)]' "$FINDINGS")
n=$(jq 'length' <<<"$new")
echo "has_changes=$([ "$n" -gt 0 ] && echo true || echo false)" >>"$out"
echo "comparison=$(jq -c '{new_counts: .comparison.new_counts, fixed_counts: .comparison.fixed_counts}' "$FINDINGS")" >>"$out"

if [ "$n" -eq 0 ]; then
	echo "No new findings at the notify_on threshold (${NOTIFY_ON:-critical_only}); not notifying"
	exit 0
fi

repo=${GITHUB_REPOSITORY:-unknown}
server=${GITHUB_SERVER_URL:-https://github.com}
run_url="$server/$repo/actions/runs/${GITHUB_RUN_ID:-0}"

# Slack mrkdwn treats < > & as markup (<url|text> is a link, <!channel> a
# ping), and file names and titles come from the scanned repository. They
# are escaped as Slack documents, and * _ ~ ` are neutralised so a crafted
# name cannot restyle or fake parts of the message.
text=$(jq -r --argjson new "$new" --arg repo "$repo" --arg run "$run_url" --arg ref "${GITHUB_REF_NAME:-}" '
	def esc: tostring | gsub("&"; "&amp;") | gsub("<"; "&lt;") | gsub(">"; "&gt;") | gsub("[*_~`]"; "ʼ");
	def emoji: {CRITICAL: "🔴", HIGH: "🟠", MEDIUM: "🟡", LOW: "🔵"}[.] // "⚪";
	def counts: "🔴 \(.CRITICAL) · 🟠 \(.HIGH) · 🟡 \(.MEDIUM) · 🔵 \(.LOW)";
	"*🚨 \($new | length) new security finding(s) in \($repo | esc)*" + (if $ref != "" then " (\($ref | esc))" else "" end) + "\n\n" +
	($new[:15] | map("\(.severity | emoji) *\(.severity)* `\(.id | esc)`" +
		(if .package then " in `\(.package | esc)` \(.installed // "" | esc)" else "" end) +
		" — \(.target | esc)" +
		(if (.fixed // "") != "" then " _(fixed in \(.fixed | esc))_" else "" end)) | join("\n")) +
	(if ($new | length) > 15 then "\n…and \(($new | length) - 15) more" else "" end) +
	"\n\n*Since previous scan:* new \(.comparison.new_counts | counts) | fixed \(.comparison.fixed_counts | counts)" +
	"\n*Total open:* \(.counts | counts)" +
	"\n<\($run)|View the scan run>"' "$FINDINGS")

payload=$(jq -n --arg text "$text" --arg channel "${SLACK_CHANNEL:-}" '
	{text: $text, unfurl_links: false, unfurl_media: false} + (if $channel != "" then {channel: $channel} else {} end)')

# The webhook URL and token are secrets: passed to curl through a config on
# stdin, not on its command line where they would show in the process list.
if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
	resp=$(printf 'url = "%s"\n' "$SLACK_WEBHOOK_URL" |
		curl -sS --fail-with-body --max-time 30 -K - -H 'Content-Type: application/json' --data-binary "$payload") \
		|| { echo "::error::Slack webhook call failed: $resp"; exit 1; }
elif [ -n "${SLACK_BOT_TOKEN:-}" ] && [ -n "${SLACK_CHANNEL:-}" ]; then
	resp=$(printf 'header = "Authorization: Bearer %s"\n' "$SLACK_BOT_TOKEN" |
		curl -sS --fail-with-body --max-time 30 -K - -H 'Content-Type: application/json; charset=utf-8' \
			--data-binary "$payload" https://slack.com/api/chat.postMessage) \
		|| { echo "::error::Slack API call failed"; exit 1; }
	[ "$(jq -r '.ok' <<<"$resp" 2>/dev/null)" = true ] \
		|| { echo "::error::Slack API error: $(jq -r '.error // "unknown"' <<<"$resp" 2>/dev/null)"; exit 1; }
else
	echo "::warning::$n new finding(s) to report, but neither slack_webhook_url nor slack_bot_token + slack_channel is set"
	exit 0
fi
echo "✅ Slack notified of $n new finding(s)"
