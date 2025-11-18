# Dashboard Builder Action

Builds the React+Remix security dashboard SPA from `dashboard/` directory.

## Usage

```yaml
- name: Build Dashboard
  uses: ./.github/workflows/actions/dashboard
  with:
    node-version: '24'  # Optional, defaults to 24
```

## Outputs

- **artifact-name**: `security-dashboard-build` - Name of the uploaded artifact containing `dist/` static files

## Build Process

1. Setup Node.js (default: v24)
2. Install dependencies (`npm ci`)
3. Build Remix app in SPA mode (`npm run build`)
4. Upload `dist/` as artifact

## Integration

This action is called **before** the data builder in the main publisher workflow. The dashboard artifact is then merged with the `/data` directory by `GitHubPagesBuilder.java` to create the final GitHub Pages package.
