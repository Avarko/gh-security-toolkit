///usr/bin/env jbang "$0" "$@" ; exit $?
//DEPS com.google.code.gson:gson:2.10.1
//SOURCES model/*.java
//SOURCES loader/*.java
//SOURCES transformer/*.java
//SOURCES ConfigParser.java
//SOURCES TimestampUtils.java
//SOURCES DataProcessor.java
//SOURCES SiteDeploymentPackageBuilder.java

package fi.evolver.secops.githubPages;

import java.nio.file.Files;
import java.nio.file.Path;

/**
 * GitHub Pages site builder for security scan results and related artifacts.
 *
 * SINGLE-TENANT MODE (GitHub Pages):
 * This builder is designed for single-tenant GitHub Pages deployments.
 * Data is stored directly at /data/ without UUID subdirectories.
 *
 * For multi-tenant deployments (e.g., S3), a separate builder with
 * tenant resolution would be used.
 *
 * Responsibilities:
 * 1. Load and process various data artifacts (security scan results, test reports, etc.)
 * 2. Transform and normalize data into structured JSON format
 * 3. Build complete GitHub Pages site with dashboard and data
 * 4. Maintain data/runs/<channel>/<timestamp>/ structure
 * 5. Update data/hist/scan-history.json with scan metadata
 *
 * Data Structure (single-tenant):
 *   /data/
 *   ├── hist/
 *   │   └── scan-history.json
 *   └── runs/
 *       └── <channel>/
 *           └── <timestamp>/
 *               ├── scan-run.json
 *               └── ... (raw scan files)
 *
 * Usage:
 *   GitHubPagesBuilder <config_json>
 *
 * Where config_json contains:
 * {
 *   "input": {
 *     "outdir": "path/to/scan/results",
 *     "pagesRoot": "path/to/pages/root",
 *     "dashboardBuildDir": "path/to/dashboard/build"
 *   },
 *   "metadata": {
 *     "timestamp": "2025-11-20-103000Z",
 *     "channel": "manual",
 *     "branch": "main",
 *     "repository": "org/repo",
 *     "commitSha": "abc123..."
 *   }
 * }
 */
public class GitHubPagesBuilder {

    public static void main(String[] args) throws Exception {
        if (args.length < 1) {
            System.err.println("Usage: GitHubPagesBuilder <config_json>");
            System.exit(1);
        }

        // 1. Parse configuration
        ConfigParser.Config config = ConfigParser.parse(args[0]);

        String outputDir = config.input.outdir;
        String pagesRoot = config.input.pagesRoot;
        String dashboardBuildDir = config.input.dashboardBuildDir;
        String timestamp = config.metadata.timestamp;
        String channel = config.metadata.channel;

        // 2. Convert timestamp to compact format
        String compactTimestamp = TimestampUtils.toCompactTimestamp(timestamp);

        System.out.println("📦 Processing scan data for: " + timestamp);
        System.out.println("   Compact timestamp: " + compactTimestamp);
        System.out.println("   Channel: " + channel);

        Path pagesPath = Path.of(pagesRoot);

        // 3. Single-tenant mode: data root is directly /data/
        Path dataRoot = pagesPath.resolve("data");
        Files.createDirectories(dataRoot);
        System.out.println("📁 Data root: /data/ (single-tenant mode)");

        // 4. Merge dashboard build artifacts
        if (dashboardBuildDir != null && !dashboardBuildDir.isEmpty()) {
            SiteDeploymentPackageBuilder.mergeDashboard(pagesPath, Path.of(dashboardBuildDir));
        }

        // 5. Process scan data and write to data root
        DataProcessor.process(
                ConfigParser.getGson(),
                outputDir,
                dataRoot,
                channel,
                timestamp,
                compactTimestamp,
                config.metadata);
    }
}
