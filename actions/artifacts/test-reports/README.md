# Test Reports Actions

GitHub Actions for collecting, uploading, and deploying JaCoCo code coverage and Surefire test reports.

## Overview

These actions help you:
- **Upload** JaCoCo coverage reports and Surefire test reports as artifacts
- **Download** test reports for deployment or further processing
- **Deploy** test reports to GitHub Pages alongside your dashboard

## Actions

### 📤 upload

Collects JaCoCo and Surefire reports and uploads them as a GitHub Actions artifact.

```yaml
- uses: ./actions/artifacts/test-reports/upload
  with:
    jacoco-report-path: target/site/jacoco
    surefire-report-path: target/site/surefire-report
    artifact-name: test-reports
    retention-days: 30
```

**Inputs:**
- `jacoco-report-path` - Path to JaCoCo HTML report directory (optional)
- `surefire-report-path` - Path to Surefire HTML report directory (optional)
- `artifact-name` - Name of the artifact (default: `test-reports`)
- `retention-days` - Retention period in days (default: `30`)
- `custom-index-html` - Optional custom landing page HTML file

**Outputs:**
- `artifact-name` - Name of the uploaded artifact
- `has-jacoco` - Whether JaCoCo report was included
- `has-surefire` - Whether Surefire report was included

**Created Structure:**
```
artifact/
├── index.html        # Landing page with links to reports
├── coverage/         # JaCoCo HTML reports
│   └── index.html
└── tests/            # Surefire HTML reports
    └── index.html
```

### 📥 download

Downloads test reports artifact for deployment or processing.

```yaml
- uses: ./actions/artifacts/test-reports/download
  with:
    artifact-name: test-reports
    download-path: ./reports
```

**Inputs:**
- `artifact-name` - Name of the artifact to download (default: `test-reports`)
- `download-path` - Where to extract contents (default: `./test-reports`)
- `github-token` - GitHub token for authentication (default: `${{ github.token }}`)

**Outputs:**
- `download-path` - Path where reports were downloaded
- `artifact-found` - Whether the artifact was found

## Workflows

### create-test-reports.yml

Reusable workflow for running tests and creating reports.

```yaml
name: Test and Report
on:
  push:
    branches: [main]

jobs:
  test:
    uses: ./.github/workflows/create-test-reports.yml
    with:
      build-command: mvn clean package
      test-command: mvn test
      jacoco-report-path: target/site/jacoco
      surefire-report-path: target/site/surefire-report
      setup-java: true
      java-version: "17"
```

**Key Inputs:**
- `build-command` - Command to build the project
- `test-command` - Command to run tests
- `jacoco-report-path` - Path to JaCoCo reports
- `surefire-report-path` - Path to Surefire reports
- `setup-java` - Whether to setup Java environment
- `java-version` - Java version (default: `17`)
- `artifact-name` - Name for the artifact (default: `test-reports`)

### deploy-test-reports.yml

Deploys test reports to GitHub Pages.

```yaml
name: Deploy Test Reports
on:
  workflow_run:
    workflows: ["Test and Report"]
    types: [completed]
    branches: [main]

jobs:
  deploy:
    uses: ./.github/workflows/deploy-test-reports.yml
    permissions:
      contents: read
      pages: write
      id-token: write
    with:
      test-reports-artifact: test-reports
      pages-path: tests
```

**Key Inputs:**
- `test-reports-artifact` - Name of the test reports artifact
- `pages-path` - Subdirectory in Pages (e.g., `tests` → `/tests/`)
- `dashboard-artifact` - Optional dashboard to merge with reports

## Usage Examples

### Example 1: Maven Project with JaCoCo and Surefire

```yaml
name: Test and Coverage
on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'
          cache: 'maven'

      - name: Build and test
        run: mvn clean verify

      - name: Upload reports
        uses: ./actions/artifacts/test-reports/upload
        with:
          jacoco-report-path: target/site/jacoco
          surefire-report-path: target/site/surefire-report
```

### Example 2: With Reusable Workflow

```yaml
name: CI
on: [push]

jobs:
  test:
    uses: ./.github/workflows/create-test-reports.yml
    with:
      build-command: mvn clean package -Pjacoco
      test-command: mvn test
      jacoco-report-path: target/site/jacoco
      surefire-report-path: target/site/surefire-report
      setup-java: true

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    uses: ./.github/workflows/deploy-test-reports.yml
    permissions:
      contents: read
      pages: write
      id-token: write
    with:
      pages-path: tests
```

### Example 3: Only JaCoCo Coverage

```yaml
- uses: ./actions/artifacts/test-reports/upload
  with:
    jacoco-report-path: target/site/jacoco
    # surefire-report-path not provided - only JaCoCo will be included
```

### Example 4: Only Surefire Tests

```yaml
- uses: ./actions/artifacts/test-reports/upload
  with:
    surefire-report-path: target/site/surefire-report
    # jacoco-report-path not provided - only Surefire will be included
```

### Example 5: Custom Landing Page

```yaml
- uses: ./actions/artifacts/test-reports/upload
  with:
    jacoco-report-path: target/site/jacoco
    surefire-report-path: target/site/surefire-report
    custom-index-html: .github/templates/test-reports-index.html
```

## Integration with Dashboard

To deploy test reports alongside your React dashboard:

```yaml
jobs:
  # ... build dashboard and test reports ...

  deploy-pages:
    needs: [build-dashboard, test-reports]
    uses: ./.github/workflows/deploy-test-reports.yml
    permissions:
      contents: read
      pages: write
      id-token: write
    with:
      test-reports-artifact: test-reports
      dashboard-artifact: github-pages-dashboard  # Merge with dashboard
      pages-path: tests
```

This creates a site structure like:
```
/                    # React dashboard
/tests/              # Test reports landing page
/tests/coverage/     # JaCoCo reports
/tests/tests/        # Surefire reports
```

## Troubleshooting

### Reports not found

Ensure Maven plugins are configured correctly:

**JaCoCo:**
```xml
<plugin>
    <groupId>org.jacoco</groupId>
    <artifactId>jacoco-maven-plugin</artifactId>
    <version>0.8.11</version>
    <executions>
        <execution>
            <goals>
                <goal>prepare-agent</goal>
            </goals>
        </execution>
        <execution>
            <id>report</id>
            <phase>verify</phase>
            <goals>
                <goal>report</goal>
            </goals>
        </execution>
    </executions>
</plugin>
```

**Surefire:**
```xml
<plugin>
    <groupId>org.apache.maven.plugins</groupId>
    <artifactId>maven-surefire-plugin</artifactId>
    <version>3.2.5</version>
</plugin>
<plugin>
    <groupId>org.apache.maven.plugins</groupId>
    <artifactId>maven-surefire-report-plugin</artifactId>
    <version>3.2.5</version>
    <executions>
        <execution>
            <phase>test</phase>
            <goals>
                <goal>report</goal>
            </goals>
        </execution>
    </executions>
</plugin>
```

### Verify paths

Check report locations after test execution:

```yaml
- name: Debug report paths
  run: |
    find . -name "jacoco" -type d
    find . -name "surefire-report" -type d
```

## Features

✅ Supports JaCoCo and Surefire reports
✅ Flexible - use one or both report types
✅ Beautiful landing page with navigation
✅ GitHub Pages deployment ready
✅ Dashboard integration support
✅ Configurable retention period
✅ Custom landing page option

## License

MIT
