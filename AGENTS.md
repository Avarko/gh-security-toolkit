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

## Repository Structure

```
gh-security-toolkit/
├── .github/workflows/          # Reusable workflows
│   └── security-scan.yml       # Main workflow (called by client repos)
├── actions/
│   ├── scanner/                # Security scanners
│   │   ├── trivy/              # Trivy (vulnerabilities + misconfigs)
│   │   ├── semgrep/            # Semgrep (SAST)
│   │   └── dependabot/         # Dependabot alerts fetcher
│   ├── summarizer/             # Aggregates scan results
│   ├── publisher/
│   │   ├── github-release/     # Publishes to GitHub Releases
│   │   └── github-pages/       # Publishes to GitHub Pages + builds dashboard
│   ├── uploader/               # Upload artifacts for scanning
│   │   ├── filesystem/         # Upload filesystem for scanning
│   │   └── docker-image/       # Upload Docker image tar
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
    ├── GitHubPagesBuilder.java     # Main entry point
    ├── model/                      # Data models (Java ↔ TypeScript)
    │   ├── ScanHistory.java        # scan-history.json root
    │   ├── HistoryEntry.java       # Single scan entry
    │   ├── HistoryStats.java       # TypeScript-compatible stats
    │   ├── ScanStats.java          # Internal stats representation
    │   └── ScanMetadata.java       # Scan metadata
    ├── loader/                     # Load scan results from JSON
    └── transformer/                # Transform + aggregate findings
```

## Data Flow Architecture

### 1. Client Repository Workflow

```yaml
# client-repo/.github/workflows/security.yml
jobs:
  prepare:
    - Upload filesystem artifact
    - Upload Docker image artifact

  scan:
    uses: Avarko/gh-security-toolkit/.github/workflows/security-scan.yml@main
    with:
      channel: "manual"
      publish_to: "github-pages"
      retention_keep: 4
      retention_days: 90
```

### 2. Security Scan Workflow (`security-scan.yml`)

```
┌─────────────────────────────────────────────────────────────┐
│ Job: security-scan                                          │
├─────────────────────────────────────────────────────────────┤
│ 1. Download artifacts (filesystem, docker image)           │
│ 2. Run scanners (Trivy, Semgrep, Dependabot)               │
│ 3. Summarize results                                        │
│ 4. Publish to GitHub Release (optional)                     │
│ 5. Publish to GitHub Pages:                                 │
│    ├─ Download _scan_history_<channel> artifact            │
│    ├─ Restore to ./data/<org>/<app>/<repo>/             │
│    ├─ Apply retention (delete old runs)                     │
│    ├─ Build React dashboard                                 │
│    ├─ Run Java: merge new scan + update scan-history.json  │
│    ├─ Upload updated _scan_history_<channel> artifact      │
│    ├─ Upload security-dashboard-pages-<channel> artifact   │
│    └─ Deploy to GitHub Pages                                │
└─────────────────────────────────────────────────────────────┘
```

### 3. GitHub Pages Data Structure

Deployed to `https://<org>.github.io/<repo>/` (Private Pages):

