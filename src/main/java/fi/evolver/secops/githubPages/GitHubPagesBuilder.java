///usr/bin/env jbang "$0" "$@" ; exit $?
//DEPS com.google.code.gson:gson:2.10.1
//SOURCES model/*.java
//SOURCES loader/*.java
//SOURCES transformer/*.java

package fi.evolver.secops.githubPages;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import fi.evolver.secops.githubPages.loader.ScanResultLoader;
import fi.evolver.secops.githubPages.loader.ScanResultLoader.RawScanData;
import fi.evolver.secops.githubPages.model.HistoryEntry;
import fi.evolver.secops.githubPages.model.HistoryMetadata;
import fi.evolver.secops.githubPages.model.HistoryStats;
import fi.evolver.secops.githubPages.model.ScanHistory;
import fi.evolver.secops.githubPages.model.ScanMetadata;
import fi.evolver.secops.githubPages.model.ScanStats;
import fi.evolver.secops.githubPages.model.TenantConfig;
import fi.evolver.secops.githubPages.transformer.FindingsTransformer;
import fi.evolver.secops.githubPages.transformer.FindingsTransformer.TransformedScanData;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.regex.Pattern;

/**
 * GitHub Pages site builder for security scan results and related artifacts.
 *
 * Responsibilities:
 * 1. Load and process various data artifacts (security scan results, test
 * reports, etc.)
 * 2. Transform and normalize data into structured JSON format
 * 3. Build complete GitHub Pages site with dashboard and data
 * 4. Maintain data/<tenant-uuid>/runs/<channel>/<timestamp>/ structure
 * 5. Update data/<tenant-uuid>/hist/scan-history.json with scan metadata
 *
 * Tenant resolution (GUID-based security model):
 * - GitHub org/repo is read from environment variables
 * (GITHUB_REPOSITORY_OWNER, GITHUB_REPOSITORY)
 * - TenantRegistry maps GitHub org/repo to a UUID
 * - Data is stored at /data/<uuid>/ to prevent tenant forgery or path traversal
 * - Display metadata (optional) can be provided via CLI arguments or config
 *
 * UI rendering is done in a separate React dashboard.
 *
 * Usage:
 * GitHubPagesBuilder <config_json> [metadata_json] [dashboard_dir]
 * [display_name] [org_display_name] [logo_url]
 *
 * Where config_json contains:
 * {
 * "input": {
 * "outdir": "path/to/scan/results",
 * "pagesRoot": "path/to/pages/root",
 * "dashboardBuildDir": "path/to/dashboard/build"
 * },
 * "metadata": {
 * "timestamp": "2025-11-20T10:30:00Z",
 * "channel": "manual",
 * "branch": "main",
 * "repository": "org/repo",
 * "commitSha": "abc123..."
 * }
 * }
 */
public class GitHubPagesBuilder {

    // Configuration classes for JSON parsing
    public static class Config {
        public Input input;
        public Metadata metadata;
        public Branding branding;
    }

    public static class Input {
        public String outdir;
        public String pagesRoot;
        public String dashboardBuildDir;
    }

    public static class Metadata {
        public String timestamp;
        public String channel;
        public String branch;
        public String repository;
        public String commitSha;
        public String scanId;
        public String ciJobName;
        public String ciJobUrl;
        public String actorName;
    }

    public static class Branding {
        // Reserved for future branding configuration
    }

    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

