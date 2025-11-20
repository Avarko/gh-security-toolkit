# GitHub Pages Publisher

Publishes security scan results as static HTML pages to GitHub Pages.

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
    ├── hist/
    │   └── scan-history.json             # Versioned history (v2)
    ├── channels/
    │   └── nightly-master/
    │       └── index.html                # Channel page (all runs)
    └── runs/
        └── nightly-master/
            ├── 2025-11-07-033946Z/
            │   ├── index.html            # Scan detail page
            │   ├── scan-metadata.json
            │   ├── trivy-fs-results.json
            │   ├── trivy-image-results.json
            │   └── semgrep-results.json
            └── 2025-11-07-101234Z/
                └── ...
```

## Usage

### Basic Example (Minimal)

```yaml
- name: Publish to GitHub Pages
  uses: Avarko/gh-security-toolkit/actions/publisher/github-pages@main
  with:
    github_token: ${{ github.token }}
    outdir: scan-output
    channel: nightly
    # That's it! All metadata is auto-detected from GitHub Actions environment
```

### With Branding Customization

```yaml
- name: Publish to GitHub Pages
  uses: Avarko/gh-security-toolkit/actions/publisher/github-pages@main
  with:
    github_token: ${{ github.token }}
    outdir: scan-output
    channel: nightly
    config_overrides: |
      {
        "branding": {
          "displayName": "VR CIAM Backend",
          "orgDisplayName": "VR Group",
          "logoUrl": "/assets/vr-logo.png"
        }
      }
```

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
| `outdir` | Directory containing scan outputs and scan-metadata.json | - |
| `channel` | Channel name for organizing scans (e.g., `nightly`, `pr-123`) | - |

### Optional Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `config_overrides` | JSON string with branding and configuration overrides | `""` |

### Auto-Detected Metadata

The following metadata is **automatically detected** from GitHub Actions environment and no longer needs to be passed as inputs:

- **timestamp** - Auto-generated using current UTC time
- **branch** - From `GITHUB_REF_NAME`
- **repository** - From `GITHUB_REPOSITORY`
- **commit_sha** - From `GITHUB_SHA`
- **scan_id** - From `GITHUB_RUN_ID`
- **ci_job_name** - From `GITHUB_WORKFLOW`
- **ci_job_url** - Auto-constructed from environment variables
- **actor_name** - From `GITHUB_ACTOR`

### Scanner-Specific Metadata

The following metadata should be included in `scan-metadata.json` within your scan output directory (created by your scanner):

```json
{
  "scanType": "security",
  "scanners": {
    "trivy": {
      "version": "0.48.0",
      "scanDate": "2025-11-20T12:34:56Z"
    },
    "semgrep": {
      "version": "1.55.0",
      "scanDate": "2025-11-20T12:35:12Z"
    }
  },
  "target": {
    "type": "docker-image",
    "imageName": "ghcr.io/org/app:latest"
  },
  "links": {
    "documentation": "https://docs.example.com",
    "issues": "https://github.com/org/repo/issues"
  }
}
```

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

### Use both publishers

```yaml
inputs:
  publish_to: 'github-release,github-pages'  # Publish to both
```

### Multiple channels

```yaml
- name: Publish nightly scans
  uses: Avarko/gh-security-toolkit/actions/publisher/github-pages@main
  with:
    github_token: ${{ github.token }}
    outdir: scan-output
    channel: nightly

- name: Publish PR scans
  uses: Avarko/gh-security-toolkit/actions/publisher/github-pages@main
  with:
    github_token: ${{ github.token }}
    outdir: scan-output
    channel: pr-${{ github.event.pull_request.number }}
```

## Developer Notes

The static HTML is generated by `scripts/github_pages_builder.java` using:
- **JBang** for scripting
- **Gson** for JSON parsing
- **React + Remix** dashboard (built separately)

### Configuration JSON Structure

The builder now accepts a single JSON configuration file instead of multiple positional parameters:

```bash
# Create a config file
cat > /tmp/config.json <<EOF
{
  "input": {
    "outdir": "./scan-output",
    "pagesRoot": ".",
    "dashboardBuildDir": "/tmp/dashboard-build"
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
  },
  "branding": {
    "displayName": "My App",
    "orgDisplayName": "My Org",
    "logoUrl": "/logo.png"
  }
}
EOF

# Run builder
jbang scripts/github_pages_builder.java /tmp/config.json
```

### Migration Notes

**Old way (deprecated):** Passing 9+ positional parameters
**New way:** Single JSON config file with auto-detected metadata

This change enables:
- Type-safe configuration
- Easier TypeScript migration
- Shared type definitions with dashboard
- No more positional parameter ordering issues
