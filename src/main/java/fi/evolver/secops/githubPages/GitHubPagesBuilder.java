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
import fi.evolver.secops.githubPages.model.ScanMetadata;
import fi.evolver.secops.githubPages.model.ScanStats;
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
 * If org/app/repo slugs are not provided, falls back to legacy layout:
 * data/runs/<channel>/<timestamp>/
 * data/hist/scan-history.json
 *
 * UI rendering is handled separately by the React dashboard.
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
        TenantConfig tenant = TenantConfig.load(pagesPath);
        Path dataRoot = tenant.resolveDataRoot(pagesPath);

        // Merge dashboard first if provided
        if (dashboardDir != null) {
            mergeDashboard(pagesPath, Path.of(dashboardDir));
        }

        Path dataRunsPath = dataRoot.resolve("runs").resolve(channel).resolve(timestamp);
        Files.createDirectories(dataRunsPath);

        // Initialize data processors
        ScanResultLoader loader = new ScanResultLoader(GSON);
        FindingsTransformer transformer = new FindingsTransformer();

        // === LOAD & TRANSFORM ===
        RawScanData rawData = loader.load(outputDir, metadataJson);
        TransformedScanData transformedData = transformer.transform(rawData);
        boolean hasDependabot = rawData.dependabotSummary != null && !rawData.dependabotSummary.isBlank();
        ScanStats currentStats = transformer.extractStats(
                rawData.trivyFs,
                rawData.trivyImage,
                rawData.semgrep,
                hasDependabot);
        ScanMetadata metadata = transformedData.metadata;

        // === WRITE DATA ===

        // 1) Copy scan result JSONs to data/runs directory
        copyJsonFiles(outputDir, dataRunsPath);

        // 2) Write scan-metadata.json
        writeMetadataJson(dataRunsPath, metadata);

        // 3) Update scan-history.json
        appendScanHistory(dataRoot, channel, timestamp, currentStats, metadata);

        System.out.println("✅ Data processing complete!");
        System.out.println("   Run data: " + dataRunsPath);
    }

    /**
     * Resolves the tenant root directory for data:
     *
     * If org/app/repo are provided:
     * <pagesRoot>/data/<org>/<app>/<repo>
     *
     * Otherwise (legacy mode):
     * <pagesRoot>/data
     */
    private static Path resolveTenantRoot(Path pagesPath, String orgSlug, String appSlug, String repoSlug)
            throws IOException {
        Path dataRoot = pagesPath.resolve("data");

        if (orgSlug != null && appSlug != null && repoSlug != null) {
            Path tenantRoot = dataRoot.resolve(orgSlug).resolve(appSlug).resolve(repoSlug);
            Files.createDirectories(tenantRoot);
            System.out.println("   Tenant data root: " + tenantRoot);
            return tenantRoot;
        }

        // Legacy fallback
        Files.createDirectories(dataRoot);
        System.out.println("   ⚠️  No org/app/repo slugs provided - using legacy data layout under: " + dataRoot);
        return dataRoot;
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
        if (metadata.branch != null)
            json.put("branch", metadata.branch);
        if (metadata.commitSha != null)
            json.put("commit_sha", metadata.commitSha);
        if (metadata.repository != null)
            json.put("repository", metadata.repository);

        Path metaPath = targetDir.resolve("scan-metadata.json");
        Files.writeString(metaPath, GSON.toJson(json), StandardCharsets.UTF_8);
        System.out.println("   ✅ Wrote scan-metadata.json");
    }

    private static void appendScanHistory(Path dataRoot,
            String channel,
            String timestamp,
            ScanStats stats,
            ScanMetadata metadata) {
        try {
            Path histDir = dataRoot.resolve("hist");
            Files.createDirectories(histDir);
            Path historyPath = histDir.resolve("scan-history.json");

            ScanHistory history = readHistory(historyPath);

            history.scans.removeIf(entry -> channel.equals(entry.channel) && timestamp.equals(entry.timestamp));

            HistoryEntry entry = HistoryEntry.from(channel, timestamp, stats, metadata);
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

            // Varmista versionumero
            if (history.version < 2) {
                System.out.println("   📦 Upgrading scan history from v" + history.version + " to v2");
                history.version = 2;
            }

            // Filteröi rikkinäiset entryt pois
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

    private static class ScanHistory {
        int version = 2;
        List<HistoryEntry> scans = new ArrayList<>();
    }

    private static class HistoryEntry {
        String channel;
        String timestamp;
        HistoryStats stats;
        HistoryMetadata metadata;

        static HistoryEntry from(String channel, String timestamp, ScanStats stats, ScanMetadata metadata) {
            HistoryEntry entry = new HistoryEntry();
            entry.channel = channel;
            entry.timestamp = timestamp;
            if (stats == null) {
                stats = new ScanStats();
            }
            entry.stats = new HistoryStats();
            entry.stats.trivyFs = SeverityCounts.from(stats.trivyFs);
            entry.stats.trivyFsMisconfig = SeverityCounts.from(stats.trivyFsMisconfig);
            entry.stats.trivyImage = SeverityCounts.from(stats.trivyImage);
            entry.stats.trivyImageMisconfig = SeverityCounts.from(stats.trivyImageMisconfig);
            entry.stats.semgrep = SemgrepCounts.from(stats);

            if (metadata != null) {
                entry.metadata = new HistoryMetadata();
                entry.metadata.branch = metadata.branch;
                entry.metadata.commitSha = metadata.commitSha;
                entry.metadata.repository = metadata.repository;
            }
            return entry;
        }
    }

    private static final class TenantConfig {
        String mode;
        String defaultOrg;
        String defaultApp;
        String defaultRepo;

        static TenantConfig load(Path pagesRoot) {
            Path defaults = pagesRoot.resolve("data").resolve("defaults.json");
            if (!Files.exists(defaults)) {
                // fallback: vanha single-tenant data-root /data
                TenantConfig cfg = new TenantConfig();
                cfg.mode = "multi-tenant";
                return cfg;
            }
            try {
                String json = Files.readString(defaults, StandardCharsets.UTF_8);
                return GSON.fromJson(json, TenantConfig.class);
            } catch (IOException e) {
                System.err.println("⚠️  Failed to read defaults.json, using legacy data root: " + e.getMessage());
                TenantConfig cfg = new TenantConfig();
                cfg.mode = "multi-tenant";
                return cfg;
            }
        }

        Path resolveDataRoot(Path pagesRoot) {
            Path base = pagesRoot.resolve("data");
            if (!"single-tenant".equalsIgnoreCase(mode)) {
                return base; // multi-tenant: vanha /data
            }
            if (defaultOrg == null || defaultApp == null || defaultRepo == null) {
                System.err.println("⚠️  defaults.json is missing org/app/repo, falling back to /data");
                return base;
            }
            return base.resolve(defaultOrg).resolve(defaultApp).resolve(defaultRepo);
        }
    }

    private static class HistoryMetadata {
        String branch;
        String commitSha;
        String repository;
    }

    private static class HistoryStats {
        SeverityCounts trivyFs;
        SeverityCounts trivyFsMisconfig;
        SeverityCounts trivyImage;
        SeverityCounts trivyImageMisconfig;
        SemgrepCounts semgrep;
    }

    private static class SeverityCounts {
        int critical;
        int high;
        int medium;
        int low;
        boolean scanned;

        static SeverityCounts from(ScanStats.VulnStats stats) {
            SeverityCounts counts = new SeverityCounts();
            if (stats == null) {
                return counts;
            }
            counts.critical = stats.critical;
            counts.high = stats.high;
            counts.medium = stats.medium;
            counts.low = stats.low;
            counts.scanned = stats.scanned;
            return counts;
        }
    }

    private static class SemgrepCounts {
        int errors;
        int warnings;
        int info;

        static SemgrepCounts from(ScanStats stats) {
            SemgrepCounts counts = new SemgrepCounts();
            if (stats == null) {
                return counts;
            }
            counts.errors = stats.semgrepErrors;
            counts.warnings = stats.semgrepWarnings;
            counts.info = stats.semgrepInfo;
            return counts;
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
