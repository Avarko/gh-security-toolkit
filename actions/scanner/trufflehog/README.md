# TruffleHog Scanner Action

Lightweight wrapper for [TruffleHog](https://github.com/trufflesecurity/trufflehog) to scan Git repositories for leaked credentials and secrets.

Perfect for:
- 🔍 Pull Request checks
- 🪝 Pre-commit hooks
- 🚀 CI/CD pipelines
- 📊 Security audits

## Features

- ✅ **Zero configuration** - Works out of the box
- 🎯 **Auto-detection** - Automatically detects Git repos vs filesystems
- 📈 **Incremental scans** - Scan only new commits in PRs
- 🔐 **Verified secrets** - Filter to show only confirmed credentials
- 📊 **Summary output** - Clean GitHub Actions summary with findings count

## Quick Start

### Pull Request Check

Scan only the changes in a PR:

```yaml
name: Secret Scan
on: pull_request

jobs:
  secrets:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history for base comparison
      
      - name: Scan for secrets
        uses: Avarko/gh-security-toolkit/actions/scanner/trufflehog@main
        with:
          base: ${{ github.event.pull_request.base.sha }}
          head: ${{ github.event.pull_request.head.sha }}
```

### Commit Push Check

Scan changes in a push:

```yaml
name: Secret Scan
on: push

jobs:
  secrets:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: Scan for secrets
        uses: Avarko/gh-security-toolkit/actions/scanner/trufflehog@main
        with:
          base: ${{ github.event.before }}
          head: ${{ github.event.after }}
```

### Full Repository Scan

Scan entire Git history:

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0  # Required for full history

- uses: Avarko/gh-security-toolkit/actions/scanner/trufflehog@main
  # No base/head specified = full history scan
```

### Filesystem-Only Scan

Scan current files without Git history:

```yaml
- uses: actions/checkout@v4
  # No fetch-depth needed

- uses: Avarko/gh-security-toolkit/actions/scanner/trufflehog@main
  with:
    scan_type: filesystem
```

## Inputs

| Input | Description | Default | Required |
|-------|-------------|---------|----------|
| `path` | Path to repository/directory | `.` | No |
| `base` | Base commit/branch for incremental scan | `""` | No |
| `head` | Head commit/branch to scan to | `HEAD` | No |
| `scan_type` | `git`, `filesystem`, or `auto` | `auto` | No |
| `only_verified` | Only show verified secrets | `false` | No |
| `fail_on_findings` | Fail workflow if secrets found | `true` | No |
| `extra_args` | Additional TruffleHog CLI arguments | `""` | No |

## Outputs

| Output | Description |
|--------|-------------|
| `findings_count` | Number of secrets found |
| `has_verified` | Whether verified secrets were found (`true`/`false`) |

## Examples

### Only Fail on Verified Secrets

```yaml
- uses: Avarko/gh-security-toolkit/actions/scanner/trufflehog@main
  with:
    only_verified: true
    fail_on_findings: true
```

### Warning Mode (Don't Fail)

```yaml
- uses: Avarko/gh-security-toolkit/actions/scanner/trufflehog@main
  with:
    fail_on_findings: false
```

### Custom TruffleHog Arguments

```yaml
- uses: Avarko/gh-security-toolkit/actions/scanner/trufflehog@main
  with:
    extra_args: --no-update --concurrency=4
```

### Use Outputs

```yaml
- name: Scan for secrets
  id: scan
  uses: Avarko/gh-security-toolkit/actions/scanner/trufflehog@main
  with:
    fail_on_findings: false

- name: Check results
  run: |
    echo "Found ${{ steps.scan.outputs.findings_count }} secrets"
    if [ "${{ steps.scan.outputs.has_verified }}" = "true" ]; then
      echo "⚠️ Verified secrets detected!"
    fi
```

## Pre-commit Hook

Use TruffleHog locally with [pre-commit](https://pre-commit.com/):

### 1. Install pre-commit

```bash
pip install pre-commit
```

### 2. Create `.pre-commit-config.yaml`

```yaml
repos:
  - repo: https://github.com/trufflesecurity/trufflehog
    rev: v3.63.2
    hooks:
      - id: trufflehog
        name: TruffleHog
        description: Detect secrets in your data
        entry: bash -c 'trufflehog git file://. --since-commit HEAD --only-verified --fail --json'
        language: golang
        pass_filenames: false
```

### 3. Install the hook

```bash
pre-commit install
```

Now TruffleHog runs on every commit!

## Advanced Usage

### Scan Specific Branch

```yaml
- uses: Avarko/gh-security-toolkit/actions/scanner/trufflehog@main
  with:
    base: origin/main
    head: origin/develop
```

### Scan Last N Commits

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 10

- uses: Avarko/gh-security-toolkit/actions/scanner/trufflehog@main
  with:
    base: HEAD~10
    head: HEAD
```

### Multi-directory Scan

```yaml
- uses: Avarko/gh-security-toolkit/actions/scanner/trufflehog@main
  with:
    path: ./frontend

- uses: Avarko/gh-security-toolkit/actions/scanner/trufflehog@main
  with:
    path: ./backend
```

## How It Works

1. **Auto-detection**: Detects if scanning a Git repo or filesystem
2. **Incremental**: If `base` provided, scans only commits between base and head
3. **TruffleHog CLI**: Runs native TruffleHog with JSON output
4. **Parse Results**: Counts findings and checks for verified secrets
5. **Summary**: Creates GitHub Actions summary with results
6. **Exit Code**: Fails workflow if secrets found (configurable)

## Comparison: This vs Official TruffleHog Action

| Feature | This Action | Official Action |
|---------|-------------|-----------------|
| **Configuration** | Minimal | More options |
| **Incremental scans** | ✅ Easy (base/head) | ⚠️ Manual |
| **Filesystem scans** | ✅ Yes | ❌ Git only |
| **Auto-detection** | ✅ Yes | ❌ No |
| **Summary output** | ✅ Clean format | ⚠️ Raw output |
| **Outputs** | ✅ findings_count, has_verified | ❌ No outputs |
| **Use case** | PR checks, pre-commit | Full scans |

## Troubleshooting

### "No secrets found" but I know there are secrets

Try full history scan:

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0  # Important!

- uses: Avarko/gh-security-toolkit/actions/scanner/trufflehog@main
```

### Scan takes too long

Use incremental scan for PRs:

```yaml
with:
  base: ${{ github.event.pull_request.base.sha }}
```

### False positives

Use verified-only mode:

```yaml
with:
  only_verified: true
```

## License

MIT License — feel free to fork, extend, and reuse.
