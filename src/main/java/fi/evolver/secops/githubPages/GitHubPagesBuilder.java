///usr/bin/env jbang "$0" "$@" ; exit $?
//DEPS com.google.code.gson:gson:2.10.1
//DEPS org.freemarker:freemarker:2.3.33
//SOURCES model/*.java
//SOURCES loader/*.java
//SOURCES transformer/*.java
//SOURCES viewmodel/*.java
//SOURCES renderer/*.java

package fi.evolver.secops.githubPages;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonObject;
import fi.evolver.secops.githubPages.loader.ScanResultLoader;
import fi.evolver.secops.githubPages.loader.ScanResultLoader.RawScanData;
import fi.evolver.secops.githubPages.model.ScanMetadata;
import fi.evolver.secops.githubPages.model.ScanStats;
import fi.evolver.secops.githubPages.renderer.PageRenderer;
import fi.evolver.secops.githubPages.transformer.FindingsTransformer;
import fi.evolver.secops.githubPages.transformer.FindingsTransformer.TransformedScanData;
import fi.evolver.secops.githubPages.viewmodel.ViewModelBuilder;
import fi.evolver.secops.githubPages.viewmodel.ViewModelBuilder.ChannelSummary;
import fi.evolver.secops.githubPages.viewmodel.ViewModelBuilder.ScanEntry;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Stream;

/**
 * Main orchestrator for GitHub Pages generation.
 *
 * Architecture:
 * 1. Loader: reads JSON/MD files
 * 2. Transformer: converts to typed models with normalized severity
 * 3. ViewModelBuilder: creates FreeMarker-friendly models
 * 4. Renderer: renders templates and writes artifacts
 */
public class GitHubPagesBuilder {

    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

    public static void main(String[] args) throws Exception {
        if (args.length < 4) {
            System.err.println(
                    "Usage: GitHubPagesBuilder <output_dir> <pages_root> <scan_timestamp> <channel> [metadata_json]");
            System.exit(1);
        }

        String outputDir = args[0];
        String pagesRoot = args[1];
        String timestamp = args[2];
        String channel = args[3];
        String metadataJson = args.length > 4 ? args[4] : null;

        System.out.println("🏗️  Building GitHub Pages (New Data Structure) for scan: " + timestamp);

        Path pagesPath = Path.of(pagesRoot);
        
        // NEW: data/runs/<channel>/<timestamp>/ layout
        Path dataRunsPath = pagesPath.resolve("data").resolve("runs").resolve(channel).resolve(timestamp);
        Files.createDirectories(dataRunsPath);

        // Find templates directory
        Path templateDir = findTemplateDirectory(pagesRoot);
        System.out.println("Using templates from: " + templateDir.toAbsolutePath());

        // Initialize layers
        ScanResultLoader loader = new ScanResultLoader(GSON);
        FindingsTransformer transformer = new FindingsTransformer();
        ViewModelBuilder viewModelBuilder = new ViewModelBuilder();
        PageRenderer renderer = new PageRenderer(templateDir, GSON);

        // === LAYER 1: LOAD ===
        RawScanData rawData = loader.load(outputDir, metadataJson);

        // === LAYER 2: TRANSFORM ===
        TransformedScanData transformedData = transformer.transform(rawData);
        boolean hasDependabot = rawData.dependabotSummary != null && !rawData.dependabotSummary.isBlank();
        ScanStats currentStats = transformer.extractStats(
                rawData.trivyFs,
                rawData.trivyImage,
                rawData.semgrep,
                hasDependabot);
        ScanMetadata metadata = transformedData.metadata;

        // === LAYER 3: BUILD VIEW MODELS ===
        Map<String, Object> scanDetailModel = viewModelBuilder.buildScanDetailModel(
                transformedData,
                timestamp,
                channel,
                Path.of(outputDir));

        // === LAYER 4: RENDER & WRITE ===

        // 1) Copy JSON files to data/runs directory
        renderer.copyJsonFiles(outputDir, dataRunsPath);

        // 2) Write scan-metadata.json (deterministic artifact)
        renderer.writeMetadataJson(
                dataRunsPath,
                metadata.branch,
                metadata.commitSha,
                metadata.repository);

        // 3) Render scan detail page
        renderer.renderPage("scan_detail.ftl", scanDetailModel, dataRunsPath.resolve("index.html"));
        System.out.println("   ✅ Generated scan detail page");

        // NEW: Append to versioned scan-history
        appendScanHistory(pagesPath, channel, timestamp, currentStats, metadata);

        // 4) Update channel index
        updateChannelIndex(renderer, viewModelBuilder, transformer, pagesPath, channel);

        // 5) Update main index
        updateMainIndex(renderer, viewModelBuilder, transformer, pagesPath);

        // 6) Write CSS
        renderer.writeCss(pagesPath);
        System.out.println("   ✅ Generated CSS");

        System.out.println("✅ GitHub Pages built successfully!");
        System.out.println("   Scan page: " + dataRunsPath.resolve("index.html"));
    }