```
/
├── index.html                   # Dashboard SPA entry point
├── assets/
│   └── index-*.js               # Dashboard bundle (~1.6 MB)
├── favicon.ico
├── 404.html
└── data/
    ├── defaults.json            # Tenant config (single-tenant mode)
    └── <org>/<app>/<repo>/      # Tenant data root
        ├── runs/
        │   └── <channel>/
        │       └── <timestamp>/
        │           ├── trivy-fs-results.json      (~285 KB)
        │           ├── trivy-image-results.json   (~1.8 MB)
        │           ├── semgrep-results.json       (~4 KB)
        │           └── scan-metadata.json         (~75 bytes)
        ├── hist/
        │   └── scan-history.json  # ALL scans stats (compact, grows ~1 KB per scan)
        └── channels/              # Reserved for future use
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

#### Artifact 1: `__gh_security_toolkit__multi-tenant-config`

- **Purpose**: Maintains tenant UUID mappings (CRITICAL for GUID persistence!)
- **Contains**: `config/tenant-registry.json`
- **Size**: ~1 KB (tiny, config-only)
- **Retention**: 90 days
- **Cleanup**: Automatic - keeps only 1 newest artifact globally
- **Scope**: Global (shared across all channels)
- **Why needed**: Ensures same GitHub org/repo always gets the same tenant UUID

#### Artifact 2: `__gh_security_toolkit__github_pages_site_data`

- **Purpose**: Carries scan data forward between workflow runs when GitHub Pages is used as backend
- **Contains**: `data/<tenant-uuid>/runs/`, `data/<tenant-uuid>/hist/scan-history.json`
- **Size**: ~400 KB (minimal, data-only)
- **Retention**: 90 days
- **Cleanup**: Automatic - deletes old artifacts after successful upload
- **Scope**: One per whole GitHub Pages
- **Why needed**: GitHub Pages cannot be "downloaded" for incremental updates

**Important**: `upload-artifact@v4`'s `overwrite: true` only works **within a single workflow run**, NOT across runs. Therefore, we implement explicit cleanup using GitHub API after each upload to ensure only the newest artifact exists.

**Workflow**:
```
Run N:   Download artifact → Restore → Add new scan → Upload artifact → Cleanup old artifacts
Run N+1: Download artifact → Restore → Add new scan → Upload artifact → Cleanup old artifacts
```

#### Artifact 2: `__gh_security_toolkit__github_pages_deployment`

- **Purpose**: Temporary artifact for Pages deployment
- **Contains**: Complete site (dashboard + data)
- **Size**: ~1 MB
- **Retention**: 1 day (only needed until deployment succeeds)

#### Artifact 3-5: Temporary workflow artifacts

- `__gh_security_toolkit__filesystem__`: 1 day retention
- `__gh_security_toolkit__docker_image__`: 1 day retention
- `__gh_security_toolkit__security-dashboard-build`: 1 day retention

All used only for passing data between workflow jobs, not persistence.

## Data Models: Java ↔ TypeScript Compatibility

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

**Java must serialize as**:
```json
{
  "channel": "manual",
  "timestamp": "2025-11-18-173823Z",
  "stats": {
    "trivyFsResults": {
      "totalVulnerabilities": { "CRITICAL": 5, "HIGH": 12, "MEDIUM": 20, "LOW": 5 }
    },
    "trivyImageResults": { ... },
    "semgrepResults": { "totalErrors": 3, "totalWarnings": 10, "totalInfos": 5 }
  },
  "metadata": { "branch": "main", "commit": "abc123", "repository": "org/repo" }
}
```

**Critical**: `HistoryStats.from(ScanStats)` handles the Java → TypeScript transformation.

## Retention Policies

### 1. `retention_keep` (Pages data retention)

- **What**: Limits full scan results in `/data/<org>/<app>/<repo>/runs/<channel>/`
- **Default**: 10 scans per channel
- **Why**: Each scan = ~2 MB. Prevents GitHub Pages from growing indefinitely.
- **Note**: `scan-history.json` retains **all** scans (compact stats only).

**Result**: Dashboard shows all history (graphs), but only recent N scans have full JSON detail.

### 2. `retention_days` (Artifact retention)

- **What**: How long GitHub keeps artifacts
- **Scan history artifact**: 90 days (safety margin)
- **Other artifacts**: 1 day (ephemeral)

## Multi-Tenancy

### Single-Tenant Mode (current)

```
/data/<org>/<app>/<repo>/
    └── defaults.json: { "mode": "single-tenant", "defaultOrg": "...", ... }
```

Dashboard auto-detects tenant from `defaults.json`.

### Multi-Tenant Mode (future)

```
/data/
    ├── org1/app1/repo1/
    ├── org1/app1/repo2/
    └── org2/app2/repo1/
