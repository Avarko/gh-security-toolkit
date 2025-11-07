///usr/bin/env jbang "$0" "$@" ; exit $?
//DEPS com.google.code.gson:gson:2.10.1
//DEPS org.freemarker:freemarker:2.3.33

import com.google.gson.*;
import freemarker.template.*;
import freemarker.core.HTMLOutputFormat;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.*;
import java.time.format.*;
import java.util.*;
import java.util.stream.*;

/**
 * GitHub Pages builder for security scan results (FreeMarker-versio).
 *
 * Käyttö:
 * jbang github_pages_builder.java <output_dir> <pages_root> <scan_timestamp>
 * <channel> [metadata_json]
 *
 * Muutos pääkohdat:
 * - Kaikki HTML generoidaan FreeMarker-templaateilla (templates/*.ftl)
 * - Java-koodi täyttää vain datamallin ja kirjoittaa .html-tiedostot
 */
public class github_pages_builder {

    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

    // --------- FreeMarker ----------
    private static Configuration fmCfg(Path templateDir) throws IOException {
        Configuration cfg = new Configuration(Configuration.VERSION_2_3_33);
        cfg.setDirectoryForTemplateLoading(templateDir.toFile());
        cfg.setDefaultEncoding("UTF-8");
        cfg.setOutputFormat(HTMLOutputFormat.INSTANCE); // auto-escape
        cfg.setLogTemplateExceptions(false);
        cfg.setWrapUncheckedExceptions(true);
        cfg.setTemplateExceptionHandler(TemplateExceptionHandler.RETHROW_HANDLER);
        return cfg;
    }

    private static void render(Template tpl, Map<String, Object> model, Path outFile)
            throws IOException, TemplateException {
        Files.createDirectories(outFile.getParent());
        try (Writer w = Files.newBufferedWriter(outFile, StandardCharsets.UTF_8)) {
            tpl.process(model, w);
        }
    }

    // --------- main ----------
    public static void main(String[] args) throws Exception {
        if (args.length < 4) {
            System.err.println(
                    "Usage: github_pages_builder.java <output_dir> <pages_root> <scan_timestamp> <channel> [metadata_json]");
            System.exit(1);
        }

        String outputDir = args[0];
        String pagesRoot = args[1];
        String timestamp = args[2];
        String channel = args[3];
        String metadataJson = args.length > 4 ? args[4] : null;

        System.out.println("🏗️  Building GitHub Pages (FreeMarker) for scan: " + timestamp);

        Path pagesPath = Paths.get(pagesRoot);
        Path scansPath = pagesPath.resolve("scans");
        Path scanPath = scansPath.resolve(channel).resolve(timestamp);
        Files.createDirectories(scanPath);

        // Lataa tulokset
        ScanResults results = loadScanResults(outputDir, metadataJson);

        // Kopioi JSONit talteen skanin kansioon
        copyJsonFiles(outputDir, scanPath);

        // FreeMarker templates -kansio
        // Oletus: templates/ on scripts/ hakemiston alla (scriptin vieressä)
        Path templateDir = null;

        // Yritä löytää templates useista sijainneista
        List<Path> possibleLocations = new ArrayList<>();

        // GitHub Actions: GITHUB_ACTION_PATH sisältää action-hakemiston polun
        String actionPath = System.getenv("GITHUB_ACTION_PATH");
        if (actionPath != null) {
            possibleLocations.add(Paths.get(actionPath).resolve("../../../scripts/templates").normalize());
        }

        // GitHub Actions: GITHUB_WORKSPACE sisältää repositoryn juurihakemiston
        String workspace = System.getenv("GITHUB_WORKSPACE");
        if (workspace != null) {
            possibleLocations.add(Paths.get(workspace).resolve("scripts/templates"));
        }

        // Perinteiset sijainnit
        possibleLocations.add(Paths.get("scripts/templates")); // Suhteellinen polku
        possibleLocations.add(Paths.get("templates")); // Local development
        possibleLocations.add(Paths.get("../templates")); // Jos ajetaan scripts/ hakemistosta
        possibleLocations.add(Paths.get(pagesRoot).resolve("templates")); // Fallback: pages-root

        for (Path location : possibleLocations) {
            if (Files.isDirectory(location)) {
                templateDir = location;
                break;
            }
        }

        if (templateDir == null) {
            StringBuilder errorMsg = new StringBuilder("templates directory not found. Tried locations:\n");
            for (Path loc : possibleLocations) {
                errorMsg.append("  - ").append(loc.toAbsolutePath()).append("\n");
            }
            throw new IOException(errorMsg.toString());
        }

        System.out.println("Using templates from: " + templateDir.toAbsolutePath());
        Configuration cfg = fmCfg(templateDir);

        // 1) Scan detail -sivu
        generateScanDetailPage(cfg, scanPath, results, timestamp, channel);

        // 2) Kanavan index
        updateChannelIndexPage(cfg, scansPath.resolve(channel), pagesPath, channel);

        // 3) Pääindex
        updateMainIndexPage(cfg, pagesPath);

        // 4) CSS
        generateCssFile(pagesPath);

        System.out.println("✅ GitHub Pages built successfully!");
        System.out.println("   Scan page: " + scanPath.resolve("index.html"));
    }