    private static void updateChannelIndex(
            PageRenderer renderer,
            ViewModelBuilder viewModelBuilder,
            FindingsTransformer transformer,
            Path pagesPath,
            String channel) throws Exception {
        
        Path channelRunsPath = pagesPath.resolve("data").resolve("runs").resolve(channel);
        Path channelIndexPath = pagesPath.resolve("data").resolve("channels").resolve(channel);
        Files.createDirectories(channelIndexPath);

        List<ScanEntry> scans = new ArrayList<>();
        
        if (Files.exists(channelRunsPath)) {
            try (Stream<Path> stream = Files.list(channelRunsPath)) {
                stream.filter(Files::isDirectory).forEach(scanDir -> {
                    String ts = scanDir.getFileName().toString();
                    if (Files.exists(scanDir.resolve("index.html"))) {
                        try {
                            ScanEntry e = new ScanEntry(ts, "../../runs/" + channel + "/" + ts);
                            e.linkHref = "../../runs/" + channel + "/" + ts + "/index.html";
                            e.stats = loadScanStats(transformer, scanDir);

                            // Load metadata for commit linking
                            Path mdPath = scanDir.resolve("scan-metadata.json");
                            if (Files.exists(mdPath)) {
                                JsonObject meta = GSON.fromJson(Files.readString(mdPath), JsonObject.class);
                                e.branch = getString(meta, "branch");
                                e.commit = getString(meta, "commit_sha");
                                e.repository = getString(meta, "repository");
                            }
                            scans.add(e);
                        } catch (Exception ex) {
                            System.err.println("⚠️  Skipping malformed scan " + ts + ": " + ex.getMessage());
                        }
                    }
                });
            } catch (IOException ex) {
                System.err.println("⚠️  Failed to list scans in channel " + channel + ": " + ex.getMessage());
            }
        }
        
        scans.sort((a, b) -> b.timestamp.compareTo(a.timestamp));

        String historyJsonPath = getHistoryJsonRelativePath(channelIndexPath, pagesPath);
        Map<String, Object> model = viewModelBuilder.buildChannelIndexModel(channel, scans, historyJsonPath);
        renderer.renderPage("channel_index.ftl", model, channelIndexPath.resolve("index.html"));
        System.out.println("   ✅ Updated channel index page");
    }

    private static void updateMainIndex(
            PageRenderer renderer,
            ViewModelBuilder viewModelBuilder,
            FindingsTransformer transformer,
            Path pagesPath) throws Exception {
        Path runsPath = pagesPath.resolve("data").resolve("runs");
        Map<String, List<ScanEntry>> channelScans = new TreeMap<>();

        if (Files.exists(runsPath)) {
            try (Stream<Path> stream = Files.list(runsPath)) {
                stream.filter(Files::isDirectory).forEach(channelDir -> {
                    String ch = channelDir.getFileName().toString();
                    List<ScanEntry> list = new ArrayList<>();
                    try (Stream<Path> scanStream = Files.list(channelDir)) {
                        scanStream.filter(Files::isDirectory).forEach(scanDir -> {
                            String ts = scanDir.getFileName().toString();
                            if (Files.exists(scanDir.resolve("index.html"))) {
                                try {
                                    ScanEntry e = new ScanEntry(ts, "data/runs/" + ch + "/" + ts);
                                    e.linkHref = e.path + "/index.html";
                                    e.stats = loadScanStats(transformer, scanDir);

                                    // Enrich with metadata
                                    Path mdPath = scanDir.resolve("scan-metadata.json");
                                    if (Files.exists(mdPath)) {
                                        JsonObject meta = GSON.fromJson(Files.readString(mdPath), JsonObject.class);
                                        e.branch = getString(meta, "branch");
                                        e.commit = getString(meta, "commit_sha");
                                        e.repository = getString(meta, "repository");
                                    }
                                    list.add(e);
                                } catch (Exception ex) {
                                    System.err.println("⚠️  Skipping malformed scan " + ch + "/" + ts + ": " + ex.getMessage());
                                }
                            }
                        });
                    } catch (IOException ex) {
                        System.err.println("⚠️  Failed to list scans in " + ch + ": " + ex.getMessage());
                    }
                    if (!list.isEmpty()) {
                        list.sort((a, b) -> b.timestamp.compareTo(a.timestamp));
                        channelScans.put(ch, list);
                    }
                });
            }
        }

        // Build channel summaries
        List<ChannelSummary> channels = new ArrayList<>();
        for (Map.Entry<String, List<ScanEntry>> e : channelScans.entrySet()) {
            List<ScanEntry> scans = e.getValue();
            ScanEntry latest = scans.get(0);

            ChannelSummary ch = new ChannelSummary();
            ch.name = e.getKey();
            ch.total = scans.size();
            ch.latestTs = latest.timestamp;
            ch.latestHuman = ViewModelBuilder.formatTimestamp(latest.timestamp);
            ch.viewAllHref = "data/channels/" + e.getKey() + "/index.html";
            ch.recent = scans.stream().limit(5).toList();
            channels.add(ch);
        }

        String historyJsonPath = getHistoryJsonRelativePath(pagesPath, pagesPath);
        Map<String, Object> model = viewModelBuilder.buildMainIndexModel(channels, historyJsonPath);
        renderer.renderPage("main_index.ftl", model, pagesPath.resolve("index.html"));
        System.out.println("   ✅ Updated main index page");
    }

