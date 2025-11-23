#!/bin/bash
# Generate test data for LocalStack S3 development
# Creates two customers (contoso, acme) with two repos each (frontend, backend)

set -euo pipefail

OUTPUT_DIR="${1:-./dashboard/localstack-data}"

echo "📝 Generating LocalStack test data in: $OUTPUT_DIR"

# Customers and their repositories
declare -A CUSTOMERS=(
    ["contoso"]="Contoso Corporation"
    ["acme"]="Acme Inc"
)

declare -a REPOS=("frontend" "backend")

# Generate timestamps for last 14 days
generate_timestamps() {
    local count=${1:-10}
    local timestamps=()
    for i in $(seq 0 $((count - 1))); do
        local days_ago=$((i * 1 + RANDOM % 2))
        local hour=$((2 + RANDOM % 4))
        local ts=$(date -d "$days_ago days ago" +%Y%m%d)-$(printf "%02d%02d%02d" $hour $((RANDOM % 60)) $((RANDOM % 60)))
        timestamps+=("$ts")
    done
    echo "${timestamps[@]}"
}

# Generate scan history JSON
generate_scan_history() {
    local customer=$1
    local repo=$2
    local channel="nightly-main"

    local scans_json=""
    local first=true

    for i in $(seq 1 8); do
        local days_ago=$((i * 2))
        local compact_ts=$(date -d "$days_ago days ago" +%Y%m%d)-$(printf "%02d0000" $((RANDOM % 6 + 1)))
        local iso_ts=$(date -d "$days_ago days ago" +%Y-%m-%dT%H:%M:%SZ)

        # Randomize vulnerability counts
        local critical=$((RANDOM % 3))
        local high=$((RANDOM % 8))
        local medium=$((RANDOM % 20 + 5))
        local low=$((RANDOM % 30 + 10))

        local semgrep_errors=$((RANDOM % 3))
        local semgrep_warnings=$((RANDOM % 10 + 1))
        local semgrep_info=$((RANDOM % 15 + 3))

        [[ $first == true ]] || scans_json+=","
        first=false

        scans_json+='{
      "channel": "'$channel'",
      "timestamp": "'$iso_ts'",
      "compactTimestamp": "'$compact_ts'",
      "metadata": {
        "branch": "main",
        "commit": "'$(printf '%040x' $RANDOM$RANDOM)'",
        "repository": "'$customer/$repo'"
      },
      "trivyFsResults": {
        "totalVulnerabilities": {
          "CRITICAL": '$critical',
          "HIGH": '$high',
          "MEDIUM": '$medium',
          "LOW": '$low'
        }
      },
      "trivyImageResults": {
        "totalVulnerabilities": {
          "CRITICAL": 0,
          "HIGH": '$((RANDOM % 3))',
          "MEDIUM": '$((RANDOM % 10))',
          "LOW": '$((RANDOM % 20))'
        }
      },
      "semgrepResults": {
        "totalErrors": '$semgrep_errors',
        "totalWarnings": '$semgrep_warnings',
        "totalInfos": '$semgrep_info'
      }
    }'
    done

    echo '{
  "version": 2,
  "scans": [
    '$scans_json'
  ]
}'
}

# Generate individual scan run metadata
generate_scan_run() {
    local customer=$1
    local repo=$2
    local compact_ts=$3

    echo '{
  "channel": "nightly-main",
  "timestamp": "'$(date +%Y-%m-%dT%H:%M:%SZ)'",
  "compactTimestamp": "'$compact_ts'",
  "metadata": {
    "branch": "main",
    "commit": "'$(printf '%040x' $RANDOM$RANDOM)'",
    "repository": "'$customer/$repo'"
  }
}'
}