    // --------- Datamallin lataus ----------
    private static ScanResults loadScanResults(String outputDir, String metadataJson) throws IOException {
        ScanResults results = new ScanResults();
        Path outPath = Paths.get(outputDir);

        if (metadataJson != null && Files.exists(Paths.get(metadataJson))) {
            results.metadata = GSON.fromJson(Files.readString(Paths.get(metadataJson)), JsonObject.class);
        }
        Path trivyFs = outPath.resolve("trivy-fs-results.json");
        if (Files.exists(trivyFs))
            results.trivyFs = GSON.fromJson(Files.readString(trivyFs), JsonObject.class);
        Path trivyImage = outPath.resolve("trivy-image-results.json");
        if (Files.exists(trivyImage))
            results.trivyImage = GSON.fromJson(Files.readString(trivyImage), JsonObject.class);
        Path semgrep = outPath.resolve("semgrep-results.json");
        if (Files.exists(semgrep))
            results.semgrep = GSON.fromJson(Files.readString(semgrep), JsonObject.class);

        Path trivySummary = outPath.resolve("TRIVY_SUMMARY.md");
        if (Files.exists(trivySummary) && Files.size(trivySummary) > 0)
            results.trivySummary = Files.readString(trivySummary);
        Path semgrepSummary = outPath.resolve("SEMGREP_SUMMARY.md");
        if (Files.exists(semgrepSummary) && Files.size(semgrepSummary) > 0)
            results.semgrepSummary = Files.readString(semgrepSummary);
        Path dependabotSummary = outPath.resolve("DEPENDABOT_SUMMARY.md");
        if (Files.exists(dependabotSummary) && Files.size(dependabotSummary) > 0)
            results.dependabotSummary = Files.readString(dependabotSummary);
        return results;
    }

    private static void copyJsonFiles(String outputDir, Path scanPath) throws IOException {
        Path outPath = Paths.get(outputDir);
        try (Stream<Path> s = Files.list(outPath)) {
            s.filter(p -> p.toString().endsWith(".json")).forEach(src -> {
                try {
                    Files.copy(src, scanPath.resolve(src.getFileName()), StandardCopyOption.REPLACE_EXISTING);
                } catch (IOException e) {
                    System.err.println("⚠️  Failed to copy " + src.getFileName() + ": " + e.getMessage());
                }
            });
        }
    }

