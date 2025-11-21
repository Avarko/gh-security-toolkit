///usr/bin/env jbang "$0" "$@" ; exit $?
//DEPS com.google.code.gson:gson:2.10.1
//SOURCES model/*.java
//SOURCES loader/*.java
//SOURCES transformer/*.java
//SOURCES ConfigParser.java
//SOURCES TimestampUtils.java
//SOURCES TenantResolver.java
//SOURCES TenantRegistry.java
//SOURCES DataProcessor.java
//SOURCES SiteDeploymentPackageBuilder.java

package fi.evolver.secops.githubPages;

import java.nio.file.Path;

/**
 * GitHub Pages site builder for security scan results and related artifacts.
 *
 * Responsibilities:
 * 1. Load and process various data artifacts (security scan results, test reports, etc.)
 * 2. Transform and normalize data into structured JSON format
 * 3. Build complete GitHub Pages site with dashboard and data
 * 4. Maintain data/<tenant-uuid>/runs/<channel>/<timestamp>/ structure
 * 5. Update data/<tenant-uuid>/hist/scan-history.json with scan metadata
 *
 * Tenant resolution (GUID-based security model):
 * - GitHub org/repo is read from environment variables (GITHUB_REPOSITORY_OWNER, GITHUB_REPOSITORY)
 * - TenantRegistry maps GitHub org/repo to a UUID
 * - Data is stored at /data/<uuid>/ to prevent tenant forgery or path traversal
 *
 * UI rendering is done in a separate React dashboard.
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

        // 3. Resolve tenant identity from GitHub context
        TenantResolver.TenantInfo tenantInfo = TenantResolver.resolve(pagesPath);

        // 4. Merge dashboard build artifacts
        if (dashboardBuildDir != null && !dashboardBuildDir.isEmpty()) {
            SiteDeploymentPackageBuilder.mergeDashboard(pagesPath, Path.of(dashboardBuildDir));
        }

        // 5. Process scan data and write to tenant data root
        DataProcessor.process(
                ConfigParser.getGson(),
                outputDir,
                tenantInfo.dataRoot,
                channel,
                timestamp,
                compactTimestamp,
                null);
    }
}