# Generate Trivy FS results
generate_trivy_fs_results() {
    echo '{
  "SchemaVersion": 2,
  "ArtifactName": ".",
  "ArtifactType": "filesystem",
  "Results": [
    {
      "Target": "package.json",
      "Class": "lang-pkgs",
      "Type": "npm",
      "Vulnerabilities": [
        {
          "VulnerabilityID": "CVE-2024-1234",
          "PkgName": "lodash",
          "InstalledVersion": "4.17.20",
          "FixedVersion": "4.17.21",
          "Severity": "HIGH",
          "Title": "Prototype Pollution in lodash",
          "Description": "Example vulnerability for testing"
        },
        {
          "VulnerabilityID": "CVE-2024-5678",
          "PkgName": "express",
          "InstalledVersion": "4.17.1",
          "FixedVersion": "4.18.0",
          "Severity": "MEDIUM",
          "Title": "Open Redirect in Express",
          "Description": "Example vulnerability for testing"
        }
      ]
    }
  ]
}'
}

# Generate Trivy image results
generate_trivy_image_results() {
    echo '{
  "SchemaVersion": 2,
  "ArtifactName": "myimage:latest",
  "ArtifactType": "container_image",
  "Results": [
    {
      "Target": "myimage:latest (alpine 3.18)",
      "Class": "os-pkgs",
      "Type": "alpine",
      "Vulnerabilities": [
        {
          "VulnerabilityID": "CVE-2024-9999",
          "PkgName": "openssl",
          "InstalledVersion": "3.1.0",
          "FixedVersion": "3.1.1",
          "Severity": "MEDIUM",
          "Title": "OpenSSL Buffer Overflow",
          "Description": "Example container vulnerability"
        }
      ]
    }
  ]
}'
}

# Generate Semgrep results
generate_semgrep_results() {
    echo '{
  "version": "1.0.0",
  "results": [
    {
      "check_id": "javascript.security.audit.xss.direct-html-write",
      "path": "src/components/Widget.tsx",
      "start": {"line": 42, "col": 5},
      "end": {"line": 42, "col": 45},
      "extra": {
        "severity": "WARNING",
        "message": "Direct HTML write detected. Consider using safe DOM methods."
      }
    },
    {
      "check_id": "typescript.react.security.react-dangerouslysetinnerhtml",
      "path": "src/pages/Preview.tsx",
      "start": {"line": 18, "col": 10},
      "end": {"line": 18, "col": 65},
      "extra": {
        "severity": "WARNING",
        "message": "dangerouslySetInnerHTML usage detected"
      }
    }
  ],
  "errors": []
}'
}