    public static void main(String[] args) throws Exception {
        if (args.length < 1) {
            System.err.println(
                    "Usage: GitHubPagesBuilder <config_json> [metadata_json] [dashboard_dir] "
                            + "[display_name] [org_display_name] [logo_url]");
            System.exit(1);
        }

        // Read configuration from JSON file
        String configFile = args[0];
        Path configPath = Path.of(configFile);
        if (!Files.exists(configPath)) {
            throw new IllegalArgumentException("Configuration file not found: " + configFile);
        }

        String configJson = Files.readString(configPath, StandardCharsets.UTF_8);
        var config = GSON.fromJson(configJson, Config.class);

        // Extract values from config
        String outputDir = config.input.outdir;
        String pagesRoot = config.input.pagesRoot;
        String dashboardBuildDir = config.input.dashboardBuildDir;
        String isoTimestamp = config.metadata.timestamp;
        String channel = config.metadata.channel;

        // Optional additional arguments (can override config)
        String metadataJson = args.length > 1 && !args[1].isEmpty() ? args[1] : null;
        String dashboardDir = args.length > 2 && !args[2].isEmpty() ? args[2] : dashboardBuildDir;

        // Optional display metadata (not used for data paths)
        String displayName = args.length > 3 && !args[3].isEmpty() ? args[3] : null;
        String orgDisplayName = args.length > 4 && !args[4].isEmpty() ? args[4] : null;
        String logoUrl = args.length > 5 && !args[5].isEmpty() ? args[5] : null;

        // Convert ISO timestamp to compact UTC format for URLs and file paths
        String compactTimestamp = toCompactTimestamp(isoTimestamp);

        System.out.println("📦 Processing scan data for: " + isoTimestamp);
        System.out.println("   Compact timestamp: " + compactTimestamp);
        System.out.println("   Channel: " + channel);

        Path pagesPath = Path.of(pagesRoot);

        // Read trusted GitHub org/repo from environment variables
        String githubOrg = System.getenv("GITHUB_REPOSITORY_OWNER");
        String githubRepo = System.getenv("GITHUB_REPOSITORY");

        // GITHUB_REPOSITORY is in format "owner/repo", extract just the repo name
        if (githubRepo != null && githubRepo.contains("/")) {
            githubRepo = githubRepo.substring(githubRepo.lastIndexOf("/") + 1);
        }

        if (githubOrg == null || githubOrg.isEmpty()) {
            throw new IllegalArgumentException(
                    "❌ ERROR: GITHUB_REPOSITORY_OWNER environment variable is required.\n" +
                            "   This value is trusted and provided by GitHub Actions.\n" +
                            "   If running locally for testing, set: export GITHUB_REPOSITORY_OWNER=<org>");
        }

        if (githubRepo == null || githubRepo.isEmpty()) {
            throw new IllegalArgumentException(
                    "❌ ERROR: GITHUB_REPOSITORY environment variable is required.\n" +
                            "   This value is trusted and provided by GitHub Actions.\n" +
                            "   Expected format: owner/repo\n" +
                            "   If running locally for testing, set: export GITHUB_REPOSITORY=<owner>/<repo>");
        }

        System.out.println("🔐 Tenant identity (from GitHub Actions context):");
        System.out.println("   GitHub org: " + githubOrg);
        System.out.println("   GitHub repo: " + githubRepo);

        // Resolve or create tenant UUID using TenantRegistry
        TenantRegistry registry = new TenantRegistry(pagesPath);
        String tenantId = registry.resolveTenantId(githubOrg, githubRepo, displayName, orgDisplayName, logoUrl);

        // Data root is now /data/<uuid>/
        Path dataRoot = pagesPath.resolve("data").resolve(tenantId);
        Files.createDirectories(dataRoot);
        System.out.println("📁 Tenant data root: /data/" + tenantId + "/");

        // Merge dashboard build artifacts first
        if (dashboardDir != null) {
            mergeDashboard(pagesPath, Path.of(dashboardDir));
        }

        // Use compact timestamp for file paths
        Path dataRunsPath = dataRoot
                .resolve("runs")
                .resolve(channel)
                .resolve(compactTimestamp);
        Files.createDirectories(dataRunsPath);

        // === LOAD & TRANSFORM ===
        ScanResultLoader loader = new ScanResultLoader(GSON);
        FindingsTransformer transformer = new FindingsTransformer();

        RawScanData rawData = loader.load(outputDir, metadataJson);
        // Pass ISO timestamp to metadata (for display purposes)
        TransformedScanData transformedData = transformer.transform(rawData, isoTimestamp);

        boolean hasDependabot = rawData.dependabotSummary != null
                && !rawData.dependabotSummary.isBlank();

        ScanMetadata metadata = transformedData.metadata;

        // Extract statistics for history
        ScanStats scanStats = transformer.extractStats(
                rawData.trivyFs,
                rawData.trivyImage,
                rawData.semgrep,
                hasDependabot);
        HistoryStats historyStats = HistoryStats.from(scanStats);

        // === WRITE DATA ===

        // 1) Copy scan result JSON files to runs directory
        copyJsonFiles(outputDir, dataRunsPath);

        // 2) Write concise scan metadata (branch, commit, repository)
        writeMetadataJson(dataRunsPath, metadata);

        // 3) Update tenant-specific scan-history.json (use compact timestamp for URLs)
        appendScanHistory(dataRoot, channel, compactTimestamp, metadata, historyStats);

        // 4) Clean up orphaned tenants (tenants not in registry)
        cleanupOrphanedTenants(pagesPath, registry);

        System.out.println("✅ Data processing complete!");
        System.out.println("   Run data: " + dataRunsPath);
    }

