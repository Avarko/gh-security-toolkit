# Dashboard Testing Workflows

This directory contains workflows for testing the React+Remix dashboard migration.

## Workflows

### 1. `publish-dashboard.yml` (Reusable)
**Purpose**: Publish only the dashboard to GitHub Pages without running scans.

**Use case**: For client repos that want to test the new dashboard with their existing scan data.

**Usage in client repo**:
```yaml
name: Test Dashboard

on:
  workflow_dispatch:

jobs:
  test-dashboard:
    uses: Avarko/gh-security-toolkit/.github/workflows/publish-dashboard.yml@reactui
    permissions:
      contents: write
      pages: write
      id-token: write
      actions: read
    with:
      channel: main  # Your channel name
      use_existing_scans: true  # Use existing scan history
```

**Inputs**:
- `channel` (required): Channel name
- `use_existing_scans` (optional, default: true): Use existing scan history or create placeholder
- `retention_keep` (optional, default: 10): Scans to keep per channel
- `retention_days` (optional, default: 30): Artifact retention days

**What it does**:
1. Checks out your client repository
2. Downloads existing scan history artifact (if `use_existing_scans: true`)
3. Builds React+Remix dashboard (GitHub Actions automatically downloads toolkit action)
4. Merges dashboard with existing scan data
5. Publishes to your GitHub Pages

**Benefits**:
- ✅ Fast (~1-2 minutes vs full scan ~5-10 minutes)
- ✅ Uses your real existing scan data
- ✅ Tests dashboard rendering without re-scanning
- ✅ Perfect for UI iteration

---

### 2. `rebuild-dashboard.yml` (Manual Trigger)
**Purpose**: One-click dashboard rebuild for this toolkit repo.

**Use case**: Quick testing during dashboard development.

**Usage**:
1. Go to Actions → Rebuild Dashboard (Test)
2. Click "Run workflow"
3. Enter channel name
4. Optionally specify a timestamp

**What it does**:
1. Creates minimal empty scan data
2. Builds and publishes dashboard
3. Shows summary with Pages URL

---

## Testing Strategy

### For Client Repos (Recommended)
Use `publish-dashboard.yml` reusable workflow:

```yaml
# .github/workflows/test-dashboard.yml
name: Test New Dashboard

on:
  workflow_dispatch:

jobs:
  test:
    uses: Avarko/gh-security-toolkit/.github/workflows/publish-dashboard.yml@reactui
    permissions:
      contents: write
      pages: write
      id-token: write
      actions: read
    with:
      channel: main
```

**Steps**:
1. Add workflow file to your repo
2. Run workflow from Actions tab
3. Check GitHub Pages to see dashboard
4. Iterate on dashboard code in toolkit repo
5. Re-run workflow to test changes

### For Toolkit Development
Use `rebuild-dashboard.yml` for quick iterations:

1. Make changes to `dashboard/app/routes/*.tsx`
2. Commit and push to `reactui` branch
3. Go to Actions → Rebuild Dashboard (Test)
4. Run workflow
5. Check results

---

## Comparison: Full Scan vs Dashboard-Only

| Feature | Full `security-scan.yml` | `publish-dashboard.yml` |
|---------|-------------------------|-------------------------|
| Duration | ~5-10 minutes | ~1-2 minutes |
| Runs scanners | ✅ Yes (Trivy, Semgrep) | ❌ No |
| Updates scan data | ✅ Yes | ❌ No (uses existing) |
| Builds dashboard | ✅ Yes | ✅ Yes |
| Publishes Pages | ✅ Yes | ✅ Yes |
| Use case | Production scans | Dashboard testing |

---

## Example Client Workflow

```yaml
# In your client repo: .github/workflows/test-dashboard.yml
name: Test Security Dashboard

on:
  workflow_dispatch:
    inputs:
      channel:
        description: 'Channel to rebuild for'
        type: choice
        options:
          - main
          - develop
          - staging
        default: main

jobs:
  rebuild-dashboard:
    name: Rebuild Dashboard UI
    uses: Avarko/gh-security-toolkit/.github/workflows/publish-dashboard.yml@reactui
    permissions:
      contents: write
      pages: write
      id-token: write
      actions: read
    with:
      channel: ${{ inputs.channel }}
      use_existing_scans: true
      retention_keep: 10
```

**Result**: Dashboard is rebuilt with all your existing scan history intact, ready to view in ~2 minutes.
