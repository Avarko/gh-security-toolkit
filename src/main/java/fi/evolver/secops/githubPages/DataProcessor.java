package fi.evolver.secops.githubPages;

import com.google.gson.Gson;
import fi.evolver.secops.githubPages.loader.ScanResultLoader;
import fi.evolver.secops.githubPages.loader.ScanResultLoader.RawScanData;
import fi.evolver.secops.githubPages.model.HistoryEntry;
import fi.evolver.secops.githubPages.model.HistoryStats;
import fi.evolver.secops.githubPages.model.ScanHistory;
import fi.evolver.secops.githubPages.model.ScanMetadata;
import fi.evolver.secops.githubPages.model.ScanStats;
import fi.evolver.secops.githubPages.model.TestReportHistory;
import fi.evolver.secops.githubPages.transformer.FindingsTransformer;
import fi.evolver.secops.githubPages.transformer.FindingsTransformer.TransformedScanData;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;

/**
 * Processes scan data: loads, transforms, and writes to data directories.
 * Stateless utility class with static methods.
 */
public final class DataProcessor {

    /** Maximum number of entries in scan-history.json before oldest are removed */
    public static final int MAX_HISTORY_ENTRIES = 500;

    private DataProcessor() {
        // Utility class - no instantiation
    }

    /**
     * Result of data processing containing metadata and stats.
     */
    public static class ProcessingResult {
        public final ScanMetadata metadata;
        public final HistoryStats stats;
        public final Path dataRunsPath;

        public ProcessingResult(ScanMetadata metadata, HistoryStats stats, Path dataRunsPath) {
            this.metadata = metadata;
            this.stats = stats;
            this.dataRunsPath = dataRunsPath;
        }
    }

    /**
     * Processes scan data from output directory and writes to tenant data root.
     *
     * @param gson Gson instance for JSON operations
     * @param outputDir Directory containing scan outputs
     * @param dataRoot Tenant's data root directory
     * @param channel Channel name (e.g., "nightly", "pr-123")
     * @param isoTimestamp ISO timestamp for display purposes
     * @param compactTimestamp Compact timestamp for file paths
     * @param configMetadata Metadata from configuration (branch, repository, commitSha)
     * @return ProcessingResult with metadata and stats
     * @throws IOException if file operations fail
     */
    public static ProcessingResult process(
            Gson gson,
            String outputDir,
            Path dataRoot,
            String channel,
            String isoTimestamp,
            String compactTimestamp,
            ConfigParser.Metadata configMetadata) throws IOException {

        // Create runs directory for this scan
        Path dataRunsPath = dataRoot
                .resolve("runs")
                .resolve(channel)
                .resolve(compactTimestamp);
        Files.createDirectories(dataRunsPath);

        // === LOAD & TRANSFORM ===
        ScanResultLoader loader = new ScanResultLoader(gson);
        FindingsTransformer transformer = new FindingsTransformer();

        RawScanData rawData = loader.load(outputDir, null);
        TransformedScanData transformedData = transformer.transform(rawData, isoTimestamp);

        boolean hasDependabot = rawData.dependabotSummary != null
                && !rawData.dependabotSummary.isBlank();

        // Use metadata from config (if available), otherwise use empty metadata
        ScanMetadata metadata = configMetadata != null
                ? new ScanMetadata(
                        configMetadata.branch,
                        configMetadata.commitSha,
                        configMetadata.repository,
                        isoTimestamp)
                : ScanMetadata.empty(isoTimestamp);

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

        // 2) Write concise scan metadata
        writeMetadataJson(gson, dataRunsPath, metadata);

        // 3) Update tenant-specific history file based on type
        if (configMetadata == null || configMetadata.isSecurityScan()) {
            appendScanHistory(gson, dataRoot, channel, compactTimestamp, metadata, historyStats);
        } else if ("test-report".equals(configMetadata.type)) {
            // Check which reports are available by looking at copied directories
            boolean hasJacoco = Files.isDirectory(dataRunsPath.resolve("coverage"));
            boolean hasSurefire = Files.isDirectory(dataRunsPath.resolve("tests"));
            appendTestReportHistory(gson, dataRoot, channel, compactTimestamp, metadata, hasJacoco, hasSurefire);
        } else {
            System.out.println("   ℹ️  Skipping history update (unknown type: " + configMetadata.type + ")");
        }

        System.out.println("✅ Data processing complete!");
        System.out.println("   Run data: " + dataRunsPath);

        return new ProcessingResult(metadata, historyStats, dataRunsPath);
    }

    /**
     * Copies scan result JSON files from source directory to target directory.
     */
    private static void copyJsonFiles(String sourceDir, Path targetDir) throws IOException {
        Path source = Path.of(sourceDir);
        String[] files = {
                "trivy-fs-results.json",
                "trivy-image-results.json",
                "semgrep-results.json",
                "DEPENDABOT_SUMMARY.md"
        };

        for (String filename : files) {
            Path srcFile = source.resolve(filename);
            if (Files.exists(srcFile)) {
                Files.copy(srcFile, targetDir.resolve(filename), StandardCopyOption.REPLACE_EXISTING);
                System.out.println("   ✅ Copied " + filename);
            }
        }
    }

    /**
     * Writes scan metadata JSON to target directory.
     */
    private static void writeMetadataJson(Gson gson, Path targetDir, ScanMetadata metadata) throws IOException {
        var metadataInner = new HashMap<String, String>();
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

        var json = new HashMap<String, Object>();
        json.put("timestamp", metadata != null ? metadata.timestamp : "");
        json.put("metadata", metadataInner);

        Path metaPath = targetDir.resolve("scan-run.json");
        Files.writeString(metaPath, gson.toJson(json), StandardCharsets.UTF_8);
        System.out.println("   ✅ Wrote scan-run.json");
    }

