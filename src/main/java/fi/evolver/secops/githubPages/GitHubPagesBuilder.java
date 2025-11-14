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
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
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

        System.out.println("🏗️  Building GitHub Pages (Layered Architecture) for scan: " + timestamp);

        Path pagesPath = Path.of(pagesRoot);
        Path scansPath = pagesPath.resolve("scans");
        Path scanPath = scansPath.resolve(channel).resolve(timestamp);
        Files.createDirectories(scanPath);

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
        ScanMetadata metadata = transformedData.metadata;

        // === LAYER 3: BUILD VIEW MODELS ===
        Map<String, Object> scanDetailModel = viewModelBuilder.buildScanDetailModel(
                transformedData,
                timestamp,
                channel,
                Path.of(outputDir));

        // === LAYER 4: RENDER & WRITE ===

        // 1) Copy JSON files to scan directory
        renderer.copyJsonFiles(outputDir, scanPath);

        // 2) Write scan-metadata.json (deterministic artifact)
        renderer.writeMetadataJson(
                scanPath,
                metadata.branch,
                metadata.commitSha,
                metadata.repository);

        // 3) Render scan detail page
        renderer.renderPage("scan_detail.ftl", scanDetailModel, scanPath.resolve("index.html"));
        System.out.println("   ✅ Generated scan detail page");

        // 4) Update channel index
        updateChannelIndex(renderer, viewModelBuilder, transformer, scansPath.resolve(channel), pagesPath, channel);

        // 5) Update main index
        updateMainIndex(renderer, viewModelBuilder, transformer, pagesPath);

        // 6) Write CSS
        renderer.writeCss(pagesPath);
        System.out.println("   ✅ Generated CSS");

        System.out.println("✅ GitHub Pages built successfully!");
        System.out.println("   Scan page: " + scanPath.resolve("index.html"));
    }

    private static void updateChannelIndex(
            PageRenderer renderer,
            ViewModelBuilder viewModelBuilder,
            FindingsTransformer transformer,
            Path channelPath,
            Path pagesPath,
            String channel) throws Exception {
        Files.createDirectories(channelPath);

        List<ScanEntry> scans = new ArrayList<>();
        try (Stream<Path> stream = Files.list(channelPath)) {
            stream.filter(Files::isDirectory).forEach(scanDir -> {
                String ts = scanDir.getFileName().toString();
                if (Files.exists(scanDir.resolve("index.html"))) {
                    ScanEntry e = new ScanEntry(ts, "scans/" + channel + "/" + ts);
                    e.linkHref = ts + "/index.html"; // For channel index page
                    e.stats = loadScanStats(transformer, scanDir);

                    // Load metadata for commit linking
                    try {
                        Path mdPath = scanDir.resolve("scan-metadata.json");
                        if (Files.exists(mdPath)) {
                            JsonObject meta = GSON.fromJson(Files.readString(mdPath), JsonObject.class);
                            e.branch = getString(meta, "branch");
                            e.commit = getString(meta, "commit_sha");
                            e.repository = getString(meta, "repository");
                        }
                    } catch (Exception ex) {
                        System.err.println("⚠️  Failed to load metadata for " + ts + ": " + ex.getMessage());
                    }
                    scans.add(e);
                }
            });
        }
        scans.sort((a, b) -> b.timestamp.compareTo(a.timestamp));

        Map<String, Object> model = viewModelBuilder.buildChannelIndexModel(channel, scans);
        renderer.renderPage("channel_index.ftl", model, channelPath.resolve("index.html"));
        System.out.println("   ✅ Updated channel index page");
    }

    private static void updateMainIndex(
            PageRenderer renderer,
            ViewModelBuilder viewModelBuilder,
            FindingsTransformer transformer,
            Path pagesPath) throws Exception {
        Path scansPath = pagesPath.resolve("scans");
        Map<String, List<ScanEntry>> channelScans = new TreeMap<>();

        if (Files.exists(scansPath)) {
            try (Stream<Path> stream = Files.list(scansPath)) {
                stream.filter(Files::isDirectory).forEach(channelDir -> {
                    String ch = channelDir.getFileName().toString();
                    List<ScanEntry> list = new ArrayList<>();
                    try (Stream<Path> scanStream = Files.list(channelDir)) {
                        scanStream.filter(Files::isDirectory).forEach(scanDir -> {
                            String ts = scanDir.getFileName().toString();
                            if (Files.exists(scanDir.resolve("index.html"))) {
                                ScanEntry e = new ScanEntry(ts, "scans/" + ch + "/" + ts);
                                e.linkHref = e.path + "/index.html"; // For main index page
                                e.stats = loadScanStats(transformer, scanDir);

                                // Enrich with metadata
                                try {
                                    Path mdPath = scanDir.resolve("scan-metadata.json");
                                    if (Files.exists(mdPath)) {
                                        JsonObject meta = GSON.fromJson(Files.readString(mdPath), JsonObject.class);
                                        e.branch = getString(meta, "branch");
                                        e.commit = getString(meta, "commit_sha");
                                        e.repository = getString(meta, "repository");
                                    }
                                } catch (Exception ignored) {
                                }
                                list.add(e);
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
            ch.viewAllHref = "scans/" + e.getKey() + "/index.html";
            ch.recent = scans.stream().limit(5).toList();
            channels.add(ch);
        }

        Map<String, Object> model = viewModelBuilder.buildMainIndexModel(channels);
        renderer.renderPage("main_index.ftl", model, pagesPath.resolve("index.html"));
        System.out.println("   ✅ Updated main index page");
    }

    private static ScanStats loadScanStats(FindingsTransformer transformer, Path scanPath) {
        try {
            JsonObject trivyFs = loadJson(scanPath.resolve("trivy-fs-results.json"));
            JsonObject trivyImage = loadJson(scanPath.resolve("trivy-image-results.json"));
            JsonObject opengrep = loadJson(scanPath.resolve("opengrep-results.json"));
            boolean hasDependabot = Files.exists(scanPath.resolve("DEPENDABOT_SUMMARY.md"));

            return transformer.extractStats(trivyFs, trivyImage, opengrep, hasDependabot);
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
