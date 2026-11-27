# TruffleHog scanner action

Scans a Git repository or a directory for leaked credentials with
[TruffleHog](https://github.com/trufflesecurity/trufflehog), run from the
toolkit's scanner image (the one `actions/scan` pins by digest, so the
TruffleHog version is the one the release was tested with).

- **Secret values never reach the log.** The action writes `trufflehog.json`
  with detector, file, line and commit only, and prints the same. The raw
  TruffleHog output, which carries every secret in full, is deleted before
  the step ends.
- **Unverified findings are reported by default.** A hardcoded database
  password has nothing to verify against, so `--results=verified,unknown`
  (this action's old default) silently dropped exactly that kind of leak.
- **No verification by default.** Verifying sends each candidate secret to
  its provider's API. Opt in with `verify: true` if that is acceptable; the
  container then gets network access, otherwise it runs with none.

## Pull request check (recommended)

Scans only the commits the pull request adds:

```yaml
name: Secret scan
on: pull_request

permissions:
  contents: read

jobs:
  secrets:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1  # v7.0.1
        with:
          fetch-depth: 0          # the base commit must be in the clone
          persist-credentials: false

      - uses: Avarko/gh-security-toolkit/actions/scanner/trufflehog@v2
        with:
          base: ${{ github.event.pull_request.base.sha }}
          head: ${{ github.event.pull_request.head.sha }}
```

For pushes use `base: ${{ github.event.before }}`; a push that creates a
branch (`before` is all zeros) scans the full history instead.

## Full history audit

```yaml
- uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1  # v7.0.1
  with:
    fetch-depth: 0
- uses: Avarko/gh-security-toolkit/actions/scanner/trufflehog@v2
  with:
    fail_on_findings: false   # report, don't block, while triaging the backlog
```

A secret found in history stays in every clone and fork even after the file
is fixed: **rotate it**. Rewriting history does not undo the exposure.

## With actions/scan and actions/findings

Write the report into the scan's output directory and `actions/findings`
includes it (every TruffleHog finding counts as CRITICAL):

```yaml
- id: scan
  uses: Avarko/gh-security-toolkit/actions/scan@v2
- uses: Avarko/gh-security-toolkit/actions/scanner/trufflehog@v2
  with:
    scan_type: filesystem
    fail_on_findings: false
    output_dir: ${{ steps.scan.outputs.output-dir }}
- uses: Avarko/gh-security-toolkit/actions/findings@v2
  with:
    scan-dir: ${{ steps.scan.outputs.output-dir }}
```

## Inputs

| Input | Default | Description |
|---|---|---|
| `path` | `.` | Repository or directory to scan |
| `base` | | Scan commits after this one (SHA or ref); empty = full history |
| `head` | `HEAD` | Scan up to this commit |
| `scan_type` | `auto` | `git`, `filesystem`, or `auto` (git when `path` is a repository root) |
| `results` | `verified,unverified,unknown` | Which results to report |
| `verify` | `false` | Verify candidates against provider APIs (sends them off the runner) |
| `exclude_paths_file` | `.trufflehogignore` | Regexes, one per line, against repository-relative paths |
| `fail_on_findings` | `true` | Fail the step when anything is reported |
| `output_dir` | `$RUNNER_TEMP/trufflehog` | Where `trufflehog.json` is written |

## Outputs

| Output | Description |
|---|---|
| `findings_count` | Number of findings |
| `has_verified` | `true` if any finding was verified live |
| `report` | Path to `trufflehog.json` (no secret values) |

## False positives

Two ways, both reviewed in pull requests like any other change:

```text
# .trufflehogignore -- regexes against repository-relative paths
# Local development database only; not used in any deployed environment.
^postgres/Dockerfile$
```

```yaml
url: jdbc:postgresql://bus-postgres:5432/postgres  # trufflehog:ignore
```

Prefer the inline comment: it ignores one line, while a path ignores
everything that file will ever contain. `.git/` is always excluded from
filesystem scans (it is the history, which the git mode scans).

## Pre-commit hook

A hook catches a secret before it is in a commit at all, which is the only
point where no rotation is needed. It is a convenience, not the control:
hooks are installed per clone and skipped with `--no-verify`, so the pull
request check above is what enforces it.

With [pre-commit](https://pre-commit.com/), using TruffleHog's own hook
definition:

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/trufflesecurity/trufflehog
    rev: v3.99.9   # keep equal to the scanner image's TruffleHog (actions/scan/image.ref)
    hooks:
      - id: trufflehog
        # The upstream hook reports only verified secrets, which misses
        # passwords and other credentials that cannot be verified, and
        # verification sends staged secrets to provider APIs. This scans the
        # staged changes for everything, offline.
        entry: trufflehog git file://. --since-commit HEAD --results=verified,unverified,unknown --no-verification --no-update --fail --trust-local-git-config
```

```bash
pip install pre-commit   # or: brew install pre-commit
pre-commit install
```

`--since-commit HEAD` scans what is staged, not only committed history; it
honours `# trufflehog:ignore` comments. `language: golang` (from the upstream
definition) builds TruffleHog on first use, which needs Go; with TruffleHog
already installed, `language: system` in a `repo: local` hook avoids that.
