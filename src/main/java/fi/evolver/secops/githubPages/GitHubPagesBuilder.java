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
 * 3. Write structured JSON to data/runs/<channel>/<timestamp>/
 * 4. Maintain data/hist/scan-history.json
 *
 * UI rendering is handled separately by the React+Remix dashboard.
 */
public class GitHubPagesBuilder {

    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

    public static void main(String[] args) throws Exception {
        if (args.length < 4) {
            System.err.println(
                    "Usage: GitHubPagesBuilder <output_dir> <pages_root> <scan_timestamp> <channel> [metadata_json] [dashboard_dir]");
            System.exit(1);
        }

        String outputDir = args[0];
        String pagesRoot = args[1];
        String timestamp = args[2];
        String channel = args[3];
        String metadataJson = args.length > 4 && !args[4].isEmpty() ? args[4] : null;
        String dashboardDir = args.length > 5 && !args[5].isEmpty() ? args[5] : null;

        System.out.println("📦 Processing scan data for: " + timestamp);

        Path pagesPath = Path.of(pagesRoot);

        // Merge dashboard first if provided
        if (dashboardDir != null) {
            mergeDashboard(pagesPath, Path.of(dashboardDir));
        }

        Path dataRunsPath = pagesPath.resolve("data").resolve("runs").resolve(channel).resolve(timestamp);
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
        appendScanHistory(pagesPath, channel, timestamp, currentStats, metadata);

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

    private static void appendScanHistory(Path pagesPath, String channel, String timestamp, ScanStats stats,
            ScanMetadata metadata) {
        try {
            Path histDir = pagesPath.resolve("data").resolve("hist");
            Files.createDirectories(histDir);
            Path historyPath = histDir.resolve("scan-history.json");

            ScanHistory history = readHistory(historyPath);

            // Remove duplicates
            history.entries.removeIf(entry -> channel.equals(entry.channel) && timestamp.equals(entry.timestamp));

            HistoryEntry entry = HistoryEntry.from(channel, timestamp, stats, metadata);
            history.entries.add(entry);
            history.entries.sort(Comparator.comparing(e -> e.timestamp));

            Files.writeString(historyPath, GSON.toJson(history), StandardCharsets.UTF_8);
            System.out.println("   ✅ Updated scan-history.json");
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
            if (history.entries == null) {
                history.entries = new ArrayList<>();
            }
            // Always upgrade to v2
            if (history.version < 2) {
                System.out.println("   📦 Upgrading scan history from v" + history.version + " to v2");
                history.version = 2;
            }
            // Validate and filter out malformed entries
            List<HistoryEntry> valid = new ArrayList<>();
            for (HistoryEntry entry : history.entries) {
                if (entry.channel == null || entry.timestamp == null) {
                    System.err.println("⚠️  Skipping history entry with missing channel or timestamp");
                    continue;
                }
                valid.add(entry);
            }
            history.entries = valid;
            return history;
        } catch (Exception e) {
            System.err.println("⚠️  Failed to read existing scan history (corrupt format): " + e.getMessage());
            return new ScanHistory();
        }
    }

    private static class ScanHistory {
        int version = 2;
        List<HistoryEntry> entries = new ArrayList<>();
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
