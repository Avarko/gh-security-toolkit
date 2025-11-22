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
include $(shell __GHST_FILE=.ghst/Makefile; \
	mkdir -p .ghst; \
	[ -f $$__GHST_FILE ] || curl -fsSL "https://raw.githubusercontent.com/Avarko/gh-security-toolkit/main/Makefile.scanners" -o $$__GHST_FILE; \
	echo $$__GHST_FILE)
```

2. Then simply start scanning:

```bash
make sec/scan/help  # Show all commands
make sec/scan       # Perform full scan
```

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
        uses: Avarko/gh-security-toolkit/actions/security-scan@reactui
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
        uses: Avarko/gh-security-toolkit/actions/publish-test-reports@reactui
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
