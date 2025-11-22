# gh-security-toolkit Architecture Guide

> **Audience**: LLM agents and AI assistants working with this codebase
> **Purpose**: Comprehensive architectural overview for code understanding and modification

## Overview

**gh-security-toolkit** is a GitHub Actions-based security scanning framework that:
- Runs security scans (Trivy, Semgrep, Dependabot) on Docker images and filesystems
- Publishes results to GitHub Releases and/or GitHub Pages
- Provides a React dashboard for visualizing scan history with Apache ECharts
- Uses GitHub Actions Artifacts and GitHub Pages as persistence layer (no traditional database)

## Core Concept: Channels

**Channels** are isolated scan streams identified by a string name (e.g., `manual`, `nightly`, `pr-123`). Each channel:
- Has independent scan history
- Can be configured with different retention policies
- Appears as a separate timeline in the dashboard

## Client Configuration System

### Configuration File

Client repositories can customize toolkit behavior via `.gh-security-toolkit/config.yaml`:

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
    config: ".trivy.yaml"
    severity: "MEDIUM,HIGH,CRITICAL"
  semgrep:
    configs:
      - "p/owasp-top-ten"
      - "p/java"

publishing:
  retention_keep: 20
  retention_days: 90
```

### Configuration Priority (highest to lowest)

```
1. Action inputs          → Workflow-specific overrides
2. .gh-security-toolkit/  → Repository-level config
   └── config.yaml
3. Native tool configs    → .trivy.yaml, .trivyignore, .semgrepignore
4. Toolkit defaults       → Built-in default values
```

### Data Flow: Config to Dashboard

```
1. security-scan action reads .gh-security-toolkit/config.yaml
2. Values merged with action inputs (inputs take priority)
3. Org metadata written to scan-context.json
4. create-config.sh extracts org metadata into builder-config.json
5. GitHubPagesBuilder.java passes to TenantResolver.resolve()
6. TenantRegistry updates tenant-registry.json with display names
7. Dashboard reads tenant-registry.json and displays org branding
```

## Repository Structure

```
gh-security-toolkit/
├── actions/
│   ├── security-scan/          # Main composite action for security scanning
│   │   └── action.yml          # Reads config, runs Trivy, Semgrep, publishes
│   ├── publish-test-reports/   # Composite action for test reports
│   │   └── action.yml          # Publishes JaCoCo/Surefire to GitHub Pages
│   ├── scanner/                # Security scanners
│   │   ├── trivy/              # Trivy (vulnerabilities + misconfigs)
│   │   ├── semgrep/            # Semgrep (SAST)
│   │   └── dependabot/         # Dependabot alerts fetcher
│   ├── summarizer/             # Aggregates scan results
│   ├── publisher/
│   │   ├── github-release/     # Publishes to GitHub Releases
│   │   └── github-pages/       # Publishes to GitHub Pages + builds dashboard
│   │       └── scripts/
│   │           └── create-config.sh  # Creates builder-config.json with org metadata
│   ├── builder/
│   │   └── dashboard/          # Builds React dashboard SPA
│   └── cleanup/                # Cleanup old releases/artifacts
├── dashboard/                  # React + TypeScript SPA
│   ├── src/
│   │   ├── features/scans/     # Scan visualization logic
│   │   │   ├── model/historyTypes.ts  # Zod schemas for scan-history.json
│   │   │   ├── charts/         # ECharts configurations
│   │   │   └── api/            # Data fetching from /data/*
│   │   └── lib/dataPath.ts     # Tenant path resolution
│   └── vite.config.ts
├── scripts/
│   └── github_pages_builder.java  # JBang script: processes scan data
└── src/main/java/fi/evolver/secops/githubPages/
    ├── GitHubPagesBuilder.java     # Main entry point (passes org metadata to TenantResolver)
    ├── ConfigParser.java           # Parses builder-config.json (includes org metadata)
    ├── TenantResolver.java         # Resolves tenant with optional display metadata
    ├── TenantRegistry.java         # Manages tenant UUID mappings + display names
    ├── model/                      # Data models (Java <-> TypeScript)
    │   ├── ScanHistory.java        # scan-history.json root
    │   ├── HistoryEntry.java       # Single scan entry
    │   ├── HistoryStats.java       # TypeScript-compatible stats
    │   ├── ScanStats.java          # Internal stats representation
    │   └── ScanMetadata.java       # Scan metadata
    ├── loader/                     # Load scan results from JSON
    └── transformer/                # Transform + aggregate findings