```

Dashboard allows tenant selection via URL or dropdown.

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
- uses: Avarko/gh-security-toolkit/actions/builder/dashboard@reactui
  # Outputs artifact: security-dashboard-build
```

### Data Loading

Dashboard fetches data from **same origin**:
```typescript
// dashboard/src/features/scans/api/historyClient.ts
const url = `/data/${org}/${app}/${repo}/hist/scan-history.json`;
const response = await fetch(url);
```

No API backend. Pure static site.

## Future: S3 Backend

When implementing S3 publisher:

1. **No artifacts needed**: S3 allows direct file read/write/modify
2. **Data sync**: `aws s3 sync` replaces artifact download
3. **Dashboard deployment**: Same React build, deploy to S3 bucket
4. **Cross-origin**: May need CORS configuration

```yaml
# Future S3 workflow
- Download from S3: aws s3 sync s3://bucket/data ./data
- Add new scan
- Upload to S3: aws s3 sync ./data s3://bucket/data
```

## Common Pitfalls

### 1. Artifact Overwrite Misconception

**Symptom**: Multiple `__gh_security_toolkit_github_pages_site_data` artifacts accumulate in repository.

**Cause**: `upload-artifact@v4`'s `overwrite: true` **only works within a single workflow run**, NOT across different runs.

**Fix**: Implemented automatic cleanup step using GitHub API (see line 435 in `actions/publisher/github-pages/action.yml`). Deletes all old artifacts with same name after successful upload.

**Why this matters**: Without cleanup, you'd have one artifact per workflow run for 90 days (potentially hundreds of duplicates), wasting storage.

### 2. Missing Stats in scan-history.json

**Symptom**: Dashboard graphs are empty.

**Cause**: `HistoryEntry.stats` is null.

**Fix**: Ensure `GitHubPagesBuilder.java` calls `transformer.extractStats()` and `HistoryStats.from()`.

### 3. Artifact Name Collisions

**Symptom**: `actions/deploy-pages` fails with "Multiple artifacts named 'github-pages'".

**Cause**: Multiple workflow runs create artifacts with same default name.

**Fix**: Use unique names: `security-dashboard-pages-${{ inputs.channel }}`.

### 4. TypeScript Schema Validation Fails

**Symptom**: Dashboard shows "Invalid scan history data".

**Cause**: Java serializes data in wrong format.

**Fix**: Match Java output to TypeScript `scanMetadataSchema` in `historyTypes.ts`. Use Zod error messages for debugging.

### 5. Retention Policy Confusion

**Symptom**: "Where did my old scans go?"

**Cause**: `retention_keep=4` deleted full scan JSONs from `/runs`, but stats remain in `scan-history.json`.

**Clarification**: This is expected. Graphs work, but clicking old scan shows "Data not found".

## Key Files Reference

| File | Purpose | Lines of Interest |
|------|---------|-------------------|
| `.github/workflows/security-scan.yml` | Main workflow | - |
| `actions/publisher/github-pages/action.yml` | Pages publisher | 262-274 (artifact download), 425-431 (artifact upload) |
| `scripts/github_pages_builder.java` | Scan data processor | Entry point (line 59), appendScanHistory (line 170) |
| `src/.../model/HistoryStats.java` | Java stats model | from() method (line 70) |
| `dashboard/src/features/scans/model/historyTypes.ts` | TypeScript schemas | scanMetadataSchema (line 90) |
| `dashboard/src/features/scans/api/historyClient.ts` | Data fetcher | fetchScanHistory (line 38) |

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
curl https://<org>.github.io/<repo>/data/<org>/<app>/<repo>/hist/scan-history.json | jq

# From artifact
gh run download <run-id> -n _gh_security_toolkit_scan_history_manual
tar -xzf scan-history.tar.gz
cat data/<org>/<app>/<repo>/hist/scan-history.json | jq
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

**Last updated**: 2025-11-18
**Maintainers**: evolver
**Questions**: See GitHub Issues or README.md