    private static void copyJsonFiles(String sourceDir, Path targetDir) throws IOException {
        Path source = Path.of(sourceDir);
        String[] jsonFiles = {
                "trivy-fs-results.json",
                "trivy-image-results.json",
                "semgrep-results.json",
                "DEPENDABOT_SUMMARY.md"
        };

        for (String filename : jsonFiles) {
            Path srcFile = source.resolve(filename);
            if (Files.exists(srcFile)) {
                Files.copy(srcFile, targetDir.resolve(filename), StandardCopyOption.REPLACE_EXISTING);
                System.out.println("   ✅ Copied " + filename);
            }
        }
    }

    private static void writeMetadataJson(Path targetDir, ScanMetadata metadata) throws IOException {
        // Build nested structure to match TypeScript schema:
        // { timestamp: string, metadata: { branch, commit, repository }, footer: { ...
        // } }
        var metadataInner = new java.util.HashMap<String, String>();
        if (metadata != null) {
            if (metadata.branch != null && !metadata.branch.isEmpty()) {
                metadataInner.put("branch", metadata.branch);
            }
            if (metadata.commit != null && !metadata.commit.isEmpty()) {
                metadataInner.put("commit", metadata.commit);
            }
            if (metadata.repository != null && !metadata.repository.isEmpty()) {
                metadataInner.put("repository", metadata.repository);
            }
        }

        var json = new java.util.HashMap<String, Object>();
        json.put("timestamp", metadata != null ? metadata.timestamp : "");
        json.put("metadata", metadataInner);

        Path metaPath = targetDir.resolve("scan-metadata.json");
        Files.writeString(metaPath, GSON.toJson(json), StandardCharsets.UTF_8);
        System.out.println("   ✅ Wrote scan-metadata.json");
    }

    private static void appendScanHistory(Path dataRoot,
            String channel,
            String timestamp,
            ScanMetadata metadata,
            HistoryStats stats) {
        try {
            Path histDir = dataRoot.resolve("hist");
            Files.createDirectories(histDir);
            Path historyPath = histDir.resolve("scan-history.json");

            ScanHistory history = readHistory(historyPath);

            // Remove possible duplicate for the same channel+timestamp combination
            history.scans.removeIf(entry -> channel.equals(entry.channel)
                    && timestamp.equals(entry.timestamp));

            HistoryEntry entry = HistoryEntry.from(channel, timestamp, metadata, stats);
            history.scans.add(entry);
            history.scans.sort(Comparator.comparing(e -> e.timestamp));

            Files.writeString(historyPath, GSON.toJson(history), StandardCharsets.UTF_8);
            System.out.println("   ✅ Updated scan-history.json at " + historyPath);
        } catch (Exception e) {
            System.err.println("⚠️  Failed to append scan history: " + e.getMessage());
        }
    }