```

### Client Repository Structure (example)

```
my-app/
├── .gh-security-toolkit/
│   └── config.yaml             # Client configuration (org branding, defaults)
├── .trivy.yaml                 # Native Trivy config (optional)
├── .semgrepignore              # Native Semgrep ignores (optional)
├── .github/
│   └── workflows/
│       └── security.yml        # Workflow using security-scan action
└── src/
```

## Data Flow Architecture

### 1. Client Repository Workflow (New Architecture)

The security scan runs as a **composite action in the same job** as the build. No artifact upload/download needed:

```yaml
# client-repo/.github/workflows/security.yml
jobs:
  build-and-scan:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pages: write
      id-token: write
      actions: read
    steps:
      - uses: actions/checkout@v4

      - name: Build Docker image
        run: docker build -t myapp:${{ github.sha }} .

      - name: Security scan
        uses: Avarko/gh-security-toolkit/actions/security-scan@main
        with:
          channel: "manual"
          filesystem_path: .
          docker_image_ref: myapp:${{ github.sha }}
          publish_to: "github-pages"
```

### 2. Security Scan Action Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Composite Action: actions/security-scan                      │
├─────────────────────────────────────────────────────────────┤
│ 1. Setup directories                                         │
│ 2. Validate channel name                                     │
│ 3. Create scan-context.json metadata                         │
│ 4. Run Trivy scanner:                                        │
│    ├─ Filesystem scan (if filesystem_path provided)          │
│    └─ Image scan (if docker_image_ref provided)              │
│ 5. Run Semgrep scanner (if filesystem_path provided)         │
│ 6. Summarize results                                         │
│ 7. Publish to GitHub Release (if enabled)                    │
│ 8. Publish to GitHub Pages:                                  │
│    ├─ Download scan history artifact                         │
│    ├─ Restore to ./data/<tenant-uuid>/                       │
│    ├─ Apply retention (delete old runs)                      │
│    ├─ Build React dashboard                                  │
│    ├─ Run Java: merge new scan + update scan-history.json    │
│    ├─ Upload updated scan history artifact                   │
│    ├─ Upload security-dashboard-pages artifact               │
│    └─ Deploy to GitHub Pages                                 │
└─────────────────────────────────────────────────────────────┘
```

### 3. Key Architectural Change: No Artifact Upload/Download for Scan Targets

**Previous architecture** (reusable workflow):
```
Job 1 (build):
  - Build app
  - Upload filesystem artifact
  - Upload Docker image tar artifact

Job 2 (security-scan workflow):
  - Download filesystem artifact
  - Download Docker image tar artifact
  - docker load -i image.tar
  - Run scans
  - Publish results
```

**New architecture** (composite action):
```
Single Job (build-and-scan):
  - Build app
  - Build Docker image (stays in local daemon)
  - Run security-scan action:
    - Pass filesystem_path directly
    - Pass docker_image_ref directly (no tar needed!)
    - Run scans
    - Publish results
```

**Benefits:**
- No artifact upload/download overhead
- No tar packing/unpacking for Docker images
- Faster execution (single job)
- Simpler workflow configuration
- Docker image is scanned directly from daemon

### 4. GitHub Pages Data Structure

Deployed to `https://<org>.github.io/<repo>/` (Private Pages):

```
/
├── index.html                   # Dashboard SPA entry point
├── assets/
│   └── index-*.js               # Dashboard bundle (~1.6 MB)
├── favicon.ico
├── 404.html
└── data/
    ├── hist/
    │   ├── scan-history.json        # ALL scans stats (compact, grows ~1 KB per scan)
    │   └── test-report-history.json # Test reports (optional)
    └── runs/
        └── <channel>/
            └── <timestamp>/
                ├── scan-run.json              (~75 bytes)
                ├── trivy-fs-results.json      (~285 KB)
                ├── trivy-image-results.json   (~1.8 MB)
                └── semgrep-results.json       (~4 KB)
```

## Critical Architecture Pattern: GitHub Artifacts as Persistence

### Problem

GitHub Pages API does not support:
- Downloading current deployed content
- Incremental updates (append-only)
- Modifying individual files

Every `actions/deploy-pages@v4` call **replaces the entire site**.

### Solution: Artifact-Based Persistence