# Generate JaCoCo HTML report
generate_jacoco_report() {
    local customer=$1
    local repo=$2
    local coverage=$((60 + RANDOM % 35))

    echo '<!DOCTYPE html>
<html>
<head>
    <title>JaCoCo - '"$customer/$repo"' Coverage Report</title>
    <style>
        body { font-family: sans-serif; margin: 20px; background: #1a1a2e; color: #eee; }
        h1 { color: #00d4ff; }
        table { border-collapse: collapse; width: 100%; margin-top: 20px; }
        th, td { border: 1px solid #444; padding: 8px; text-align: left; }
        th { background: #16213e; }
        .covered { background: #0f5132; }
        .missed { background: #842029; }
        .bar { height: 20px; display: flex; }
        .bar-covered { background: #198754; }
        .bar-missed { background: #dc3545; }
    </style>
</head>
<body>
    <h1>📊 JaCoCo Coverage Report</h1>
    <p><strong>Project:</strong> '"$customer/$repo"'</p>
    <p><strong>Generated:</strong> '"$(date)"'</p>

    <h2>Overall Coverage: '"$coverage"'%</h2>
    <div class="bar">
        <div class="bar-covered" style="width: '"$coverage"'%"></div>
        <div class="bar-missed" style="width: '"$((100 - coverage))"'%"></div>
    </div>

    <table>
        <tr><th>Package</th><th>Line Coverage</th><th>Branch Coverage</th><th>Instructions</th></tr>
        <tr><td>com.'"$customer"'.'"$repo"'.core</td><td>'"$((coverage + RANDOM % 10 - 5))"'%</td><td>'"$((coverage - 10 + RANDOM % 10))"'%</td><td>1,234</td></tr>
        <tr><td>com.'"$customer"'.'"$repo"'.api</td><td>'"$((coverage + RANDOM % 15))"'%</td><td>'"$((coverage - 5 + RANDOM % 10))"'%</td><td>856</td></tr>
        <tr><td>com.'"$customer"'.'"$repo"'.util</td><td>'"$((coverage - 5 + RANDOM % 10))"'%</td><td>'"$((coverage - 15 + RANDOM % 10))"'%</td><td>421</td></tr>
    </table>
</body>
</html>'
}

# Generate Surefire HTML report
generate_surefire_report() {
    local customer=$1
    local repo=$2
    local tests=$((50 + RANDOM % 100))
    local failures=$((RANDOM % 5))
    local errors=$((RANDOM % 2))
    local skipped=$((RANDOM % 3))
    local time="$((RANDOM % 30 + 5)).$((RANDOM % 999))"

    echo '<!DOCTYPE html>
<html>
<head>
    <title>Surefire Report - '"$customer/$repo"'</title>
    <style>
        body { font-family: sans-serif; margin: 20px; background: #1a1a2e; color: #eee; }
        h1 { color: #00d4ff; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .stat { padding: 15px 25px; border-radius: 8px; text-align: center; }
        .stat-tests { background: #16213e; }
        .stat-failures { background: #842029; }
        .stat-errors { background: #664d03; }
        .stat-skipped { background: #495057; }
        .stat-success { background: #0f5132; }
        .stat h3 { margin: 0; font-size: 2em; }
        .stat p { margin: 5px 0 0 0; }
        table { border-collapse: collapse; width: 100%; margin-top: 20px; }
        th, td { border: 1px solid #444; padding: 8px; text-align: left; }
        th { background: #16213e; }
        .passed { color: #198754; }
        .failed { color: #dc3545; }
    </style>
</head>
<body>
    <h1>🧪 Surefire Test Report</h1>
    <p><strong>Project:</strong> '"$customer/$repo"'</p>
    <p><strong>Generated:</strong> '"$(date)"'</p>

    <div class="summary">
        <div class="stat stat-tests"><h3>'"$tests"'</h3><p>Tests</p></div>
        <div class="stat stat-failures"><h3>'"$failures"'</h3><p>Failures</p></div>
        <div class="stat stat-errors"><h3>'"$errors"'</h3><p>Errors</p></div>
        <div class="stat stat-skipped"><h3>'"$skipped"'</h3><p>Skipped</p></div>
        <div class="stat stat-success"><h3>'"$time"'s</h3><p>Time</p></div>
    </div>

    <h2>Test Classes</h2>
    <table>
        <tr><th>Test Class</th><th>Tests</th><th>Failures</th><th>Errors</th><th>Time</th></tr>
        <tr><td class="passed">com.'"$customer"'.'"$repo"'.CoreServiceTest</td><td>'"$((tests / 3))"'</td><td>0</td><td>0</td><td>'"$((RANDOM % 10))"'.'"$((RANDOM % 999))"'s</td></tr>
        <tr><td class="passed">com.'"$customer"'.'"$repo"'.ApiControllerTest</td><td>'"$((tests / 3))"'</td><td>'"$((failures > 0 ? 1 : 0))"'</td><td>0</td><td>'"$((RANDOM % 15))"'.'"$((RANDOM % 999))"'s</td></tr>
        <tr><td class="passed">com.'"$customer"'.'"$repo"'.UtilTest</td><td>'"$((tests / 3))"'</td><td>'"$((failures > 1 ? failures - 1 : 0))"'</td><td>'"$errors"'</td><td>'"$((RANDOM % 8))"'.'"$((RANDOM % 999))"'s</td></tr>
    </table>
</body>
</html>'
}

# Generate test report history JSON
generate_test_report_history() {
    local customer=$1
    local repo=$2

    local reports_json=""
    local first=true

    for i in $(seq 1 6); do
        local days_ago=$((i * 2))
        local compact_ts=$(date -d "$days_ago days ago" +%Y%m%d)-$(printf "%02d0000" $((RANDOM % 6 + 1)))
        local iso_ts=$(date -d "$days_ago days ago" +%Y-%m-%dT%H:%M:%SZ)

        local tests=$((50 + RANDOM % 100))
        local failures=$((RANDOM % 5))
        local coverage=$((60 + RANDOM % 35))

        [[ $first == true ]] || reports_json+=","
        first=false

        reports_json+='{
      "channel": "nightly-main",
      "timestamp": "'$iso_ts'",
      "compactTimestamp": "'$compact_ts'",
      "metadata": {
        "branch": "main",
        "commit": "'$(printf '%040x' $RANDOM$RANDOM)'",
        "repository": "'$customer/$repo'"
      },
      "jacocoSummary": {
        "lineCoverage": '$coverage',
        "branchCoverage": '$((coverage - 10 + RANDOM % 10))',
        "instructionCoverage": '$((coverage + RANDOM % 5))'
      },
      "surefireSummary": {
        "tests": '$tests',
        "failures": '$failures',
        "errors": '$((RANDOM % 2))',
        "skipped": '$((RANDOM % 3))'
      }
    }'
    done

    echo '{
  "version": 2,
  "reports": [
    '$reports_json'
  ]
}'
}

# Main: create directory structure and generate data
for customer in "${!CUSTOMERS[@]}"; do
    for repo in "${REPOS[@]}"; do
        echo "   Creating data for $customer/$repo..."

        REPO_DIR="$OUTPUT_DIR/$customer/$repo"
        mkdir -p "$REPO_DIR/hist"
        mkdir -p "$REPO_DIR/runs/nightly-main"
        mkdir -p "$REPO_DIR/test-reports/nightly-main"

        # Generate scan history
        generate_scan_history "$customer" "$repo" > "$REPO_DIR/hist/scan-history.json"

        # Generate test report history
        generate_test_report_history "$customer" "$repo" > "$REPO_DIR/hist/test-report-history.json"

        # Generate individual scan runs (latest 3)
        for i in 1 2 3; do
            days_ago=$((i * 2))
            compact_ts=$(date -d "$days_ago days ago" +%Y%m%d)-$(printf "%02d0000" $((RANDOM % 6 + 1)))

            RUN_DIR="$REPO_DIR/runs/nightly-main/$compact_ts"
            mkdir -p "$RUN_DIR"

            generate_scan_run "$customer" "$repo" "$compact_ts" > "$RUN_DIR/scan-run.json"
            generate_trivy_fs_results > "$RUN_DIR/trivy-fs-results.json"
            generate_trivy_image_results > "$RUN_DIR/trivy-image-results.json"
            generate_semgrep_results > "$RUN_DIR/semgrep-results.json"
        done

        # Generate test reports (latest 3)
        for i in 1 2 3; do
            days_ago=$((i * 2))
            compact_ts=$(date -d "$days_ago days ago" +%Y%m%d)-$(printf "%02d0000" $((RANDOM % 6 + 1)))

            REPORT_DIR="$REPO_DIR/test-reports/nightly-main/$compact_ts"
            mkdir -p "$REPORT_DIR"

            generate_jacoco_report "$customer" "$repo" > "$REPORT_DIR/jacoco.html"
            generate_surefire_report "$customer" "$repo" > "$REPORT_DIR/surefire.html"
        done
    done
done

echo "✅ Test data generated successfully!"
echo ""
echo "📁 Structure:"
find "$OUTPUT_DIR" -type d | head -20