    private static ScanHistory readHistory(Path historyPath) {
        if (!Files.exists(historyPath)) {
            return new ScanHistory();
        }
        try {
            String json = Files.readString(historyPath);
            if (json == null || json.isBlank()) {
                return new ScanHistory();
            }

            ScanHistory history = GSON.fromJson(json, ScanHistory.class);
            if (history == null) {
                System.err.println("⚠️  Scan history JSON is null, starting fresh");
                return new ScanHistory();
            }
            if (history.scans == null) {
                history.scans = new ArrayList<>();
            }

            if (history.version < 2) {
                System.out.println("   📦 Upgrading scan history from v" + history.version + " to v2");
                history.version = 2;
            }

            // Filter out broken entries
            List<HistoryEntry> valid = new ArrayList<>();
            for (HistoryEntry entry : history.scans) {
                if (entry == null || entry.channel == null || entry.timestamp == null) {
                    System.err.println("⚠️  Skipping history entry with missing channel or timestamp");
                    continue;
                }
                valid.add(entry);
            }
            history.scans = valid;

            return history;
        } catch (Exception e) {
            System.err.println("⚠️  Failed to read existing scan history (corrupt format): " + e.getMessage());
            return new ScanHistory();
        }
    }

    /**
     * Converts an ISO 8601 timestamp to a compact URL-safe format in UTC.
     *
     * Examples:
     * - "2025-11-19T17:56:24Z" → "20251119-175624"
     * - "2025-11-19T17:56:24+02:00" → "20251119-155624" (converted to UTC)
     * - "2025-11-19T17:56:24.123Z" → "20251119-175624" (milliseconds truncated)
     *
     * This ensures:
     * 1. No URL encoding needed (no colons or special characters)
     * 2. Timezone-independent (always UTC to avoid collisions)
     * 3. Chronologically sortable
     * 4. Human-readable
     *
     * @param isoTimestamp ISO 8601 formatted timestamp (with or without timezone)
     * @return Compact timestamp in format YYYYMMDD-HHMMSS (UTC)
     */
    private static String toCompactTimestamp(String isoTimestamp) {
        try {
            // Parse ISO 8601 timestamp (handles various formats including timezones)
            Instant instant = Instant.parse(isoTimestamp);

            // Format as compact UTC timestamp: YYYYMMDD-HHMMSS
            DateTimeFormatter formatter = DateTimeFormatter
                    .ofPattern("yyyyMMdd-HHmmss")
                    .withZone(ZoneOffset.UTC);

            return formatter.format(instant);
        } catch (Exception e) {
            // If parsing fails, fall back to sanitized original timestamp
            // (remove colons and keep only alphanumeric + hyphens)
            System.err
                    .println("⚠️  Warning: Failed to parse timestamp '" + isoTimestamp + "', using sanitized version");
            return isoTimestamp.replaceAll("[^0-9A-Za-z-]", "");
        }
    }

    /**
     * Merges dashboard build artifacts into the pages root.
     * Copies all files from dashboardDir to pagesRoot, preserving directory
     * structure.
     */
    private static void mergeDashboard(Path pagesRoot, Path dashboardDir) throws IOException {
        System.out.println("🎨 Merging dashboard from: " + dashboardDir);

        if (!Files.exists(dashboardDir)) {
            System.err.println("⚠️  Dashboard directory not found: " + dashboardDir);
            return;
        }

        Files.walk(dashboardDir)
                .filter(Files::isRegularFile)
                .forEach(source -> {
                    try {
                        Path relative = dashboardDir.relativize(source);
                        Path target = pagesRoot.resolve(relative);
                        Files.createDirectories(target.getParent());
                        Files.copy(source, target, StandardCopyOption.REPLACE_EXISTING);
                    } catch (IOException e) {
                        throw new RuntimeException("Failed to copy dashboard file: " + source, e);
                    }
                });

        System.out.println("   ✅ Dashboard merged successfully");
    }

