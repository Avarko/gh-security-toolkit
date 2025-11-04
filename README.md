# gh-security-toolkit

**GitHub-native security scanning and automation toolkit.**
Provides ready-to-use GitHub Actions, reusable workflows, and local scripts (via JBang or Makefiles) for continuous vulnerability management and SecOps automation.

---

## ✨ Overview

`gh-security-toolkit` provides ready-made, reusable solutions for security scanning, SBOM generation, and vulnerability reporting — packaged as modular GitHub Actions workflows and easy-to-run local scripts (via Makefiles or JBang) for both CI pipelines and developer workstations.

---

## 🚀 Use cases

### 1. **Shift Left development**
> “As a developer, I want to easily run vulnerability scans locally to understand the impact of the Docker image, Terraform, application library and utility script dependency updates I’m testing.”

✅ Run scans and vulnerability diffs locally — right from your `Makefile` or CLI.

### 2. **Manage findings lifecycle**
> “As a developer, I want to mark or suppress known findings for a limited time, so the reports remain actionable.”

✅ The toolkit supports ignore files with expiry metadata.
You can centrally track exceptions and re-enable them automatically once expired.

### 3. **Nightly Continuous Scans**
> “As a security engineer, I want nightly scans of all main branches with historical diffs and results to GitHub Releases with alerts to Slack.”

✅ Use the provided workflow to:
- build & scan containers,
- upload results as JSON artifacts or GitHub Releases,
- compare with previous scans,
- and send summarized diffs to Slack.

### 4. **SBOM Generation and Comparison**
> “As an auditor, I want a full SBOM and change diff between commits or releases.”

✅ Produces JSON, SPDX, and text reports — automatically comparing current vs. previous versions.

### 5. **Multi-Channel Notifications**
> “As an engineering lead, I want summarized vulnerability reports automatically sent to Slack and GitHub.”

✅ Currently provides integration to Slack. Other notifications easy to add.

### 6. **Security Baseline Across Repos**
> “As a platform team, I want a reusable, uniform scanning standard across all projects.”

✅ The toolkit provides opinionated, versioned workflows and local development scripts you can apply with varying levels of enforcement.

---

## Architecture

```
gh-security-toolkit/
├─ actions/
│  ├─ scanner/        # Builds, runs Trivy & Syft, produces JSON & SBOM
│  ├─ summarizer/     # Parses and formats vulnerability summaries
│  ├─ diff/           # Compares results to previous release
│  └─ publisher/      # Uploads results, manages GitHub Releases & notifications
│
├─ .github/workflows/
│  ├─ nightly-scan.yml
│  └─ security-diff.yml
│
├─ scripts/
│  ├─ trivy_summarize.java
│  ├─ sbom_diff.java
│  └─ notify_slack.java
│
├─ cli/
│  ├─ Dockerfile
│  └─ entrypoint.sh
│
├─ Makefile
├─ LICENSE
└─ README.md
```

---

## Features

* Trivy + Syft integration with full caching and layer attribution
* JSON + Markdown summaries (for both local and GHA use)
* Historical diffing via GitHub Releases
* Slack / Release / Console notifications
* Built-in SBOM generation and comparison
* Simple local runner via make trivy/fs or jbang

---

## Philosophy

* Extensible: Each stage (scan, summarize, diff, publish) is an independent Action.
* Composable: Opinionated workflows provided, but also usable piecemeal.
* Self-contained: Uses GitHub-native caching and releases for persistence — no external storage required.

---

## Examples

### Local scan via Makefile

```
make trivy/image
make trivy/fs
```

Or via JBang directly:

```
jbang scripts/trivy_summarize.java .trivy-output/trivy-results.json 50 .trivy-output
```

### GitHub Workflow

```
name: Nightly Security Scan
on:
  schedule:
    - cron: '0 2 * * *'

jobs:
  scan:
    uses: avarko/gh-security-toolkit/.github/workflows/nightly-scan.yml@v1
    with:
      branch: main
      channel-retention: "180d"
      slack-webhook: ${{ secrets.SLACK_WEBHOOK_URL }}
```

---

## License

MIT License — feel free to fork, extend, and reuse.