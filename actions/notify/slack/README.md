# Slack Notification Action

Compares security scan results with the previous run and sends Slack notifications when vulnerability counts change.

## Features

- ✅ Compares Trivy Critical/High/Medium vulnerability counts
- ✅ Compares Semgrep Error/Warning counts
- ✅ Supports Slack Webhook URL or Bot Token
- ✅ Configurable notification filters (critical_only, high_and_critical, all)
- ✅ Markdown-formatted messages with emojis

## Usage

### Without GitHub Pages (any GitHub plan)

Give it the `findings.json` from `actions/findings`. It notifies when there
are **new** findings at the `notify_on` threshold -- compared finding by
finding, so one CVE fixed and another introduced in the same run is still
reported. The previous scan is read from the channel's latest GitHub Release,
so publish each scan with `actions/publisher/github-release`.

```yaml
- id: findings
  uses: Avarko/gh-security-toolkit/actions/findings@v2
  with:
    scan-dir: ${{ steps.scan.outputs.output-dir }}
    channel: nightly-master

- uses: Avarko/gh-security-toolkit/actions/notify/slack@v2
  with:
    findings: ${{ steps.findings.outputs.findings }}
    slack_webhook_url: ${{ secrets.SLACK_WEBHOOK_URL }}
    notify_on: high_and_critical
```

The first scan of a channel sets the baseline and sends nothing.

### With GitHub Pages scan history

The original mode, used when `findings` is not set: it compares severity
counts with the previous entry in the Pages scan-history artifact, so it
needs `publish_to: github-pages` (Private Pages, GitHub Enterprise Cloud).

### Basic Example

```yaml
- name: Run security scan
  id: scan
  uses: Avarko/gh-security-toolkit/actions/security-scan@v2
  with:
    channel: push-to-main

- name: Notify Slack on changes
  if: always()
  uses: Avarko/gh-security-toolkit/actions/notify/slack@v2
  with:
    channel: push-to-main
    timestamp: ${{ steps.scan.outputs.timestamp }}
    slack_webhook_url: ${{ secrets.SLACK_WEBHOOK_URL }}
    github_token: ${{ github.token }}
    notify_on: critical_only
```

### With Bot Token (instead of Webhook)

```yaml
- name: Notify Slack on changes
  uses: Avarko/gh-security-toolkit/actions/notify/slack@v2
  with:
    channel: push-to-main
    timestamp: ${{ steps.scan.outputs.timestamp }}
    slack_bot_token: ${{ secrets.SLACK_BOT_TOKEN }}
    slack_channel: '#security-alerts'
    github_token: ${{ github.token }}
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `channel` | Pages mode | `''` | Scan channel name (e.g., `push-to-main`) |
| `findings` | ❌ | `''` | Path to `findings.json`; selects the no-Pages mode |
| `timestamp` | Pages mode | `''` | Scan timestamp (`YYYYMMDD-HHMMSS`) |
| `slack_webhook_url` | ⚠️ | `''` | Slack webhook URL (required if not using bot token) |
| `slack_bot_token` | ⚠️ | `''` | Slack bot OAuth token (alternative to webhook) |
| `slack_channel` | ⚠️ | `''` | Slack channel ID (required with bot token) |
| `github_token` | ❌ | `github.token` | GitHub token for artifact access (Pages mode) |
| `notify_on` | ❌ | `critical_only` | When to notify: `all`, `critical_only`, `high_and_critical` |

**Note:** Either `slack_webhook_url` OR (`slack_bot_token` + `slack_channel`) must be provided.

## Outputs

| Output | Description |
|--------|-------------|
| `has_changes` | Whether changes were detected (`true`/`false`) |
| `comparison_json` | Full comparison result as JSON |

## Notification Filters

### `critical_only` (default)
Only notifies when CRITICAL vulnerability count changes.

### `high_and_critical`
Notifies when CRITICAL or HIGH vulnerability count changes.

### `all`
Notifies on any change (CRITICAL, HIGH, MEDIUM, Semgrep errors/warnings).

## Example Slack Message

```
🔍 *Security Scan Alert: push-to-main*

*📊 Vulnerability Changes:*
  • 📈 🔴 CRITICAL: 1 → 2 (+1)
  • 📉 🟠 HIGH: 5 → 3 (-2)

*🐛 Semgrep Changes:*
  • 📈 ❌ ERRORS: 0 → 1 (+1)

_Repository: Avarko/gh-security-toolkit_
_Commit: 283c51c | Branch: main_

📅 Current: 2025-11-27 10:30:00
📅 Previous: 2025-11-26 15:30:00
```

## Setup

### Option 1: Slack Incoming Webhook (Recommended)

1. Go to https://api.slack.com/apps
2. Create new app → From scratch
3. Enable "Incoming Webhooks"
4. Add webhook to workspace and select channel
5. Copy webhook URL
6. Add to GitHub Secrets as `SLACK_WEBHOOK_URL`

### Option 2: Slack Bot Token

1. Go to https://api.slack.com/apps
2. Create new app → From scratch
3. Add bot token scopes: `chat:write`, `users:read.email`
4. Install app to workspace
5. Copy bot token (starts with `xoxb-`)
6. Add to GitHub Secrets as `SLACK_BOT_TOKEN`

## How It Works

1. **Downloads scan history** from GitHub artifacts
2. **Compares current scan** with previous scan in same channel
3. **Filters changes** based on `notify_on` setting
4. **Sends Slack notification** if matching changes found

## No Previous Scan

If this is the first scan for a channel, or no scan history exists:
- `has_changes` will be `false`
- No notification is sent
- Summary shows: "First scan for this channel, no comparison available"

## Troubleshooting

### No notification sent

Check:
1. Does scan history artifact exist? (First run won't have it)
2. Are there actual changes in vulnerability counts?
3. Do changes match the `notify_on` filter?
4. Is `SLACK_WEBHOOK_URL` or `SLACK_BOT_TOKEN` set correctly?

### "No scan history artifact found"

This is normal for the first run. The artifact is created after the first scan completes.

### Check comparison output

Add this step to debug:

```yaml
- name: Debug comparison
  if: always()
  run: |
    echo '${{ steps.notify.outputs.comparison_json }}' | jq .
```