    /**
     * Appends a new entry to scan-history.json with retention limit.
     * If history exceeds MAX_HISTORY_ENTRIES, oldest entries are removed.
     */
    private static void appendScanHistory(
            Gson gson,
            Path dataRoot,
            String channel,
            String timestamp,
            ScanMetadata metadata,
            HistoryStats stats) {
        try {
            Path histDir = dataRoot.resolve("hist");
            Files.createDirectories(histDir);
            Path historyPath = histDir.resolve("scan-history.json");

            ScanHistory history = readHistory(gson, historyPath);

            // Remove possible duplicate for the same channel+timestamp combination
            history.scans.removeIf(entry -> channel.equals(entry.channel)
                    && timestamp.equals(entry.timestamp));

            HistoryEntry entry = HistoryEntry.from(channel, timestamp, metadata, stats);
            history.scans.add(entry);
            history.scans.sort(Comparator.comparing(e -> e.timestamp));

            // Enforce retention limit: remove oldest entries if over limit
            if (history.scans.size() > MAX_HISTORY_ENTRIES) {
                int toRemove = history.scans.size() - MAX_HISTORY_ENTRIES;
                System.out.println("   📦 Removing " + toRemove + " oldest scan history entries (limit: " + MAX_HISTORY_ENTRIES + ")");
                history.scans = new ArrayList<>(history.scans.subList(toRemove, history.scans.size()));
            }

            Files.writeString(historyPath, gson.toJson(history), StandardCharsets.UTF_8);
            System.out.println("   ✅ Updated scan-history.json at " + historyPath + " (" + history.scans.size() + " entries)");
        } catch (Exception e) {
            System.err.println("⚠️  Failed to append scan history: " + e.getMessage());
        }
    }

    /**
     * Reads existing scan history from JSON file.
     */
    private static ScanHistory readHistory(Gson gson, Path historyPath) {
        if (!Files.exists(historyPath)) {
            return new ScanHistory();
        }
        try {
            String json = Files.readString(historyPath);
            if (json == null || json.isBlank()) {
                return new ScanHistory();
            }

            ScanHistory history = gson.fromJson(json, ScanHistory.class);
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
            ArrayList<HistoryEntry> valid = new ArrayList<>();
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
     * Appends a new entry to test-report-history.json with retention limit.
     */
    private static void appendTestReportHistory(
            Gson gson,
            Path dataRoot,
            String channel,
            String timestamp,
            ScanMetadata metadata,
            boolean hasJacoco,
            boolean hasSurefire) {
        try {
            Path histDir = dataRoot.resolve("hist");
            Files.createDirectories(histDir);
            Path historyPath = histDir.resolve("test-report-history.json");

            TestReportHistory history = readTestReportHistory(gson, historyPath);

            // Remove possible duplicate for the same channel+timestamp combination
            history.reports.removeIf(entry -> channel.equals(entry.channel)
                    && timestamp.equals(entry.timestamp));

            TestReportHistory.TestReportEntry entry = TestReportHistory.TestReportEntry.from(
                    channel, timestamp, metadata, hasJacoco, hasSurefire);
            history.reports.add(entry);
            history.reports.sort(Comparator.comparing(e -> e.timestamp));

            // Enforce retention limit: remove oldest entries if over limit
            if (history.reports.size() > MAX_HISTORY_ENTRIES) {
                int toRemove = history.reports.size() - MAX_HISTORY_ENTRIES;
                System.out.println("   📦 Removing " + toRemove + " oldest test report history entries (limit: " + MAX_HISTORY_ENTRIES + ")");
                history.reports = new ArrayList<>(history.reports.subList(toRemove, history.reports.size()));
            }

            Files.writeString(historyPath, gson.toJson(history), StandardCharsets.UTF_8);
            System.out.println("   ✅ Updated test-report-history.json at " + historyPath + " (" + history.reports.size() + " entries)");
        } catch (Exception e) {
            System.err.println("⚠️  Failed to append test report history: " + e.getMessage());
        }
    }

    /**
     * Reads existing test report history from JSON file.
     */
    private static TestReportHistory readTestReportHistory(Gson gson, Path historyPath) {
        if (!Files.exists(historyPath)) {
            return new TestReportHistory();
        }
        try {
            String json = Files.readString(historyPath);
            if (json == null || json.isBlank()) {
                return new TestReportHistory();
            }

            TestReportHistory history = gson.fromJson(json, TestReportHistory.class);
            if (history == null) {
                System.err.println("⚠️  Test report history JSON is null, starting fresh");
                return new TestReportHistory();
            }
            if (history.reports == null) {
                history.reports = new ArrayList<>();
            }

            // Filter out broken entries
            ArrayList<TestReportHistory.TestReportEntry> valid = new ArrayList<>();
            for (TestReportHistory.TestReportEntry entry : history.reports) {
                if (entry == null || entry.channel == null || entry.timestamp == null) {
                    System.err.println("⚠️  Skipping test report entry with missing channel or timestamp");
                    continue;
                }
                valid.add(entry);
            }
            history.reports = valid;

            return history;
        } catch (Exception e) {
            System.err.println("⚠️  Failed to read existing test report history (corrupt format): " + e.getMessage());
            return new TestReportHistory();
        }
    }
}
