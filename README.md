# gh-security-toolkit

**GitHub-native security scanning and reporting toolkit for containerized applications.**

Provides reusable GitHub Actions workflows and components for automated vulnerability scanning, misconfiguration detection, and security reporting with flexible publishing options (GitHub Releases and/or GitHub Pages).

---

## ✨ Overview

`gh-security-toolkit` is a modular security scanning solution that integrates multiple industry-standard tools (Trivy, Semgrep, Dependabot, TruffleHog) into a unified workflow. Results are published as GitHub Releases with retention policies or as interactive HTML reports on GitHub Pages.

**Key Features:**
- 🔍 **Multi-scanner support**: Trivy (filesystem + Docker images), Semgrep, Dependabot, TruffleHog
- 📊 **Dual publishing**: GitHub Releases (with automatic cleanup) or GitHub Pages (with scan history)
- 🏷️ **Channel-based organization**: Separate scan histories per environment (nightly, PR, manual, etc.)
- 🔒 **Private Pages enforcement**: Refuses to deploy if GitHub Pages is configured as public
- 📈 **Retention policies**: Automatic cleanup based on count or age
- 🎨 **Interactive HTML reports**: Sticky footer with metadata, CVE links, JSON downloads

---

## 🚀 Quick Start

### 1. Create artifacts in your build workflow

```yaml
name: Build
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      # Upload filesystem for scanning
      - uses: Avarko/gh-security-toolkit/actions/uploader/filesystem@main
        with:
          path: .
      
      # Build and upload Docker image
      - name: Build image
        run: docker build -t myapp:latest .
      
      - uses: Avarko/gh-security-toolkit/actions/uploader/docker-image@main
        with:
          image_name: myapp:latest
```

### 2. Run security scan

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
      channel: nightly-master
      publish_to: github-pages  # or "github-release" or "github-release,github-pages"
      branch: ${{ github.ref_name }}
      repository: ${{ github.repository }}
      commit_sha: ${{ github.sha }}
    permissions:
      contents: write
      pages: write
      id-token: write
      actions: read
```

---

## Architecture

```
gh-security-toolkit/
├─ .github/workflows/
│  └─ security-scan.yml          # Reusable workflow
│
├─ actions/
│  ├─ scanner/                   # Scan execution
│  │  ├─ trivy/                  # Filesystem + Docker image scanning
│  │  ├─ semgrep/                # SAST scanning
│  │  ├─ dependabot/             # Dependency alerts
│  │  └─ trufflehog/             # Secret scanning
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
├─ scripts/                      # JBang processing scripts
│  ├─ github_pages_builder.java
│  ├─ semgrep_summarize.java
│  ├─ trivy_summarize.java
│  └─ templates/                 # FreeMarker templates
│
├─ src/main/java/                # Java model classes
└─ cli/                          # Docker-based CLI (future)
```

---

## 🔧 Components

### Scanners

| Scanner | Type | Scans |
|---------|------|-------|
| **Trivy** | Filesystem + Image | Vulnerabilities, Misconfigurations |
| **Semgrep** | SAST | Code security issues, secrets |
| **Dependabot** | Dependency | Known vulnerabilities in dependencies |
| **TruffleHog** | Secret | Hardcoded secrets, credentials |

### Publishers

| Publisher | Output | Features |
|-----------|--------|----------|
| **GitHub Release** | Tagged releases | Retention by count/age, JSON attachments |
| **GitHub Pages** | Static HTML | Scan history, interactive tables, CVE links |

### Publishing Options

```yaml
publish_to: "github-release"           # Only releases
publish_to: "github-pages"             # Only Pages (requires Private Pages)
publish_to: "github-release,github-pages"  # Both
```

---

## 📊 GitHub Pages Features

**Channel-based organization:**
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

## 🎯 Use Cases

### Nightly Security Scans

```yaml
name: Nightly Security Scan
on:
  schedule:
    - cron: '0 3 * * *'  # 3 AM UTC
  workflow_dispatch:

jobs:
  build:
    # ... build steps that create artifacts ...
    
  scan:
    needs: build
    uses: Avarko/gh-security-toolkit/.github/workflows/security-scan.yml@main
    with:
      channel: nightly-${{ github.ref_name }}
      publish_to: github-pages
      retention_keep: 30
      retention_days: 90
```

### PR Security Checks

```yaml
name: PR Security Check
on: pull_request

jobs:
  build:
    # ... build steps ...
    
  scan:
    needs: build
    uses: Avarko/gh-security-toolkit/.github/workflows/security-scan.yml@main
    with:
      channel: pr-${{ github.event.pull_request.number }}
      publish_to: github-release
      retention_keep: 5
```

### Manual On-Demand Scans

```yaml
name: Manual Security Scan
on: workflow_dispatch

jobs:
  scan:
    uses: Avarko/gh-security-toolkit/.github/workflows/security-scan.yml@main
    with:
      channel: manual
      publish_to: github-release,github-pages
```

---

## ⚙️ Configuration

### Workflow Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `channel` | Channel name for organizing scans | *Required* |
| `publish_to` | Where to publish: `github-release`, `github-pages`, or both | `github-release` |
| `retention_days` | Days to retain results | `30` |
| `retention_keep` | Max results per channel | `10` |
| `trivy_severity` | Minimum severity to report | `MEDIUM,HIGH,CRITICAL` |
| `trivy_config` | Path to `.trivy.yaml` config | `""` |

### Permissions Required

```yaml
permissions:
  contents: write    # Release creation, docs/ commits
  pages: write       # GitHub Pages deployment
  id-token: write    # Pages OIDC authentication
  actions: read      # Artifact history access
```

### Trivy Configuration

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

## 🔐 Security Considerations

### Private Pages Enforcement

GitHub Pages publisher **refuses to deploy** if Pages is configured as public:

```
❌ Error: GitHub Pages is configured as PUBLIC
   This would expose security scan results to the internet.
   
   To fix:
   1. Go to Settings → Pages
   2. Change visibility to "Private"
   3. Re-run this workflow
```

### Secret Management

- Use GitHub Secrets for sensitive tokens (Dependabot PAT, Slack tokens)
- TruffleHog scanner detects hardcoded secrets in code
- Never commit real credentials to test fixtures

### Retention Policies

Two independent retention mechanisms:

1. **GitHub artifact retention** (`retention_days: 30`)
   - Artifacts auto-deleted after N days
   - Cannot be prevented (GitHub enforced)

2. **Scan count retention** (`retention_keep: 10`)
   - Keeps only N newest scans per channel
   - Older scans removed from artifact before upload

---

## 📚 Advanced Topics

### Channel Naming Strategy

Channels are isolated scan histories. Good practices:

- `nightly-{branch}` - Daily scans per branch
- `pr-{number}` - Per-PR scans
- `release-{version}` - Release verification
- `manual` - Ad-hoc scans

**Rules:**
- Max 35 characters
- Only `a-z`, `A-Z`, `0-9`, `-`, `_`
- Cannot start/end with `-` or `_`

### Cross-Branch Scans

Same channel name across branches → shared history:

```yaml
# main branch
channel: nightly-production

# develop branch  
channel: nightly-production  # Same artifact!
```

### Footer Metadata

Pass additional context to HTML reports:

```yaml
with:
  app_docs_url: https://docs.example.com
  app_issues_url: https://github.com/org/repo/issues
  toolkit_version: v1.2.3
```

---

## 🛠️ Local Development

### Run JBang Scripts

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

### Test Templates

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
