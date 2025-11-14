# gh-security-toolkit

**Security scanning and reporting toolkit for GitHub Actions CI/CD and Makefile integration for local "shift left" scans during development.**

Provides reusable GitHub Actions workflows and Makefile integration for vulnerability scanning, misconfiguration detection, and security reporting with flexible publishing options (GitHub Releases and/or GitHub Pages).

---

## 📋 Table of contents

- [✨ Overview](#-overview)
- [🚀 Quick start](#-quick-start)
- [🎯 Use cases](#-use-cases)
- [🏗️ Architecture](#-architecture)
- [🔧 Components](#-components)
- [📊 GitHub Pages features](#-github-pages-features)
- [⚙️ Configuration](#️-configuration)
- [🔐 Security considerations](#-security-considerations)
- [📚 Advanced topics](#-advanced-topics)
- [🛠️ Local development](#️-local-development)
- [📖 Examples](#-examples)

---

## ✨ Overview

`gh-security-toolkit` is a modular security scanning solution that integrates multiple industry-standard tools into a unified workflow. Results are published as GitHub Releases with retention policies or as interactive HTML reports on GitHub Pages.

**Key features:**
- 🔍 **Multi-scanner support**: currently Trivy (filesystem + Docker images) and Semgrep
- 📊 **Dual publishing for CI/CD scans**: GitHub Releases (with automatic cleanup) or GitHub Pages (with scan history) with automatic cleanup/retention
- 🏷️ **Channel-based organization**: Separate CI/CD scan histories per environment (nightly, PR, manual, etc.)
- 🔒 **Local scans during development** via easy Makefile integration

---

## 🚀 Quick start

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

1. Add upload actions in your workflow. These deliver the filesystem and/or Docker image to the scanning job via GitHub Artifacts.

```yaml
name: Build
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Upload your working dir's filesystem for scanning
      - uses: Avarko/gh-security-toolkit/actions/uploader/filesystem@main
        with:
          path: |     # or simply use . as path
            src/
            .github/
            Dockerfile

      # Build and upload your Docker image for scanning
      - name: Build image
        # build your Docker image as you wish

      - uses: Avarko/gh-security-toolkit/actions/uploader/docker-image@main
        with:
          image-name: myapp:latest   # refer to your built image tag
```

2. Add a security scan job. This needs to be a separate job as it references a reuseable workflow.

```yaml
name: Security Scan
on:
  workflow_run:
    workflows: ["Build"]
    types: [completed]

jobs:
  scan:
    uses: Avarko/gh-security-toolkit/.github/workflows/security-scan.yml@main
    with:
      channel: nightly-master   # choose any meaningful name for scans done by this job
      publish_to: github-pages  # or "github-release" or "github-release,github-pages"
      branch: ${{ github.ref_name }}
      repository: ${{ github.repository }}
      commit_sha: ${{ github.sha }}
    permissions:
      contents: write       # Required for creating releases and tags
      id-token: write       # Required for OIDC authentication (e.g., GitHub Pages)
      pages: write          # Required for deploying to GitHub Pages
      actions: read         # Required for actions to manage action artifacts
```

---


## 🎯 Use cases

### 1. **Shift left development**
> "As a developer, I want to easily run local vulnerability scans to assess the impact of updates to Docker images, Terraform, application libraries, and utility scripts."

✅ Enable and run local scans with just a few additional lines in the Makefile.

### 2. **Manage findings lifecycle**
> "As a developer, I want to configure which vulnerabilities and misconfigurations to report, so the results remain actionable."

✅ The toolkit supports `.trivy.yaml` and `.semgrepignore` configuration files to customize what gets scanned and reported.

### 3. **Nightly Continuous Scans**
> "As a security engineer, I want nightly scans of all main branches with historical diffs and results to GitHub Releases with alerts to Slack."

✅ Use the provided workflow to:
- build & scan containers,
- upload results as JSON artifacts or GitHub Releases,
- compare with previous scans,
- and send summarized diffs to Slack.

### 4. **Historical Scan Tracking**
> "As a team, I want to track security scan results over time to understand our security posture trends."

✅ The toolkit publishes scan results to GitHub Releases (with configurable retention policies) and generates GitHub Pages with historical scan comparisons across channels.

### 5. **Multi-Channel Notifications**
> “As an (secops) engineering lead/product owner, I want summarized vulnerability reports automatically sent to Slack and GitHub.”

✅ Currently provides integration to Slack. Other notifications easy to add.

### 6. **Security Baseline Across Repos**
> “As a platform team, I want a reusable, uniform scanning standard across all projects.”

✅ The toolkit provides opinionated, versioned workflows and local development scripts you can apply with varying levels of enforcement.


---
## Architecture

```
gh-security-toolkit/
├─ .github/workflows/
│  ├─ security-scan.yml          # Reusable workflow
│  └─ int-manual-build-scanner-cli.yml  # Manual CLI build
│
├─ actions/
│  ├─ scanner/                   # Scan execution
│  │  ├─ trivy/                  # Filesystem + Docker image scanning
│  │  └─ semgrep/                # SAST scanning
│  │
│  ├─ summarizer/                # Result aggregation
│  │  └─ action.yml
│  │
│  ├─ publisher/                 # Result publishing
│  │  ├─ github-release/         # Publish to GitHub Releases
│  │  └─ github-pages/           # Publish to GitHub Pages
│  │
│  ├─ uploader/                  # Artifact creation
│  │  ├─ filesystem/             # Upload source code
│  │  └─ docker-image/           # Upload Docker images
│  │
│  └─ cleanup/
│     └─ github-release/         # Release retention management
│
├─ cli/                          # Docker-based CLI
│  └─ Dockerfile
│
├─ scripts/                      # JBang processing scripts
│  ├─ github_pages_builder.java
│  ├─ semgrep_summarize.java
│  ├─ slack_integration.java
│  ├─ trivy_summarize.java
│  └─ templates/                 # FreeMarker templates for GitHub Pages HTML releases
│     ├─ _footer.ftl
│     ├─ _scan_table.ftl
│     ├─ _semgrep_table.ftl
│     ├─ _trivy_table.ftl
│     ├─ channel_index.ftl
│     ├─ main_index.ftl
│     └─ scan_detail.ftl
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

## 🔧 Components

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

## 📊 GitHub Pages features

**Channel-based organization**

```
docs/
├── index.html                  # All channels overview
└── scans/
    ├── nightly-master/
    │   ├── index.html          # Channel scan history
    │   ├── 2025-11-09-120000Z/
    │   │   ├── index.html      # Scan detail report
    │   │   ├── trivy-fs-results.json
    │   │   ├── trivy-image-results.json
    │   │   └── semgrep-results.json
    │   └── 2025-11-08-120000Z/
    └── pr-123/
        └── ...
```

**Interactive features:**
- 📋 Vulnerability tables with severity highlighting
- 🔗 Direct CVE links to OSV, NVD, CVE.org
- 📄 Raw JSON data downloads
- 📌 Sticky footer with metadata (CI job, Git info, tool versions)
- 🔍 Scan history navigation

**Privacy:**
- ✅ Enforces Private Pages (GitHub Enterprise Cloud required)
- ❌ Deployment fails if Pages is configured as public

---

## ⚙️ Configuration

### Workflow inputs

| Input | Description | Default |
|-------|-------------|---------|
| `channel` | Channel name for organizing scans | *Required* |
| `publish_to` | Where to publish: `github-release`, `github-pages`, or both | `github-release` |
| `retention_days` | Days to retain results | `30` |
| `retention_keep` | Max results per channel | `10` |
| `trivy_severity` | Minimum severity to report | `MEDIUM,HIGH,CRITICAL` |
| `trivy_config` | Path to `.trivy.yaml` config | `""` |

### Permissions required

```yaml
permissions:
  contents: write    # Release creation, docs/ commits
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

## 🔐 Security considerations and data privacy

### Data privacy and air-gapped execution

**Your data stays with you — no external communication during scans:**

**Local development (Makefile):**
- ✅ **Air-gapped filesystem scans**: `make sec/scan/trivy/fs` and `make sec/scan/semgrep` run with `--network=none` Docker isolation
- ✅ **Offline vulnerability databases**: The toolkit Docker image includes pre-downloaded Trivy DB, VEX Hub, and Cosign TUF cache
- ✅ **Read-only workspace mounts**: Your source code is mounted read-only (`:ro`) by default
- ✅ **No telemetry**: Scanners run with metrics disabled (`--metrics=off` for Semgrep, offline mode for Trivy)
- ⚠️ **Docker image scans** (`make sec/scan/trivy/img`): Requires Docker socket access for local convenience (network isolation disabled for this target only)

**GitHub Actions CI/CD:**
- ✅ **Air-gapped image scanning**: Docker images are saved as `.tar` files and scanned without Docker socket access
- ✅ **Network communication only for publishing**: Results are published to GitHub Releases/Pages (within your repository)
- ✅ **Optional integrations**: Slack notifications (if `SLACK_BOT_TOKEN` configured) and Dependabot API (if `dependabot_gh_token` provided)

**When you run `make sec/scan/trivy/fs` or `make sec/scan/semgrep` locally, nothing leaves your machine.**

### Private Pages enforcement

GitHub Pages publisher **refuses to deploy** if Pages is configured as public:

```
❌ Error: GitHub Pages is configured as PUBLIC
   This would expose security scan results to the internet.

   To fix:
   1. Go to Settings → Pages
   2. Change visibility to "Private"
   3. Re-run this workflow
```

### Secret management

- Use GitHub Secrets for sensitive tokens (Slack tokens)
- Never commit real credentials to test fixtures

### Retention policies

Two independent retention mechanisms:

1. **GitHub artifact retention** (`retention_days: 30`)
   - Artifacts auto-deleted after N days
   - Cannot be prevented (GitHub enforced)

2. **Scan count retention** (`retention_keep: 10`)
   - Keeps only N newest scans per channel
   - Older scans removed from artifact before upload

---

## 📚 Advanced topics

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

Same channel name across branches → shared history:

```yaml
# main branch
channel: nightly-production

# develop branch
channel: nightly-production  # Same artifact!
```

### Footer metadata

Pass additional context to HTML reports:

```yaml
with:
  app_docs_url: https://docs.example.com
  app_issues_url: https://github.com/org/repo/issues
  toolkit_version: v1.2.3
```

---

## 🛠️ Local development of gh-security-toolkit

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
  docs/ \
  2025-11-09-120000Z \
  my-channel
```

### Test templates

Templates are in `scripts/templates/*.ftl` (FreeMarker):

- `main_index.ftl` - All channels overview
- `channel_index.ftl` - Channel scan history
- `scan_detail.ftl` - Individual scan report
- `_scan_table.ftl` - Shared table component
- `_trivy_table.ftl` - Trivy findings table
- `_semgrep_table.ftl` - Semgrep findings table
- `_footer.ftl` - Report footer

---

## 📖 Examples

See individual action READMEs:

- [Trivy Scanner](actions/scanner/trivy/action.yml)
- [Semgrep Scanner](actions/scanner/semgrep/action.yml)
- [GitHub Pages Publisher](actions/publisher/github-pages/README.md)
- [GitHub Release Publisher](actions/publisher/github-release/action.yml)

---

## 🤝 Contributing

Contributions welcome! This toolkit is designed to be:

- **Modular**: Each action is independent
- **Composable**: Use actions individually or via reusable workflow
- **Extensible**: Add new scanners, publishers, or notifications

---

## 📄 License

MIT License — feel free to fork, extend, and reuse.
