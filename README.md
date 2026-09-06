# gh-security-toolkit

**Security scanning and reporting toolkit for GitHub Actions CI/CD and Makefile integration for local "shift left" scans during development.**

Provides reusable GitHub Actions composite actions and Makefile integration for vulnerability scanning, misconfiguration detection, and security reporting with flexible publishing options (GitHub Releases and/or GitHub Pages).

---

## Table of contents

- [Overview](#overview)
- [Quick start](#quick-start)
- [Use cases](#use-cases)
- [Architecture](#architecture)
- [Components](#components)
- [GitHub Pages features](#github-pages-features)
- [Configuration](#configuration)
- [Security considerations](#security-considerations)
- [Advanced topics](#advanced-topics)
- [Local development](#local-development)
- [Examples](#examples)

---

## Overview

`gh-security-toolkit` is a modular security scanning solution that integrates multiple industry-standard tools into unified composite actions. Results are published as GitHub Releases with retention policies or as interactive HTML reports on GitHub Pages.

**Key features:**
- **Multi-scanner support**: currently Trivy (filesystem + Docker images) and Semgrep Community Edition
- **Dual publishing for CI/CD scans**: GitHub Releases (with automatic cleanup) or GitHub Pages (with scan history) with automatic cleanup/retention
- **Channel-based organization**: Separate CI/CD scan histories per environment (nightly, PR, manual, etc.)
- **Composite actions**: Run scans in the same job as your build - no artifact upload/download overhead
- **Local scans during development** via easy Makefile integration

---

## Quick start

### Manual scans during local development

1. Add the following include code in your project's Makefile:

```makefile
# Avarko/gh-security-toolkit security scanner Makefile inclusion
__GHST_VERSION ?= main
__GHST_DIR := .gh-security-toolkit
__GHST_MAKEFILE := $(__GHST_DIR)/Makefile.scanners
__GHST_URL := https://raw.githubusercontent.com/Avarko/gh-security-toolkit/$(__GHST_VERSION)/Makefile.scanners

$(__GHST_MAKEFILE):
	@echo "Fetching gh-security-toolkit ($(__GHST_VERSION))..."
	@mkdir -p $(__GHST_DIR)
	@curl -fsSL "$(__GHST_URL)" -o $(__GHST_MAKEFILE).tmp || { \
		echo "Could not fetch $(__GHST_URL)"; \
		rm -f $(__GHST_MAKEFILE).tmp; \
		exit 1; \
	}
	@mv $(__GHST_MAKEFILE).tmp $(__GHST_MAKEFILE)

-include $(__GHST_MAKEFILE)

.PHONY: sec/update
sec/update: ## Re-fetch the security toolkit makefile
	@rm -f $(__GHST_MAKEFILE)
	@$(MAKE) --no-print-directory $(__GHST_MAKEFILE)
	@echo "✅ Toolkit updated"
```

2. Then simply start scanning:

```bash
make sec/scan/help  # Show all commands
make sec/scan       # Perform full scan
```

3. To scan a Docker image and hand the result to an LLM agent for triage, write the scan to a file instead of letting it print to the terminal:

```bash
make sec/scan/trivy/img IMAGE=my-app:local > scan-results.json
```

Then ask the agent to work through it, e.g.:

> Go through `scan-results.json` and list every CRITICAL and HIGH CVE. For each one, find the fixed version — check the actual current release of the affected library (its releases page, changelog, or package registry) rather than relying on your own memory of version numbers, since that can be outdated. Then tell me which upgrades are safe to apply now and which have dependency conflicts.

The bundled `.trivy.yaml`/`.trivyignore` in the repo root apply automatically, so a re-run after upgrading only shows what is genuinely still open.

### What produced a scan

Every Trivy scan begins by saying what it ran:

```
==> gh-security-toolkit: image 'main' published 2026-09-04 (newest as of 3 h ago), digest sha256:38a4dce76a2a, revision 2b8427fa9c17
==> trivy-incremental-dbs: main 2026-09-06, java 2026-09-06, newest as of 3 h ago, helper helper-v1.1.0
🔍 Scanning image my-app:local (offline mode)...
```

One line per source, named by the repository it comes from. The first is the
scanner: which image tag, when it was published, the digest it resolved to and
the commit behind it. The second is the data: which version of each
vulnerability database the scan will match against and which helper assembled
it.

Each carries a date as well as an identifier. The date is what a reader can
judge at a glance — a database from last week explains a finding that appeared
overnight — while the digest and version are what they need when the run has to
be reproduced exactly.

And each says whether it is the newest available, which is the question a date
alone leaves open. Both halves already asked it daily and discarded the answer:
the image pull knows whether it downloaded anything, and the database update
resolves against the published manifest. Freshness is a property of a check
rather than of an artifact, so the report says when the question was last asked
as well as what came back — `registry unreachable 2 days ago` is the case worth
having, because before this an image could be arbitrarily old with nothing
having failed and nothing having said so.

Both go to stderr, so neither lands in a report redirected to a file.

`sec/scan/semgrep` prints neither, and `sec/scan` therefore reports provenance
for the Trivy half of its work only. Semgrep matches rules shipped inside the
image rather than a vulnerability database, so the second line would have
nothing true to say — and printing it would mean downloading a database the
scan never reads.

This matters because a tag is not an answer. `main` moves, and two developers
scanning the same code on the same day can get different findings with nothing
in the output to explain it.

`make sec/provenance` prints the same in full, including the tool versions
inside the image and the database cache in detail, without running a scan.

Two things are worth knowing about the pin:

- Pinning the include to a release tag pins the scan commands, not the scanner.
  Only a `main` image is published, so the image can change under a fixed
  include. When the two differ, every scan says so.
- An image published before provenance labelling reports its tool versions as
  `unknown`. Pull it again once a labelled image exists.

#### The third source: this file

The image and the database keep themselves current. `Makefile.scanners` does
not, and that is easy to miss. The include rule above fetches it once into
`.gh-security-toolkit/` and has no prerequisites, so Make never refetches it: a
repository set up in March is still running March's scan commands today, and
moving the `v1` tag does nothing for it. A moved tag only reaches a machine
that fetches again.

It fixes itself now, without ever rewriting itself behind your back. Once a
day it fetches what is published at the version you pinned and compares the
two files. When they differ it says so, and it marks itself out of date -- which
makes Make re-fetch it through the include rule your own Makefile already has,
before the next scan starts, restarting with the new file in the same command.
The scan that discovers the update still runs on the old file; the one after it
does not.

While it is out of date, every scan says so:

```
    note: these scan commands are not the ones published at 'v1'
          (checked 4 min ago). The image and database update themselves;
          this file is fetched once. Run 'make sec/update'.
```

Content, not version — pinning to a moving tag means the version string is
identical on both sides while the file behind it has changed.

#### Air-gapped and offline use

`GHST_OFFLINE=1` makes every scan work as well as it can without a network,
which means fewer checks and less metadata rather than guesses. No image pull,
no database update, no comparison of this file against the published one. The
banner reports the checks it did not make as not made:

```
==> gh-security-toolkit: image 'main' published 2026-09-04 (not checked, GHST_OFFLINE=1), digest ...
==> trivy-incremental-dbs: main 2026-09-06, java 2026-09-06, not checked 2 min ago, offline (last confirmed newest 4 days ago), helper helper-v1.1.0
```

Everything that can be answered from what is already on the machine still is —
versions, digests, the commit behind the image, how old the database is. The
one thing that changes is that nothing claims to have looked.

### What keeps itself current

Publishing a new version of the toolkit should not require asking anybody to
run anything. Every part of what a scan uses refreshes on its own, and the
parts that cannot reach the network refuse rather than quietly scanning with
old data.

| Artefact | Where it lives | How it refreshes | If it cannot |
| --- | --- | --- | --- |
| `Makefile.scanners` | `.gh-security-toolkit/` in your repository | Compared against the published file once a day during a scan. When a newer one exists, the next scan re-fetches it through your own include rule and Make restarts with it. | Scan refuses once nothing has confirmed it for `__GHST_MAX_STALE_DAYS` (14), unless the host has no `cmp` or no `curl` and so could never have compared them. |
| Scanner image | Docker | `docker pull` when the last check is more than `__GHST_IMAGE_MAX_AGE_DAYS` (1) old. The image it replaces is removed if nothing else tags it. | Scan refuses once nothing has confirmed it for `__GHST_MAX_STALE_DAYS` (14). |
| Trivy databases | `~/.cache/gh-security-toolkit/trivy-db` | The helper updates them incrementally, applying deltas rather than re-downloading. | Scan refuses at `__GHST_DB_MAX_AGE_DAYS` (14). |
| Containers | Docker | Nothing to refresh: every run is `--rm`, so none are kept. | — |
| `semgrep/semgrep:latest` | Docker | **Nothing pulls it.** Docker runs whatever was cached the first time, for as long as that image exists. | Not covered. |

`GHST_OFFLINE=1` turns all of it off, including the refusals — an air-gapped
machine is not a broken one. That is the intended way to run without a
network, and the reason the refusals name it.

The one exemption is deliberate. "We asked and got no answer" and "we have no
way to ask" are different, and only the first is worth refusing over: a host
missing `cmp` or `curl` would otherwise be told, a fortnight later, to fix a
network that was never the problem. The scanner image is still enforced there,
since pulling it needs neither.

The last row is a real gap rather than an oversight: pinning Semgrep would
change what its scans report, so it is left to be decided on its own.

### Ignore CVEs

Not everything can be fixed immediately. A common case: a CVE is already patched upstream in a library, but the version that fixes it can't be adopted yet — for example, Spring Boot pins a transitive dependency's version and overriding it breaks compatibility elsewhere, so the fix isn't actually installable until Spring Boot itself moves. In situations like this, the finding needs to be ignored for now rather than left blocking every scan.

Add a `.trivyignore` file at the repository root:

```
# .trivyignore

# Fixed in jackson-databind 2.17.2, but spring-boot-starter-parent 3.2.x
# pins jackson to 2.16.x; overriding it individually breaks Boot's own
# dependency management. Revisit once we're on Boot 3.3+.
# Tracked in JIRA-4821.
CVE-2023-35116 exp:2026-12-31

# No fix available yet upstream. Re-check on the next scan.
CVE-2024-1234 exp:2026-10-01
```

See [Ignoring findings (`.trivyignore`)](#ignoring-findings-.trivyignore) below for the full syntax, including per-path/per-package ignores via `.trivyignore.yaml`.

### GitHub Actions CI/CD

The security scan runs as a composite action in the same job as your build. No artifact uploads needed - just pass the filesystem path and/or Docker image reference directly.

**Step 1: Create client configuration** (optional but recommended):

```yaml
# .gh-security-toolkit/config.yaml
version: "1"

organization:
  display_name: "My Company"
  logo_url: "https://example.com/logo.svg"

repository:
  display_name: "My Application"

scanning:
  trivy:
    severity: "MEDIUM,HIGH,CRITICAL"
  semgrep:
    configs:
      - "p/owasp-top-ten"
      - "p/java"

publishing:
  retention_keep: 20
```

**Step 2: Add workflow**:

```yaml
name: Build and Scan
on: [push]

jobs:
  build-and-scan:
    runs-on: ubuntu-latest
    permissions:
      contents: write       # Required for creating releases and tags
      id-token: write       # Required for OIDC authentication (GitHub Pages)
      pages: write          # Required for deploying to GitHub Pages
      actions: read         # Required for artifact management

    steps:
      - uses: actions/checkout@v4

      - name: Build application
        run: |
          # Your build steps here
          ./build.sh

      - name: Build Docker image
        run: |
          docker build -t myapp:${{ github.sha }} .

      # Run security scan - everything in the same job!
      # Config from .gh-security-toolkit/config.yaml is automatically loaded
      - name: Security scan
        uses: Avarko/gh-security-toolkit/actions/security-scan@main
        with:
          channel: nightly-master
          filesystem_paths: .                       # Scan the checkout directory
          docker_image_ref: myapp:${{ github.sha }} # Scan the built image
          publish_to: github-pages
```

### Publishing test reports

```yaml
      - name: Run tests with coverage
        run: mvn test jacoco:report surefire-report:report

      - name: Publish test reports
        uses: Avarko/gh-security-toolkit/actions/publish-test-reports@main
        with:
          channel: main
          jacoco_report_path: target/site/jacoco
          surefire_report_path: target/site/surefire-report
```

---

## Use cases

### 1. **Shift left development**
> "As a developer, I want to easily run local vulnerability scans to assess the impact of updates to Docker images, Terraform, application libraries, and utility scripts."

Enable and run local scans with just a few additional lines in the Makefile.

### 2. **Manage findings lifecycle**
> "As a developer, I want to configure which vulnerabilities and misconfigurations to report, so the results remain actionable."

The toolkit supports `.trivy.yaml` and `.semgrepignore` configuration files to customize what gets scanned and reported.

### 3. **Nightly Continuous Scans**
> "As a security engineer, I want nightly scans of all main branches with historical diffs and results to GitHub Releases with alerts to Slack."

Use the provided composite action to:
- build & scan containers,
- upload results as JSON artifacts or GitHub Releases,
- compare with previous scans,
- and send summarized diffs to Slack.

### 4. **Historical Scan Tracking**
> "As a team, I want to track security scan results over time to understand our security posture trends."

The toolkit publishes scan results to GitHub Releases (with configurable retention policies) and generates GitHub Pages with historical scan comparisons across channels.

### 5. **Multi-Channel Notifications**
> "As an (secops) engineering lead/product owner, I want summarized vulnerability reports automatically sent to Slack and GitHub."

Currently provides integration to Slack. Other notifications easy to add.

### 6. **Security Baseline Across Repos**
> "As a platform team, I want a reusable, uniform scanning standard across all projects."

The toolkit provides opinionated, versioned composite actions and local development scripts you can apply with varying levels of enforcement.


---

## Architecture

```
gh-security-toolkit/
├─ actions/
│  ├─ security-scan/            # Main composite action for security scanning
│  │  └─ action.yml             # Runs Trivy, Semgrep, summarizes, publishes
│  │
│  ├─ publish-test-reports/     # Composite action for test reports
│  │  └─ action.yml             # Publishes JaCoCo/Surefire to GitHub Pages
│  │
│  ├─ scanner/                  # Scan execution
│  │  ├─ trivy/                 # Filesystem + Docker image scanning
│  │  └─ semgrep/               # SAST scanning
│  │
│  ├─ summarizer/               # Result aggregation
│  │  └─ action.yml
│  │
│  ├─ publisher/                # Result publishing
│  │  ├─ github-release/        # Publish to GitHub Releases
│  │  └─ github-pages/          # Publish to GitHub Pages
│  │
│  ├─ builder/
│  │  └─ dashboard/             # Builds React dashboard SPA
│  │
│  └─ cleanup/
│     └─ github-release/        # Release retention management
│
├─ cli/                         # Docker-based CLI
│  └─ Dockerfile
│
├─ scripts/                     # JBang processing scripts
│  ├─ github_pages_builder.java
│  ├─ semgrep_summarize.java
│  ├─ slack_integration.java
│  └─ trivy_summarize.java
│
├─ dashboard/                   # React + Vite SPA for GitHub Pages UI
│  ├─ src/
│  │  ├─ features/scans/        # Scan visualization components
│  │  │  ├─ model/              # Zod schemas for data validation
│  │  │  ├─ charts/             # ECharts configurations
│  │  │  └─ api/                # Data fetching from /data/*
│  │  └─ lib/                   # Utilities (tenant path resolution, etc.)
│  ├─ package.json
│  ├─ vite.config.ts
│  └─ tsconfig.json
│
└─ src/main/java/fi/evolver/secops/githubPages/  # Java model classes
   ├─ GitHubPagesBuilder.java
   ├─ loader/
   ├─ model/
   ├─ renderer/
   ├─ transformer/
   └─ viewmodel/
```

---

## Components

### Main Actions

| Action | Purpose |
|--------|---------|
| **`actions/security-scan`** | Main composite action: runs Trivy + Semgrep, summarizes, publishes |
| **`actions/publish-test-reports`** | Publishes JaCoCo/Surefire test reports to GitHub Pages |

### Scanners

| Scanner | Type | Scans |
|---------|------|-------|
| **Trivy** | Filesystem + Image | Vulnerabilities, Misconfigurations |
| **Semgrep** | SAST | Code security issues, secrets |

### Publishers

| Publisher | Output | Features |
|-----------|--------|----------|
| **GitHub Release** | Tagged releases | Retention by count/age, JSON attachments |
| **GitHub Pages** | Static HTML | Scan history, interactive tables, CVE links |

### Publishing options

```yaml
publish_to: "github-release"           # Only releases
publish_to: "github-pages"             # Only Pages (requires Private Pages)
publish_to: "github-release,github-pages"  # Both
```

---

## GitHub Pages features

**Channel-based organization**

```
./
├── index.html                              # All channels overview
├── style.css                               # Unified styles
└── data/
    ├── hist/
    │   └── scan-history.json               # Versioned history (v2) for charts
    ├── channels/
    │   └── nightly-master/
    │       └── index.html                  # Channel scan history
    └── runs/
        └── nightly-master/
            ├── 2025-11-09-120000Z/
            │   ├── index.html              # Scan detail report
            │   ├── scan-run.json
            │   ├── trivy-fs-results.json
            │   ├── trivy-image-results.json
            │   └── semgrep-results.json
            └── 2025-11-08-120000Z/
                └── ...
```

**Interactive features:**
- Vulnerability tables with severity highlighting
- Channel timeline graphs with toggleable severities (powered by persistent scan-history JSON v2)
- Direct CVE links to OSV, NVD, CVE.org
- Raw JSON data downloads
- Sticky footer with metadata (CI job, Git info)
- Scan history navigation

**Privacy:**
- Enforces Private Pages (GitHub Enterprise Cloud required)
- Deployment fails if Pages is configured as public

---

## Data structure

GitHub Pages deployment: each repository has its own private Pages site with its own scan data.

```
./                              # GitHub Pages root
├── index.html                  # Dashboard SPA entry point
├── assets/                     # Dashboard static files (JS, CSS)
└── data/
    ├── hist/
    │   ├── scan-history.json       # Security scans history
    │   └── test-report-history.json # Test reports history (optional)
    └── runs/
        └── <channel>/              # e.g., "nightly", "main", "manual"
            └── <timestamp>/        # e.g., "20251121-161415"
                ├── scan-run.json           # Scan metadata
                ├── trivy-fs-results.json   # Trivy filesystem results
                ├── trivy-image-results.json # Trivy image results
                └── semgrep-results.json    # Semgrep results
```

**URL structure**:
- `/security-scans` - Main dashboard
- `/security-scans/channel/:channel` - Channel scan history
- `/security-scans/channel/:channel/run/:timestamp` - Individual scan details
- `/test-reports` - Test reports overview
- `/test-reports/channel/:channel` - Channel test reports

**Security model**:
- Isolation by repository: each repo has its own private Pages
- Data stored directly at `/data/`
- Private Pages enforced (deployment fails if Pages is public)

---

## Configuration

### Client configuration file

Create `.gh-security-toolkit/config.yaml` in your repository to customize toolkit behavior and organization branding:

```yaml
# .gh-security-toolkit/config.yaml
version: "1"

# Organization branding (displayed in dashboard)
organization:
  display_name: "Evolver Oy"
  logo_url: "https://evolver.fi/logo.svg"

# Repository info (displayed in dashboard)
repository:
  display_name: "My Application"

# Scanning defaults (can be overridden by action inputs)
scanning:
  trivy:
    severity: "MEDIUM,HIGH,CRITICAL"
  semgrep:
    configs:
      - "p/owasp-top-ten"
      - "p/java"

# Publishing defaults
publishing:
  retention_keep: 20
  retention_days: 90
```

**Configuration priority (highest to lowest):**

1. **Action inputs** - Workflow-specific overrides
2. **`.gh-security-toolkit/config.yaml`** - Repository-level defaults
3. **Native tool configs** - `.trivy.yaml`, `.trivyignore`, `.semgrepignore`
4. **Toolkit defaults** - Built-in default values

### Ignoring findings (`.trivyignore`)

Trivy skips a finding when its ID appears in a `.trivyignore` file at the repository root. This is Trivy's own native mechanism — the toolkit does not add anything on top of it, it just runs Trivy with whatever `.trivyignore` it finds.

**Format:** one identifier per line — a CVE, an `AVD-*` misconfiguration ID, or a secret rule name. Blank lines and `#`-prefixed lines are comments and are skipped.

```
# .trivyignore

# Accept the risk: no fix available yet, low exploitability in our setup.
CVE-2018-14618

# False positive — this is a test fixture, not a real credential.
aws-account-id

AVD-DS-0002  # Base image runs as root; acceptable for this internal tool
```

**Always pair an ignored ID with a `#` comment explaining why**, on the line above or as a trailing comment on the same line. An ignore without a reason is indistinguishable later from one nobody remembers adding — the comment is what lets a future reviewer (or you, in six months) judge whether it still holds.

**Expiry — always set one for anything that is not a permanent accepted risk.** Append `exp:YYYY-MM-DD` after the ID:

```
# Waiting on upstream patch, tracked in JIRA-1234. Re-evaluate if still open.
CVE-2019-14697 exp:2026-12-31
```

Once the date passes, Trivy stops ignoring that ID and it reappears in scan results — the ignore expires instead of silently living forever. Reserve ID-only, no-expiry lines for findings you have deliberately decided to accept permanently (e.g. a vulnerability in a code path that is genuinely unreachable in this project), and say so in the comment.

**`.trivyignore.yaml` for anything more specific than an ID.** If an ignore needs to apply only to one file path, or only to one package (PURL) rather than every occurrence of an ID repo-wide, use the YAML form instead — it supports `paths`, `purls`, `statement` (the reason, as a field instead of a comment), and `expired_at` the same way:

```yaml
# .trivyignore.yaml
vulnerabilities:
  - id: CVE-2023-2650
    paths:
      - "vendor/legacy-lib/METADATA"
    statement: "Vendored copy, not exercised by any code path we call."
    expired_at: 2026-12-31

misconfigurations:
  - id: AVD-DS-0002
    statement: "Base image runs as root; acceptable for this internal tool."
```

Both files are read straight from the repository root by the `trivy` binary the scanner steps invoke — nothing in this toolkit needs to be told they exist.

### Security scan action inputs

| Input | Description | Default |
|-------|-------------|---------|
| `channel` | Channel name for organizing scans | *Required* |
| `filesystem_paths` | Newline-separated list of paths to scan | `""` |
| `docker_image_ref` | Docker image reference (name:tag) to scan | `""` |
| `publish_to` | Where to publish: `github-release`, `github-pages`, or both | `github-pages` |
| `retention_days` | Days to retain results | `30` |
| `retention_keep` | Max results per channel | `10` |
| `trivy_severity` | Minimum severity to report | `MEDIUM,HIGH,CRITICAL` |
| `trivy_config` | Path to `.trivy.yaml` config | `""` |
| `semgrep_configs` | Semgrep rule configurations | `p/owasp-top-ten,...` |
| `org_display_name` | Organization display name (overrides config.yaml) | `""` |
| `org_logo_url` | Organization logo URL (overrides config.yaml) | `""` |
| `repo_display_name` | Repository display name (overrides config.yaml) | `""` |

### Permissions required

```yaml
permissions:
  contents: write    # Release creation
  pages: write       # GitHub Pages deployment
  id-token: write    # Pages OIDC authentication
  actions: read      # Artifact history access
```

### Trivy configuration

Create `.trivy.yaml` in your repository:

```yaml
vulnerability:
  type:
    - os
    - library
severity:
  - CRITICAL
  - HIGH
  - MEDIUM
```

---

## Security considerations and data privacy

### Data privacy and air-gapped execution

**Your data stays with you - no external communication during scans:**

**Local development (Makefile):**
- **Offline vulnerability databases**: The toolkit Docker image includes pre-downloaded Trivy DB, VEX Hub, and Cosign TUF cache
- **Read-only workspace mounts**: Your source code is mounted read-only (`:ro`) by default

**GitHub Actions CI/CD:**
- **Network communication only for publishing**: Results are published only to your own git repository's GitHub Releases/Pages
- **Optional integrations**: Slack notifications (if `SLACK_BOT_TOKEN` configured) and Dependabot API (if `dependabot_gh_token` provided)

**Scans keep your source code private.**

### Private GitHub Pages enforcement

GitHub Pages publisher **refuses to deploy** if Pages is configured as public:

```
Error: GitHub Pages is configured as PUBLIC
   This would expose security scan results to the internet.

   To fix:
   1. Go to Settings -> Pages
   2. Change visibility to "Private"
   3. Re-run this workflow
```

### Secret management

- Use GitHub Secrets for sensitive tokens (Slack tokens)
- Never commit real credentials to test fixtures

### Retention policies

Three independent retention mechanisms:

1. **GitHub artifact retention** (`retention_days`)
   - Artifacts auto-deleted after N days (GitHub enforced)
   - Default: 90 days for scan history, 1 day for temporary artifacts
   - Cannot be prevented (GitHub platform policy)

2. **Scan count retention** (`retention_keep: 10`)
   - Keeps only N newest full scan results per channel
   - Older scans removed from GitHub Pages data before deployment
   - Stats remain in `scan-history.json` (compact format)

3. **Artifact cleanup** (optional, `.github/workflows/clean-artifacts.yml`)
   - Scheduled workflow to cleanup old artifacts in the toolkit repository
   - Configurable retention per artifact type
   - Can be called from client repositories to clean toolkit artifacts

---

## Advanced topics

### Channel naming strategy

Channels are isolated scan histories. Good practices:

- `nightly-{branch}` - Daily scans per branch
- `pr-{number}` - Per-PR scans
- `release-{version}` - Release verification
- `manual` - Ad-hoc scans

**Rules:**
- Max 35 characters
- Only `a-z`, `A-Z`, `0-9`, `-`, `_`
- Cannot start/end with `-` or `_`

### Cross-branch scans

Same channel name across branches -> shared history:

```yaml
# main branch
channel: nightly-production

# develop branch
channel: nightly-production  # Same history!
```

---

## Local development of gh-security-toolkit

### Run JBang scripts

```bash
# Trivy summary
jbang scripts/trivy_summarize.java \
  trivy-results.json \
  50 \
  output-dir

# Semgrep summary
jbang scripts/semgrep_summarize.java \
  semgrep-results.json \
  output-dir

# GitHub Pages builder
jbang scripts/github_pages_builder.java \
  scan-output/ \
  ./ \
  2025-11-09-120000Z \
  my-channel
```

### Dashboard architecture

The GitHub Pages UI is built with **React + Vite** as a single-page application:

- **Data Processing** (Java): `GitHubPagesBuilder.java` generates JSON files in `data/` directory
- **UI Rendering** (React): Dashboard reads `/data/*.json` files client-side using `fetch()`
- **Deployment**: Dashboard build artifact merged with data during GitHub Pages publishing
- **Routing**: `react-router-dom` for client-side navigation
- **Charts**: Apache ECharts via `echarts-for-react`
- **UI Components**: Material-UI (MUI)

**Tenant Modes** (build-time):

| Mode | Build Command | Data Path | URL Structure |
|------|--------------|-----------|---------------|
| Single-tenant | `npm run build` | `/data/` | `/security-scans/...` |
| Multi-tenant | `TENANT_MODE=multi-tenant npm run build` | `/data/<uuid>/` | `/:tenantPath/security-scans/...` |

**Routes** (single-tenant):
- `/` - Redirects to `/security-scans`
- `/security-scans` - Scan overview
- `/security-scans/channel/:channel` - Channel scan history
- `/security-scans/channel/:channel/run/:timestamp` - Scan details
- `/test-reports` - Test reports overview
- `/test-reports/channel/:channel` - Channel test reports

**Routes** (multi-tenant):
- `/` - Tenant selector
- `/:tenantPath/security-scans` - Tenant scan overview
- `/:tenantPath/security-scans/channel/:channel/run/:timestamp` - Scan details

**Development**:
```bash
cd dashboard
npm install
npm run dev                    # Single-tenant mode (default)

# Multi-tenant mode:
TENANT_MODE=multi-tenant MULTI_TENANT_CONFIG_PATH=./config.json npm run dev
```

### LocalStack S3 development

For local development with realistic multi-tenant data from S3, use LocalStack:

**Prerequisites:**
- Docker (for LocalStack container)
- AWS CLI (installed via `mise install`)

**Quick start:**
```bash
# One-command setup: starts LocalStack, creates buckets, uploads test data, starts dev server
make localstack-dev

# Or step by step:
make localstack-start          # Start LocalStack container
make localstack-setup          # Create S3 buckets with test data
cd dashboard && npm run dev:localstack  # Start dev server with S3 data
```

**Test data structure:**

LocalStack creates two S3 buckets with test data for two organizations:

| Bucket | Organization | Repositories |
|--------|--------------|--------------|
| `contoso-security-reports` | Contoso Corporation | frontend, backend |
| `acme-security-reports` | Acme Inc | frontend, backend |

Each repository contains:
- Security scan history (`hist/scan-history.json`)
- Test report history (`hist/test-report-history.json`)
- Individual scan runs with Trivy/Semgrep results
- JaCoCo and Surefire HTML test reports

**NPM scripts (in dashboard/):**
```bash
npm run localstack:start       # Start LocalStack container
npm run localstack:stop        # Stop LocalStack container
npm run localstack:setup       # Initialize buckets with test data
npm run localstack:logs        # View LocalStack logs
npm run dev:localstack         # Start Vite with LocalStack S3 data
```

**Makefile commands (from root or dashboard/):**
```bash
make localstack-start          # Start LocalStack
make localstack-stop           # Stop LocalStack
make localstack-setup          # Initialize S3 buckets
make localstack-dev            # Full workflow: start + setup + dev server
```

**Configuration:**

LocalStack tenant configuration is in `dashboard/localstack-config/tenant-registry.json`:
```json
{
  "tenants": [
    {
      "id": "contoso-uuid-001",
      "url_path": "contoso",
      "display_name": "Contoso Dashboard",
      "repositories": [
        {
          "id": "frontend",
          "data_base_url": "http://localhost:4566/contoso-security-reports/data/frontend"
        }
      ]
    }
  ]
}
```

---

## Examples

See individual action documentation:

- [Security Scan Action](actions/security-scan/action.yml)
- [Publish Test Reports Action](actions/publish-test-reports/action.yml)
- [Trivy Scanner](actions/scanner/trivy/action.yml)
- [Semgrep Scanner](actions/scanner/semgrep/action.yml)
- [GitHub Pages Publisher](actions/publisher/github-pages/README.md)
- [GitHub Release Publisher](actions/publisher/github-release/action.yml)

---

## License

MIT License - feel free to fork, extend, and reuse.