    // --------- Sivut ----------
    private static void generateScanDetailPage(Configuration cfg, Path scanPath, ScanResults results, String timestamp,
            String channel)
            throws IOException, TemplateException {

        Map<String, Object> model = new HashMap<>();
        model.put("title", "Security Scan - " + timestamp);
        model.put("channel", channel);
        model.put("timestamp", timestamp);
        model.put("timestampHuman", formatTimestamp(timestamp));

        // Metadata
        Map<String, Object> md = new HashMap<>();
        if (results.metadata != null) {
            putIfPresent(md, results.metadata, "branch");
            putIfPresent(md, results.metadata, "commit_sha");
            putIfPresent(md, results.metadata, "repository");
        }
        model.put("metadata", md);

        // Trivy findings listat -> Map muotoon FreeMarkerille
        List<Map<String, Object>> trivyFsMaps = extractTrivyFindings(results.trivyFs).stream()
                .map(f -> trivyFindingToMap(f)).toList();
        List<Map<String, Object>> trivyImageMaps = extractTrivyFindings(results.trivyImage).stream()
                .map(f -> trivyFindingToMap(f)).toList();
        model.put("hasTrivy", (results.trivyFs != null || results.trivyImage != null));
        model.put("trivyFs", trivyFsMaps);
        model.put("trivyImage", trivyImageMaps);

        // Semgrep -> Map muotoon
        List<Map<String, Object>> semgrepMaps = extractSemgrepFindings(results.semgrep).stream()
                .map(f -> semgrepFindingToMap(f)).toList();
        model.put("semgrepFindings", semgrepMaps);
        model.put("semgrepSummaryMd", results.semgrepSummary);

        // Dependabot
        model.put("dependabotSummaryMd", results.dependabotSummary);

        // Polut
        model.put("rootCss", "../../../style.css");
        model.put("linkAllScans", "../../../index.html");
        model.put("linkChannelIndex", "../index.html");
        model.put("jsonFsPath",
                Files.exists(scanPath.resolve("trivy-fs-results.json")) ? "trivy-fs-results.json" : null);
        model.put("jsonImagePath",
                Files.exists(scanPath.resolve("trivy-image-results.json")) ? "trivy-image-results.json" : null);
        model.put("jsonSemgrepPath",
                Files.exists(scanPath.resolve("semgrep-results.json")) ? "semgrep-results.json" : null);

        Template tpl = cfg.getTemplate("scan_detail.ftl");
        render(tpl, model, scanPath.resolve("index.html"));
        System.out.println("   ✅ Generated scan detail page (FreeMarker)");
    }

    private static void updateChannelIndexPage(Configuration cfg, Path channelPath, Path pagesPath, String channel)
            throws IOException, TemplateException {
        Files.createDirectories(channelPath);

        List<ScanEntry> scans = new ArrayList<>();
        try (Stream<Path> stream = Files.list(channelPath)) {
            stream.filter(Files::isDirectory).forEach(scanDir -> {
                String ts = scanDir.getFileName().toString();
                if (Files.exists(scanDir.resolve("index.html"))) {
                    ScanEntry e = new ScanEntry(ts, "scans/" + channel + "/" + ts);
                    e.stats = loadScanStats(scanDir);
                    // Load branch/commit/repository from scan-metadata.json for display
                    try {
                        Path mdPath = scanDir.resolve("scan-metadata.json");
                        if (Files.exists(mdPath)) {
                            JsonObject meta = GSON.fromJson(Files.readString(mdPath), JsonObject.class);
                            e.branch = meta.has("branch") && !meta.get("branch").isJsonNull()
                                    ? meta.get("branch").getAsString()
                                    : null;
                            e.commit = meta.has("commit_sha") && !meta.get("commit_sha").isJsonNull()
                                    ? meta.get("commit_sha").getAsString()
                                    : null;
                            e.repository = meta.has("repository") && !meta.get("repository").isJsonNull()
                                    ? meta.get("repository").getAsString()
                                    : null;
                        }
                    } catch (Exception ignored) {
                    }
                    scans.add(e);
                }
            });
        }
        scans.sort((a, b) -> b.timestamp.compareTo(a.timestamp));

        // Convert ScanEntry to Map for FreeMarker
        List<Map<String, Object>> scanMaps = scans.stream()
                .map(s -> scanEntryToMap(s))
                .toList();

        Map<String, Object> model = new HashMap<>();
        model.put("title", "Security Scans - " + channel);
        model.put("channel", channel);
        model.put("rootCss", "../../style.css");
        model.put("linkAllChannels", "../../index.html");
        model.put("scans", scanMaps);

        Template tpl = cfg.getTemplate("channel_index.ftl");
        render(tpl, model, channelPath.resolve("index.html"));
        System.out.println("   ✅ Updated channel index page (FreeMarker)");
    }

