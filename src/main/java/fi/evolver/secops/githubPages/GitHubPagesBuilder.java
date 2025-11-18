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
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Data processor for security scan results.
 *
 * Responsibilities:
 * 1. Load scan results (Trivy, Semgrep, etc.)
 * 2. Transform and normalize data
 * 3. Write structured JSON to
 * data/<org>/<app>/<repo>/runs/<channel>/<timestamp>/
 * 4. Maintain
 * data/<org>/<app>/<repo>/hist/scan-history.json
 *
 * Tenant resolution:
 * - If org/app/repo CLI-arguments are given, they are used:
 * <pages_root>/data/<org>/<app>/<repo>
 * - Otherwise, defaults.json (single-tenant mode) is read if available.
 * - If neither is available, the legacy path is used:
 * <pages_root>/data
 *
 * UI rendering is done in a separate React dashboard.
 *
 * Usage:
 * GitHubPagesBuilder <output_dir> <pages_root> <scan_timestamp> <channel>
 * [metadata_json] [dashboard_dir]
 * [org_slug] [app_slug] [repo_slug]
 */
public class GitHubPagesBuilder {

    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

    public static void main(String[] args) throws Exception {
        if (args.length < 4) {
            System.err.println(
                    "Usage: GitHubPagesBuilder <output_dir> <pages_root> <scan_timestamp> <channel> "
                            + "[metadata_json] [dashboard_dir] [org_slug] [app_slug] [repo_slug]");
            System.exit(1);
        }

        String outputDir = args[0];
        String pagesRoot = args[1];
        String timestamp = args[2];
        String channel = args[3];
        String metadataJson = args.length > 4 && !args[4].isEmpty() ? args[4] : null;
        String dashboardDir = args.length > 5 && !args[5].isEmpty() ? args[5] : null;

        String orgSlug = args.length > 6 && !args[6].isEmpty() ? args[6] : null;
        String appSlug = args.length > 7 && !args[7].isEmpty() ? args[7] : null;
        String repoSlug = args.length > 8 && !args[8].isEmpty() ? args[8] : null;

        System.out.println("📦 Processing scan data for: " + timestamp);
        System.out.println("   Channel: " + channel);

        Path pagesPath = Path.of(pagesRoot);

        // Tenant configuration (CLI slugs > defaults.json > legacy /data)
        TenantConfig tenantConfig = TenantConfig.loadOrDefault(pagesPath);
        Path dataRoot = tenantConfig.resolveDataRoot(pagesPath, orgSlug, appSlug, repoSlug);

        // Merge dashboard build artifacts first
        if (dashboardDir != null) {
            mergeDashboard(pagesPath, Path.of(dashboardDir));
        }

        Path dataRunsPath = dataRoot
                .resolve("runs")
                .resolve(channel)
                .resolve(timestamp);
        Files.createDirectories(dataRunsPath);

        // === LOAD & TRANSFORM ===
        ScanResultLoader loader = new ScanResultLoader(GSON);
        FindingsTransformer transformer = new FindingsTransformer();

        RawScanData rawData = loader.load(outputDir, metadataJson);
        TransformedScanData transformedData = transformer.transform(rawData);

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

        // 3) Update tenant-specific scan-history.json
        appendScanHistory(dataRoot, channel, timestamp, metadata, historyStats);

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
        var json = new java.util.HashMap<String, String>();
        if (metadata != null) {
            if (metadata.branch != null) {
                json.put("branch", metadata.branch);
            }
            if (metadata.commit != null) {
                json.put("commit", metadata.commit);
            }
            if (metadata.repository != null) {
                json.put("repository", metadata.repository);
            }
        }

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
}