We use **GitHub Actions Artifacts** as a "database" to maintain state between workflow runs:

#### Artifact: `__gh_security_toolkit__github_pages_site_data`

- **Purpose**: Carries scan data forward between workflow runs
- **Contains**: `data/runs/`, `data/hist/scan-history.json`
- **Size**: ~400 KB (minimal, data-only)
- **Retention**: 90 days
- **Scope**: One per repository's GitHub Pages
- **Why needed**: GitHub Pages cannot be "downloaded" for incremental updates

**Workflow**:
```
Run N:   Download artifact -> Restore -> Add new scan -> Upload artifact -> Cleanup old
Run N+1: Download artifact -> Restore -> Add new scan -> Upload artifact -> Cleanup old
```

## Trivy Scanner: docker_image_ref Input

The Trivy scanner accepts a **Docker image reference** (name:tag) directly, not a tar file:

```yaml
inputs:
  docker_image_ref:
    description: "Docker image reference (name:tag or ID) to scan. Must exist in local Docker daemon."
    required: false
    default: ""
```

This works because:
1. Composite action runs in the same job as the build
2. Docker daemon is shared across all steps in a job
3. Image built in step N is available in step N+1 without any transfer

Example:
```yaml
- name: Build image
  run: docker build -t myapp:latest .

- name: Security scan
  uses: Avarko/gh-security-toolkit/actions/security-scan@main
  with:
    docker_image_ref: myapp:latest  # Trivy scans this directly
```

## Data Models: Java <-> TypeScript Compatibility

### scan-history.json Schema

**Java produces** (`HistoryEntry.java`):
```java
public class HistoryEntry {
    public String channel;
    public String timestamp;  // "2025-11-18-173823Z"
    public HistoryStats stats;
    public HistoryMetadata metadata;
}
```

**TypeScript expects** (`historyTypes.ts`):
```typescript
{
  channel: string;
  timestamp: string;
  metadata: { branch: string; commit: string; repository: string };
  trivyFsResults?: { totalVulnerabilities: Record<string, number> };
  trivyImageResults?: { totalVulnerabilities: Record<string, number> };
  semgrepResults?: { totalErrors: number; totalWarnings: number; totalInfos: number };
}
```

**Critical**: `HistoryStats.from(ScanStats)` handles the Java -> TypeScript transformation.

## Retention Policies

### 1. `retention_keep` (Pages data retention)

- **What**: Limits full scan results in `/data/runs/<channel>/`
- **Default**: 10 scans per channel
- **Why**: Each scan = ~2 MB. Prevents GitHub Pages from growing indefinitely.
- **Note**: `scan-history.json` retains **all** scans (compact stats only).

**Result**: Dashboard shows all history (graphs), but only recent N scans have full JSON detail.

### 2. `retention_days` (Artifact retention)

- **What**: How long GitHub keeps artifacts
- **Scan history artifact**: 90 days (safety margin)
- **Other artifacts**: 1 day (ephemeral)

## Data Structure (GitHub Pages)

```
/data/
├── hist/
│   ├── scan-history.json       # Security scans history
│   └── test-report-history.json # Test reports history (optional)
└── runs/
    └── <channel>/<timestamp>/  # e.g., manual/20251121-161415
        ├── scan-run.json
        ├── trivy-fs-results.json
        ├── trivy-image-results.json
        └── semgrep-results.json
```

- Data stored directly at `/data/`
- URL structure: `/security-scans/channel/:channel/run/:timestamp`

## GitHub Pages Deployment

### Private Pages Requirement

**Security scans MUST use Private Pages** (GitHub Enterprise Cloud only).

Workflow validates:
```bash
gh api /repos/$REPO/pages | jq -r '.public'
# Must be 'false', else deployment fails
```

### Deployment Process

```
1. actions/configure-pages@v5       # Setup Pages metadata
2. actions/upload-pages-artifact@v3 # Upload site as .tar artifact
3. actions/deploy-pages@v4          # Deploy to Pages backend (not gh-pages branch)
```

**Note**: Does NOT use `gh-pages` branch. Uses Pages API directly.

## Building Dashboard

### Local Development

```bash
cd dashboard
npm install
npm run dev    # http://localhost:5173
npm run build  # Output: dashboard/dist/
```

### Production Build (in workflow)

```yaml
- uses: Avarko/gh-security-toolkit/actions/builder/dashboard@main
  # Outputs artifact: security-dashboard-build
```