    private static String getHistoryJsonRelativePath(Path fromDir, Path pagesPath) {
        Path historyFile = pagesPath.resolve("data").resolve("hist").resolve("scan-history.json");
        return fromDir.relativize(historyFile).toString().replace('\\', '/');
    }

    private static ScanStats loadScanStats(FindingsTransformer transformer, Path scanPath) {
        try {
            JsonObject trivyFs = loadJson(scanPath.resolve("trivy-fs-results.json"));
            JsonObject trivyImage = loadJson(scanPath.resolve("trivy-image-results.json"));
            JsonObject semgrep = loadJson(scanPath.resolve("semgrep-results.json"));
            boolean hasDependabot = Files.exists(scanPath.resolve("DEPENDABOT_SUMMARY.md"));

            return transformer.extractStats(trivyFs, trivyImage, semgrep, hasDependabot);
        } catch (Exception e) {
            System.err.println("⚠️  Failed to load stats for " + scanPath + ": " + e.getMessage());
            return new ScanStats();
        }
    }

    private static JsonObject loadJson(Path path) {
        if (!Files.exists(path)) {
            return null;
        }
        try {
            String content = Files.readString(path);
            if (content.isBlank()) {
                return null;
            }
            return GSON.fromJson(content, JsonObject.class);
        } catch (Exception e) {
            return null;
        }
    }

    private static String getString(JsonObject obj, String key) {
        if (obj == null || !obj.has(key) || obj.get(key).isJsonNull()) {
            return null;
        }
        String value = obj.get(key).getAsString();
        return (value != null && !value.isBlank()) ? value : null;
    }

    private static void appendScanHistory(Path pagesPath, String channel, String timestamp, ScanStats stats, ScanMetadata metadata) {
        try {
            Path histDir = pagesPath.resolve("data").resolve("hist");
            Files.createDirectories(histDir);
            Path historyPath = histDir.resolve("scan-history.json");

            ScanHistory history = readHistory(historyPath);
            
            // Remove duplicates
            history.scans.removeIf(entry -> channel.equals(entry.channel) && timestamp.equals(entry.timestamp));

            HistoryEntry entry = HistoryEntry.from(channel, timestamp, stats, metadata);
            history.scans.add(entry);
            history.scans.sort(Comparator.comparing(e -> e.timestamp));

            Files.writeString(historyPath, GSON.toJson(history), StandardCharsets.UTF_8);
            System.out.println("   ✅ Updated scan history");
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
            // Always upgrade to v2
            if (history.version < 2) {
                System.out.println("   📦 Upgrading scan history from v" + history.version + " to v2");
                history.version = 2;
            }
            // Validate and filter out malformed entries
            List<HistoryEntry> valid = new ArrayList<>();
            for (HistoryEntry entry : history.scans) {
                if (entry.channel == null || entry.timestamp == null) {
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

    private static Path findTemplateDirectory(String pagesRoot) throws IOException {
        List<Path> possibleLocations = new ArrayList<>();

        // GitHub Actions: GITHUB_ACTION_PATH
        String actionPath = System.getenv("GITHUB_ACTION_PATH");
        if (actionPath != null) {
            possibleLocations.add(Path.of(actionPath).resolve("../../../scripts/templates").normalize());
        }

        // GitHub Actions: GITHUB_WORKSPACE
        String workspace = System.getenv("GITHUB_WORKSPACE");
        if (workspace != null) {
            possibleLocations.add(Path.of(workspace).resolve("scripts/templates"));
        }

        // Relative paths
        possibleLocations.add(Path.of("scripts/templates"));
        possibleLocations.add(Path.of("templates"));
        possibleLocations.add(Path.of("../templates"));
        possibleLocations.add(Path.of(pagesRoot).resolve("templates"));

        for (Path location : possibleLocations) {
            if (Files.isDirectory(location)) {
                return location;
            }
        }

        StringBuilder errorMsg = new StringBuilder("❌ templates directory not found. Tried locations:\n");
        for (Path loc : possibleLocations) {
            errorMsg.append("  - ").append(loc.toAbsolutePath()).append("\n");
        }
        throw new IOException(errorMsg.toString());
    }
}