    private static void updateMainIndexPage(Configuration cfg, Path pagesPath)
            throws IOException, TemplateException {
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
                            if (Files.exists(scanDir.resolve("index.html")))
                                list.add(new ScanEntry(ts, "scans/" + ch + "/" + ts));
                        });
                    } catch (IOException ignored) {
                    }
                    if (!list.isEmpty()) {
                        list.sort((a, b) -> b.timestamp.compareTo(a.timestamp));
                        channelScans.put(ch, list);
                    }
                });
            }
        }

        // Täydennä statsit ja poimi 5 viimeistä
        Map<String, Object> model = new HashMap<>();
        List<Map<String, Object>> channels = new ArrayList<>();
        for (Map.Entry<String, List<ScanEntry>> e : channelScans.entrySet()) {
            List<ScanEntry> scans = e.getValue();
            for (ScanEntry s : scans) {
                if (s.stats == null)
                    s.stats = loadScanStats(pagesPath.resolve(s.path));
                // enrich with metadata for commit linking
                try {
                    Path mdPath = pagesPath.resolve(s.path).resolve("scan-metadata.json");
                    if (Files.exists(mdPath)) {
                        JsonObject meta = GSON.fromJson(Files.readString(mdPath), JsonObject.class);
                        s.branch = meta.has("branch") && !meta.get("branch").isJsonNull()
                                ? meta.get("branch").getAsString()
                                : s.branch;
                        s.commit = meta.has("commit_sha") && !meta.get("commit_sha").isJsonNull()
                                ? meta.get("commit_sha").getAsString()
                                : s.commit;
                        s.repository = meta.has("repository") && !meta.get("repository").isJsonNull()
                                ? meta.get("repository").getAsString()
                                : s.repository;
                    }
                } catch (Exception ignored) {
                }
            }
            ScanEntry latest = scans.get(0);
            Map<String, Object> ch = new HashMap<>();
            ch.put("name", e.getKey());
            ch.put("total", scans.size());
            ch.put("latestTs", latest.timestamp);
            ch.put("latestHuman", formatTimestamp(latest.timestamp));
            ch.put("viewAllHref", "scans/" + e.getKey() + "/index.html");
            // Convert ScanEntry list to Map list for FreeMarker
            ch.put("recent", scans.stream().limit(5).map(s -> scanEntryToMap(s)).toList());
            channels.add(ch);
        }
        model.put("channels", channels);
        model.put("title", "Security Scan Reports");
        model.put("rootCss", "style.css");

        Template tpl = cfg.getTemplate("main_index.ftl");
        render(tpl, model, pagesPath.resolve("index.html"));
        System.out.println("   ✅ Updated main index page (FreeMarker)");
    }

    // --------- Apurit datan muodostukseen ----------
    private static void putIfPresent(Map<String, Object> target, JsonObject src, String key) {
        if (src.has(key) && !src.get(key).isJsonNull()) {
            String v = src.get(key).getAsString();
            if (!v.isEmpty())
                target.put(key, v);
        }
    }

    private static List<TrivyFinding> extractTrivyFindings(JsonObject trivyResult) {
        List<TrivyFinding> findings = new ArrayList<>();
        if (trivyResult == null || !trivyResult.has("Results"))
            return findings;
        JsonArray results = trivyResult.getAsJsonArray("Results");
        for (JsonElement re : results) {
            JsonObject result = re.getAsJsonObject();
            String target = result.has("Target") ? result.get("Target").getAsString() : "Unknown";
            // Vulns
            if (result.has("Vulnerabilities") && !result.get("Vulnerabilities").isJsonNull()) {
                JsonArray vulns = result.getAsJsonArray("Vulnerabilities");
                for (JsonElement ve : vulns) {
                    JsonObject v = ve.getAsJsonObject();
                    findings.add(new TrivyFinding(
                            "Vulnerability",
                            target,
                            v.has("PkgName") ? v.get("PkgName").getAsString() : "—",
                            v.has("VulnerabilityID") ? v.get("VulnerabilityID").getAsString() : "—",
                            v.has("Severity") ? v.get("Severity").getAsString() : "UNKNOWN",
                            v.has("Title") ? v.get("Title").getAsString()
                                    : (v.has("Description") ? v.get("Description").getAsString() : "—"),
                            v.has("InstalledVersion") ? v.get("InstalledVersion").getAsString() : "—",
                            v.has("FixedVersion") ? v.get("FixedVersion").getAsString() : "—"));
                }
            }
            // Misconfigs
            if (result.has("Misconfigurations") && !result.get("Misconfigurations").isJsonNull()) {
                JsonArray mis = result.getAsJsonArray("Misconfigurations");
                for (JsonElement me : mis) {
                    JsonObject m = me.getAsJsonObject();
                    findings.add(new TrivyFinding(
                            "Misconfiguration",
                            target,
                            m.has("Type") ? m.get("Type").getAsString() : "—",
                            m.has("ID") ? m.get("ID").getAsString() : "—",
                            m.has("Severity") ? m.get("Severity").getAsString() : "UNKNOWN",
                            m.has("Title") ? m.get("Title").getAsString()
                                    : (m.has("Message") ? m.get("Message").getAsString() : "—"),
                            "—",
                            "—"));
                }
            }
        }
        // sort: CRITICAL > HIGH > MEDIUM > LOW > UNKNOWN
        findings.sort(Comparator.comparingInt((TrivyFinding f) -> severityOrder(f.severity)).reversed());
        return findings;
    }

    private static List<SemgrepFinding> extractSemgrepFindings(JsonObject semgrepResult) {
        List<SemgrepFinding> findings = new ArrayList<>();
        if (semgrepResult == null || !semgrepResult.has("results"))
            return findings;
        JsonArray results = semgrepResult.getAsJsonArray("results");
        for (JsonElement e : results) {
            JsonObject o = e.getAsJsonObject();
            String ruleId = o.has("check_id") ? o.get("check_id").getAsString() : "—";
            String severity = "INFO";
            String message = (o.has("extra") && o.getAsJsonObject("extra").has("message"))
                    ? o.getAsJsonObject("extra").get("message").getAsString()
                    : "—";
            if (o.has("extra") && o.getAsJsonObject("extra").has("severity")) {
                severity = o.getAsJsonObject("extra").get("severity").getAsString().toUpperCase();
            }
            String path = o.has("path") ? o.get("path").getAsString() : "—";
            int line = 0;
            if (o.has("start") && o.getAsJsonObject("start").has("line"))
                line = o.getAsJsonObject("start").get("line").getAsInt();
            findings.add(new SemgrepFinding(ruleId, severity, path, line, message));
        }
        findings.sort(Comparator.comparingInt((SemgrepFinding f) -> semgrepOrder(f.severity)).reversed());
        return findings;
    }

    private static int severityOrder(String s) {
        return switch (s == null ? "" : s.toUpperCase()) {
            case "CRITICAL" -> 4;
            case "HIGH" -> 3;
            case "MEDIUM" -> 2;
            case "LOW" -> 1;
            default -> 0;
        };
    }

    private static int semgrepOrder(String s) {
        return switch (s == null ? "" : s.toUpperCase()) {
            case "ERROR" -> 3;
            case "WARNING" -> 2;
            case "INFO" -> 1;
            default -> 0;
        };
    }

    private static Map<String, Object> trivyFindingToMap(TrivyFinding f) {
        Map<String, Object> m = new HashMap<>();
        m.put("type", f.type);
        m.put("target", f.target);
        m.put("pkg", f.pkg);
        m.put("id", f.id);
        m.put("severity", f.severity);
        m.put("title", f.title);
        m.put("installedVersion", f.installedVersion);
        m.put("fixedVersion", f.fixedVersion);
        return m;
    }

    private static Map<String, Object> semgrepFindingToMap(SemgrepFinding f) {
        Map<String, Object> m = new HashMap<>();
        m.put("ruleId", f.ruleId);
        m.put("severity", f.severity);
        m.put("path", f.path);
        m.put("line", f.line);
        m.put("message", f.message);
        return m;
    }

    private static Map<String, Object> scanEntryToMap(ScanEntry s) {
        Map<String, Object> m = new HashMap<>();
        m.put("timestamp", s.timestamp);
        m.put("timestampHuman", formatTimestamp(s.timestamp));
        m.put("path", s.path);
        m.put("branch", s.branch);
        m.put("commit", s.commit);
        m.put("repository", s.repository);
        m.put("stats", scanStatsToMap(s.stats));
        return m;
    }

    private static Map<String, Object> scanStatsToMap(ScanStats stats) {
        if (stats == null)
            return new HashMap<>();
        Map<String, Object> m = new HashMap<>();
        m.put("trivyFs", vulnStatsToMap(stats.trivyFs));
        m.put("trivyFsMisconfig", vulnStatsToMap(stats.trivyFsMisconfig));
        m.put("trivyImage", vulnStatsToMap(stats.trivyImage));
        m.put("trivyImageMisconfig", vulnStatsToMap(stats.trivyImageMisconfig));
        m.put("semgrepErrors", stats.semgrepErrors);
        m.put("semgrepWarnings", stats.semgrepWarnings);
        m.put("semgrepInfo", stats.semgrepInfo);
        m.put("hasDependabot", stats.hasDependabot);
        return m;
    }

    private static Map<String, Object> vulnStatsToMap(VulnStats vs) {
        if (vs == null) {
            vs = new VulnStats();
        }
        Map<String, Object> m = new HashMap<>();
        m.put("critical", vs.critical);
        m.put("high", vs.high);
        m.put("medium", vs.medium);
        m.put("low", vs.low);
        m.put("scanned", vs.scanned);
        return m;
    }

    // --------- Stats & apurit ----------
    static class ScanResults {
        JsonObject metadata;
        JsonObject trivyFs;
        JsonObject trivyImage;
        JsonObject semgrep;
        String trivySummary;
        String semgrepSummary;
        String dependabotSummary;
    }

    static class ScanEntry {
        String timestamp;
        String path;
        ScanStats stats;
        String branch;
        String commit;
        String repository;

        ScanEntry(String timestamp, String path) {
            this.timestamp = timestamp;
            this.path = path;
        }

        public String getTimestampHuman() {
            return formatTimestamp(timestamp);
        }
    }

    static class ScanStats {
        VulnStats trivyFs = new VulnStats();
        VulnStats trivyFsMisconfig = new VulnStats();
        VulnStats trivyImage = new VulnStats();
        VulnStats trivyImageMisconfig = new VulnStats();
        int semgrepErrors = 0;
        int semgrepWarnings = 0;
        int semgrepInfo = 0;
        boolean hasDependabot = false;
    }

    static class VulnStats {
        int critical, high, medium, low;
        boolean scanned;

        int total() {
            return critical + high + medium + low;
        }
    }

    static class TrivyFinding {
        public String type, target, pkg, id, severity, title, installedVersion, fixedVersion;

        TrivyFinding(String type, String target, String pkg, String id, String severity, String title,
                String installedVersion, String fixedVersion) {
            this.type = type;
            this.target = target;
            this.pkg = pkg;
            this.id = id;
            this.severity = severity;
            this.title = title;
            this.installedVersion = installedVersion;
            this.fixedVersion = fixedVersion;
        }

        public String getType() {
            return type;
        }

        public String getTarget() {
            return target;
        }

        public String getPkg() {
            return pkg;
        }

        public String getId() {
            return id;
        }

        public String getSeverity() {
            return severity;
        }

        public String getTitle() {
            return title;
        }

        public String getInstalledVersion() {
            return installedVersion;
        }

        public String getFixedVersion() {
            return fixedVersion;
        }
    }

    static class SemgrepFinding {
        public String ruleId, severity, path;
        public int line;
        public String message;

        SemgrepFinding(String r, String s, String p, int l, String m) {
            ruleId = r;
            severity = s;
            path = p;
            line = l;
            message = m;
        }

        public String getRuleId() {
            return ruleId;
        }

        public String getSeverity() {
            return severity;
        }

        public String getPath() {
            return path;
        }

        public int getLine() {
            return line;
        }

        public String getMessage() {
            return message;
        }
    }

    private static ScanStats loadScanStats(Path scanPath) {
        ScanStats stats = new ScanStats();
        try {
            Path trivyFsPath = scanPath.resolve("trivy-fs-results.json");
            if (Files.exists(trivyFsPath)) {
                JsonObject trivyFs = GSON.fromJson(Files.readString(trivyFsPath), JsonObject.class);
                stats.trivyFs = parseTrivyVulnerabilities(trivyFs);
                stats.trivyFsMisconfig = parseTrivyMisconfigurations(trivyFs);
            }
            Path trivyImagePath = scanPath.resolve("trivy-image-results.json");
            if (Files.exists(trivyImagePath)) {
                JsonObject trivyImage = GSON.fromJson(Files.readString(trivyImagePath), JsonObject.class);
                stats.trivyImage = parseTrivyVulnerabilities(trivyImage);
                stats.trivyImageMisconfig = parseTrivyMisconfigurations(trivyImage);
            }
            Path semgrepPath = scanPath.resolve("semgrep-results.json");
            if (Files.exists(semgrepPath)) {
                JsonObject semgrep = GSON.fromJson(Files.readString(semgrepPath), JsonObject.class);
                parseSemgrepStats(semgrep, stats);
            }
            stats.hasDependabot = Files.exists(scanPath.resolve("DEPENDABOT_SUMMARY.md"));
        } catch (Exception ignored) {
        }
        return stats;
    }

    private static VulnStats parseTrivyVulnerabilities(JsonObject trivyJson) {
        VulnStats s = new VulnStats();
        if (trivyJson == null)
            return s;
        s.scanned = true;
        try {
            JsonArray results = trivyJson.getAsJsonArray("Results");
            if (results != null)
                for (JsonElement re : results) {
                    JsonObject r = re.getAsJsonObject();
                    JsonArray vulns = r.getAsJsonArray("Vulnerabilities");
                    if (vulns != null)
                        for (JsonElement ve : vulns) {
                            String sev = ve.getAsJsonObject().has("Severity")
                                    ? ve.getAsJsonObject().get("Severity").getAsString()
                                    : "";
                            switch (sev.toUpperCase()) {
                                case "CRITICAL" -> s.critical++;
                                case "HIGH" -> s.high++;
                                case "MEDIUM" -> s.medium++;
                                case "LOW" -> s.low++;
                            }
                        }
                }
        } catch (Exception ignored) {
        }
        return s;
    }

    private static VulnStats parseTrivyMisconfigurations(JsonObject trivyJson) {
        VulnStats s = new VulnStats();
        if (trivyJson == null)
            return s;
        s.scanned = true;
        try {
            JsonArray results = trivyJson.getAsJsonArray("Results");
            if (results != null)
                for (JsonElement re : results) {
                    JsonObject r = re.getAsJsonObject();
                    JsonArray mis = r.getAsJsonArray("Misconfigurations");
                    if (mis != null)
                        for (JsonElement me : mis) {
                            String sev = me.getAsJsonObject().has("Severity")
                                    ? me.getAsJsonObject().get("Severity").getAsString()
                                    : "";
                            switch (sev.toUpperCase()) {
                                case "CRITICAL" -> s.critical++;
                                case "HIGH" -> s.high++;
                                case "MEDIUM" -> s.medium++;
                                case "LOW" -> s.low++;
                            }
                        }
                }
        } catch (Exception ignored) {
        }
        return s;
    }

    private static void parseSemgrepStats(JsonObject semgrepJson, ScanStats stats) {
        if (semgrepJson == null)
            return;
        try {
            JsonArray results = semgrepJson.getAsJsonArray("results");
            if (results != null)
                for (JsonElement e : results) {
                    JsonObject extra = e.getAsJsonObject().getAsJsonObject("extra");
                    if (extra != null && extra.has("severity")) {
                        switch (extra.get("severity").getAsString().toUpperCase()) {
                            case "ERROR" -> stats.semgrepErrors++;
                            case "WARNING" -> stats.semgrepWarnings++;
                            case "INFO" -> stats.semgrepInfo++;
                        }
                    }
                }
        } catch (Exception ignored) {
        }
    }

    // --------- Utilit ----------
    private static String formatTimestamp(String ts) {
        try {
            DateTimeFormatter inFmt = DateTimeFormatter.ofPattern("yyyy-MM-dd-HHmmssX");
            OffsetDateTime odt = OffsetDateTime.parse(ts, inFmt);
            return odt.withOffsetSameInstant(ZoneOffset.UTC)
                    .format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss 'UTC'"));
        } catch (Exception e) {
            return ts;
        }
    }

    private static void generateCssFile(Path pagesPath) throws IOException {
        String css = """
                /* (sama CSS kuin aiemmin; ei muutoksia) */
                * { margin:0; padding:0; box-sizing:border-box; }
                body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,Cantarell,sans-serif; line-height:1.6; color:#333; background:#f5f5f5; }
                header { background:#2c3e50; color:#fff; padding:2rem; text-align:center; }
                header h1{ margin-bottom:.5rem; }
                header .subtitle{ color:#ecf0f1; font-size:1.1rem; }
                nav{ margin-top:1rem; }
                nav a{ color:#3498db; text-decoration:none; margin:0 1rem; }
                nav a:hover{ text-decoration:underline; }
                main{ max-width:1200px; margin:2rem auto; padding:0 1rem; }
                section{ background:#fff; padding:2rem; margin-bottom:2rem; border-radius:8px; box-shadow:0 2px 4px rgba(0,0,0,.1); }
                section h2{ color:#2c3e50; margin-bottom:1rem; padding-bottom:.5rem; border-bottom:2px solid #3498db; }
                .metadata dl{ display:grid; grid-template-columns:150px 1fr; gap:.5rem; }
                .metadata dt{ font-weight:bold; color:#7f8c8d; }
                .metadata dd{ color:#2c3e50; }
                .table-wrapper{ overflow-x:auto; margin:1rem 0; }
                .scan-table{ width:100%; border-collapse:collapse; font-size:.9rem; }
                .scan-table th{ background:#54697e; color:#fff; padding:.75rem .5rem; text-align:center; font-weight:600; border:1px solid #2c3e50; font-size:.85rem; }
                .scan-table td{ padding:.75rem .5rem; text-align:center; border:1px solid #ddd; }
                .scan-table tbody tr:hover{ background:#f8f9fa; }
                .timestamp-cell{text-align:left !important; white-space:nowrap; }
                .timestamp-cell a{ color:#3498db; text-decoration:none; font-weight:500; }
                .severity-critical{ color:#c0392b; font-weight:bold; }
                .severity-high{ color:#e67e22; font-weight:bold; }
                .severity-medium{ color:#f39c12; }
                .severity-low{ color:#95a5a6; }
                .severity-error{ color:#c0392b; font-weight:bold; }
                .severity-warn{ color:#f39c12; }
                .severity-info{ color:#3498db; }
                .findings-table{ margin:1.5rem 0; }
                .findings-table th{ background:#34495e; position:sticky; top:0; }
                .target-cell,.path-cell{ font-family:'Courier New',monospace; font-size:.85rem; max-width:300px; word-break:break-all; }
                .id-cell,.rule-cell{ font-family:'Courier New',monospace; font-size:.85rem; white-space:nowrap; }
                """;
        Files.writeString(pagesPath.resolve("style.css"), css);
    }

}