### Data Loading

Dashboard fetches data from **same origin**:
```typescript
// dashboard/src/features/scans/api/historyClient.ts
const url = `/data/hist/scan-history.json`;
const response = await fetch(url);
```

No API backend. Pure static site.

## Common Pitfalls

### 1. Artifact Overwrite Misconception

**Symptom**: Multiple `__gh_security_toolkit_github_pages_site_data` artifacts accumulate.

**Cause**: `upload-artifact@v4`'s `overwrite: true` **only works within a single workflow run**, NOT across runs.

**Fix**: Implemented automatic cleanup using GitHub API after successful upload.

### 2. Missing Stats in scan-history.json

**Symptom**: Dashboard graphs are empty.

**Cause**: `HistoryEntry.stats` is null.

**Fix**: Ensure `GitHubPagesBuilder.java` calls `transformer.extractStats()` and `HistoryStats.from()`.

### 3. TypeScript Schema Validation Fails

**Symptom**: Dashboard shows "Invalid scan history data".

**Cause**: Java serializes data in wrong format.

**Fix**: Match Java output to TypeScript `scanMetadataSchema` in `historyTypes.ts`. Use Zod error messages for debugging.

### 4. Retention Policy Confusion

**Symptom**: "Where did my old scans go?"

**Cause**: `retention_keep=4` deleted full scan JSONs from `/runs`, but stats remain in `scan-history.json`.

**Clarification**: This is expected. Graphs work, but clicking old scan shows "Data not found".

## Key Files Reference

| File | Purpose |
|------|---------|
| `actions/security-scan/action.yml` | Main composite action (reads client config) |
| `actions/publish-test-reports/action.yml` | Test reports composite action |
| `actions/scanner/trivy/action.yml` | Trivy scanner (filesystem + image) |
| `actions/scanner/semgrep/action.yml` | Semgrep SAST scanner |
| `actions/publisher/github-pages/action.yml` | Pages publisher |
| `actions/publisher/github-pages/scripts/create-config.sh` | Builder config creator (extracts org metadata) |
| `scripts/github_pages_builder.java` | Scan data processor (entry point) |
| `src/.../ConfigParser.java` | Builder config parser (includes org metadata) |
| `src/.../GitHubPagesBuilder.java` | Main builder (single-tenant mode) |
| `src/.../DataProcessor.java` | Processes scan data and writes to data root |
| `src/.../model/HistoryStats.java` | Java stats model |
| `dashboard/src/config/tenantMode.ts` | Data path configuration |
| `dashboard/src/router/singleTenantRouter.tsx` | Router configuration |
| `dashboard/src/features/scans/model/historyTypes.ts` | TypeScript schemas |
| `dashboard/src/features/scans/api/historyClient.ts` | Data fetcher

## Testing

### Local Dashboard Test

```bash
# Generate test data
./scripts/generate-test-scan-history.sh

# Start dev server
cd dashboard && npm run dev

# Navigate to http://localhost:5173
```

### Workflow Test

```bash
# Trigger from client repo
gh workflow run security.yml -f channel=test-$(date +%s)
```

## Debugging

### View scan-history.json

```bash
# From deployed Pages
curl https://<org>.github.io/<repo>/data/<tenant-uuid>/hist/scan-history.json | jq

# From artifact
gh run download <run-id> -n __gh_security_toolkit__github_pages_site_data
tar -xzf site-data.tar.gz
cat data/<tenant-uuid>/hist/scan-history.json | jq
```

### Validate TypeScript Schema

```bash
cd dashboard
npm run test -- historyTypes.test.ts
```

## Performance Considerations

- Each scan: ~2 MB (mostly trivy-image-results.json)
- Dashboard bundle: ~1.6 MB (includes ECharts)
- GitHub Pages soft limit: ~1 GB (performance degrades beyond)
- Recommendation: `retention_keep <= 10` per channel

## Security Notes

- **Private Pages required**: Prevents public exposure of vulnerability data
- **No secrets in artifacts**: Artifacts inherit repo visibility
- **CORS**: Not needed (same-origin fetch)
- **Zod validation**: Protects dashboard from malformed/malicious JSON

---

**Last updated**: 2025-11-21
**Version**: Added client configuration system (.gh-security-toolkit/config.yaml)
**Maintainers**: evolver
**Questions**: See GitHub Issues or README.md
