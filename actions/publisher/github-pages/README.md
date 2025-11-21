# GitHub Pages Publisher

Publishes security scan results and test reports as static HTML pages to GitHub Pages.

> **🔒 Security**: This action **requires Private Pages** (GitHub Enterprise Cloud). It will verify Pages visibility before deployment and **refuse to publish** if Pages is configured as public.

## Features

- 📄 **Static HTML pages** - No build step, instant deployment
- 📊 **Organized by channel** - Separate scan histories for different environments
- 🔍 **Interactive viewing** - Browse all scans with timestamp-based navigation
- 📦 **Retention management** - Automatically cleans up old scans
- 🔒 **Private Pages enforced** - Refuses to deploy to public Pages sites

## Structure

```
/                                          # GitHub Pages root (repository root)
├── index.html                            # Main page (all channels)
├── 404.html                              # Error page
├── assets/                               # Static assets
└── data/
    └── <tenant-uuid>/
        ├── hist/
        │   └── scan-history.json         # Versioned history (v2)
        └── runs/
            └── nightly-master/
                ├── 2025-11-07-033946Z/
                │   ├── scan-metadata.json
                │   ├── trivy-fs-results.json
                │   ├── trivy-image-results.json
                │   └── semgrep-results.json
                └── 2025-11-07-101234Z/
                    └── ...
```

## Usage

### Basic Example

The publisher reads all metadata from `scan-context.json` in the outdir. This file is automatically created by the artifact upload actions.

```yaml
- name: Publish to GitHub Pages
  uses: Avarko/gh-security-toolkit/actions/publisher/github-pages@main
  with:
    github_token: ${{ github.token }}
    outdir: scan-output
    # Channel and all metadata come from scan-context.json in outdir
```

### Prerequisites

The `outdir` must contain a `scan-context.json` file with at minimum:

```json
{
  "channel": "nightly",
  "timestamp": "2025-11-21-120000Z"
}
```

This file is automatically created by the composite actions:
- `actions/security-scan` - Creates scan-context.json with security scan metadata
- `actions/publish-test-reports` - Creates scan-context.json with test report metadata

### Configure GitHub Pages

**⚠️ Important**: This publisher will **refuse to deploy** if Pages is configured as public.

1. Go to repository **Settings** → **Pages**
2. **Source**: GitHub Actions (this is set automatically)
3. **Visibility**: Select **"Private"** (GitHub Enterprise Cloud only)
   - ✅ **Private**: Only organization members can access
   - ❌ **Public**: Action will fail with error message

**If you don't have GitHub Enterprise Cloud:**
- Private Pages is not available on GitHub.com (free)
- Use `publish_to: "github-release"` instead

### Permissions required

```yaml
permissions:
  contents: write
  pages: write
  id-token: write
```

## Inputs

### Required Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `github_token` | GitHub token for artifact operations (use `${{ github.token }}`) | - |
| `outdir` | Directory containing scan outputs and `scan-context.json` | - |

### Optional Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `config_overrides` | Reserved for future use | `""` |

### Metadata from scan-context.json

All metadata is read from `scan-context.json` in the outdir:

| Field | Description | Required |
|-------|-------------|----------|
| `channel` | Channel name for organizing scans (e.g., `nightly`, `pr-123`) | **Yes** |
| `timestamp` | Scan timestamp | No (auto-generated if missing) |
| `branch` | Git branch name | No |
| `repository` | Repository name (owner/repo) | No |
| `commitSha` | Git commit SHA | No |
| `scanId` | CI run ID | No |
| `ciJobName` | CI workflow name | No |
| `ciJobUrl` | Link to CI job | No |
| `actorName` | User who triggered the workflow | No |

## Outputs

| Output | Description |
|--------|-------------|
| `pages_url` | URL to the GitHub Pages site |

## Artifact Storage

This action stores the entire GitHub Pages site data (all channels, all tenants) in a single artifact named `__gh_security_toolkit__github_pages_site_data` with a 90-day retention period. This artifact is downloaded and restored on each run to maintain scan history across deployments.

## Comparison: GitHub Pages vs GitHub Releases

| Feature | GitHub Pages | GitHub Releases |
|---------|--------------|-----------------|
| **No Git tags** | ✅ Yes | ❌ No (creates tags) |
| **Private access** | ✅ Yes (Enterprise required) | ✅ Yes |
| **Security check** | ✅ Enforced (fails if public) | ⚠️ Best-effort |
| **UI/UX** | ✅ Better (HTML pages) | ⚠️ Basic (release list) |
| **Retention** | ✅ File-based cleanup | ✅ API-based cleanup |
| **History view** | ✅ All scans on one site | ⚠️ Separate releases |
| **Setup complexity** | ⚠️ Requires Pages + Enterprise | ✅ Works immediately |

## Examples

### Security scans (via composite action)

```yaml
# Single job with build and scan - no artifact upload/download needed
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
        uses: Avarko/gh-security-toolkit/actions/security-scan@reactui
        with:
          channel: nightly
          filesystem_path: .
          docker_image_ref: myapp:${{ github.sha }}
          publish_to: github-pages
```

### Test reports

```yaml
      - name: Run tests with coverage
        run: mvn test jacoco:report surefire-report:report

      - name: Publish test reports
        uses: Avarko/gh-security-toolkit/actions/publish-test-reports@reactui
        with:
          channel: ci
          jacoco_report_path: target/site/jacoco
          surefire_report_path: target/site/surefire-report
```

## Developer Notes

The static HTML is generated by `scripts/github_pages_builder.java` using:
- **JBang** for scripting
- **Gson** for JSON parsing
- **React** dashboard (built separately)

### Configuration JSON Structure

The builder accepts a single JSON configuration file (created by `create-config.sh` from `scan-context.json`):

```json
{
  "input": {
    "outdir": "./scan-output",
    "pagesRoot": ".",
    "dashboardBuildDir": "${RUNNER_TEMP}/gh-pages-publisher-<run-id>/dashboard-build"
  },
  "metadata": {
    "timestamp": "2025-11-20-120000Z",
    "channel": "test",
    "branch": "main",
    "repository": "owner/repo",
    "commitSha": "abc123",
    "scanId": "123456",
    "ciJobName": "Test",
    "ciJobUrl": "https://github.com/owner/repo/actions/runs/123456",
    "actorName": "username"
  }
}
```

Note: The `dashboardBuildDir` path uses `RUNNER_TEMP` with unique identifiers to avoid collisions when multiple actions run in the same workflow.

### Timestamp Format

The builder supports URL-friendly timestamp format (recommended):
- `2025-11-21-055532Z` → `20251121-055532`
- ISO 8601 is also supported: `2025-11-19T17:56:24Z` → `20251119-175624`

### Scan History Retention

Scan history is automatically limited to **500 entries** per tenant. When the limit is exceeded, the oldest entries are removed.