    /**
     * Cleans up orphaned tenant directories that are not registered in
     * tenant-registry.json.
     *
     * Safety features:
     * - Only deletes UUID-formatted directories
     * - Skips if registry is empty, missing, or invalid
     * - Logs all actions before performing them
     *
     * @param pagesRoot Root directory of GitHub Pages (repository root)
     * @param registry  TenantRegistry containing registered tenants
     */
    private static void cleanupOrphanedTenants(Path pagesRoot, TenantRegistry registry) {
        try {
            Path dataDir = pagesRoot.resolve("data");

            if (!Files.exists(dataDir) || !Files.isDirectory(dataDir)) {
                System.out.println("ℹ️  No data directory found, skipping orphan cleanup");
                return;
            }

            // Safety check 1: Registry must have at least one tenant
            java.util.List<String> registeredIds = new ArrayList<>();
            try {
                // Use reflection to access tenants list from TenantRegistry
                var tenantsField = registry.getClass().getDeclaredField("tenants");
                tenantsField.setAccessible(true);
                @SuppressWarnings("unchecked")
                var tenantsList = (java.util.List<?>) tenantsField.get(registry);

                if (tenantsList == null || tenantsList.isEmpty()) {
                    System.out.println("⚠️  WARNING: Tenant registry is empty - skipping orphan cleanup for safety");
                    return;
                }

                // Extract tenant IDs
                for (Object tenantObj : tenantsList) {
                    var idField = tenantObj.getClass().getDeclaredField("id");
                    idField.setAccessible(true);
                    String id = (String) idField.get(tenantObj);
                    if (id != null && !id.isEmpty()) {
                        registeredIds.add(id);
                    }
                }
            } catch (Exception e) {
                System.err.println("⚠️  WARNING: Failed to read tenant registry - skipping orphan cleanup for safety");
                System.err.println("   Error: " + e.getMessage());
                return;
            }

            // Find all UUID directories in /data/
            Pattern uuidPattern = Pattern.compile("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$");
            java.util.List<String> foundIds = new ArrayList<>();

            try (var stream = Files.list(dataDir)) {
                stream.filter(Files::isDirectory)
                        .map(Path::getFileName)
                        .map(Path::toString)
                        .filter(name -> uuidPattern.matcher(name).matches())
                        .forEach(foundIds::add);
            }

            if (foundIds.isEmpty()) {
                System.out.println("ℹ️  No tenant directories found in /data/, skipping cleanup");
                return;
            }

            // Find orphaned tenants (exist in filesystem but not in registry)
            java.util.List<String> orphanIds = new ArrayList<>();
            for (String foundId : foundIds) {
                if (!registeredIds.contains(foundId)) {
                    orphanIds.add(foundId);
                }
            }

            if (orphanIds.isEmpty()) {
                System.out
                        .println("✅ No orphaned tenants found - all " + foundIds.size() + " tenant(s) are registered");
                return;
            }

            // Log what will be deleted
            System.out.println("🗑️  Found " + orphanIds.size() + " orphaned tenant(s) to clean up:");
            for (String orphanId : orphanIds) {
                System.out.println("   • " + orphanId);
            }
            System.out.println("   Registered tenants (will keep): " + registeredIds.size());
            System.out.println("   Total tenants before cleanup: " + foundIds.size());

            // Delete orphaned tenants
            int deleted = 0;
            for (String orphanId : orphanIds) {
                Path orphanPath = dataDir.resolve(orphanId);
                try {
                    deleteRecursively(orphanPath);
                    System.out.println("   ✅ Deleted: " + orphanId);
                    deleted++;
                } catch (IOException e) {
                    System.err.println("   ⚠️  Failed to delete " + orphanId + ": " + e.getMessage());
                }
            }

            System.out.println("✅ Cleaned up " + deleted + " orphaned tenant(s)");
            System.out.println("   Remaining tenants: " + (foundIds.size() - deleted));

        } catch (Exception e) {
            // Don't fail the entire job if cleanup fails
            System.err.println("⚠️  WARNING: Orphaned tenant cleanup failed: " + e.getMessage());
            e.printStackTrace();
        }
    }

    /**
     * Recursively deletes a directory and all its contents.
     */
    private static void deleteRecursively(Path path) throws IOException {
        if (!Files.exists(path)) {
            return;
        }

        if (Files.isDirectory(path)) {
            try (var stream = Files.walk(path)) {
                stream.sorted(Comparator.reverseOrder())
                        .forEach(p -> {
                            try {
                                Files.delete(p);
                            } catch (IOException e) {
                                throw new RuntimeException("Failed to delete: " + p, e);
                            }
                        });
            }
        } else {
            Files.delete(path);
        }
    }
}
