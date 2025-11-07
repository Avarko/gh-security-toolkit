///usr/bin/env jbang "$0" "$@" ; exit $?
//DEPS com.google.code.gson:gson:2.10.1

import com.google.gson.*;

import java.io.*;
import java.nio.file.*;
import java.time.*;
import java.time.format.*;
import java.util.*;
import java.util.stream.*;

/**
 * GitHub Pages builder for security scan results.
 * Generates static HTML pages with scan reports.
 *
 * Usage: github_pages_builder.java <output_dir> <pages_root> <scan_timestamp>
 * <channel> [metadata_json]
 */
public class github_pages_builder {

    private static final Gson GSON = new GsonBuilder()
            .setPrettyPrinting()
            .create();

    public static void main(String[] args) throws Exception {
        if (args.length < 4) {
            System.err.println(
                    "Usage: github_pages_builder.java <output_dir> <pages_root> <scan_timestamp> <channel> [metadata_json]");
            System.err.println("  output_dir: Directory containing scan outputs (JSON/MD files)");
            System.err.println("  pages_root: Root directory for GitHub Pages (e.g., docs/)");
            System.err.println("  scan_timestamp: Scan timestamp (e.g., 2025-11-07-033946Z)");
            System.err.println("  channel: Channel name (e.g., nightly-master)");
            System.err.println("  metadata_json: Optional path to scan-metadata.json");
            System.exit(1);
        }

        String outputDir = args[0];
        String pagesRoot = args[1];
        String timestamp = args[2];
        String channel = args[3];
        String metadataJson = args.length > 4 ? args[4] : null;

        System.out.println("🏗️  Building GitHub Pages for scan: " + timestamp);
        System.out.println("   Output dir: " + outputDir);
        System.out.println("   Pages root: " + pagesRoot);
        System.out.println("   Channel: " + channel);

        // Create pages structure
        Path pagesPath = Paths.get(pagesRoot);
        Path scansPath = pagesPath.resolve("scans");
        Path scanPath = scansPath.resolve(channel).resolve(timestamp);

        Files.createDirectories(scanPath);

        // Load scan results
        ScanResults results = loadScanResults(outputDir, metadataJson);

        // Copy JSON files to scan directory
        copyJsonFiles(outputDir, scanPath);

        // Generate scan detail page
        generateScanDetailPage(scanPath, results, timestamp, channel);

        // Update channel index page
        updateChannelIndexPage(scansPath.resolve(channel), channel);

        // Update main index page
        updateMainIndexPage(pagesPath);

        // Copy/generate CSS
        generateCssFile(pagesPath);

        System.out.println("✅ GitHub Pages built successfully!");
        System.out.println("   Scan page: " + scanPath.resolve("index.html"));
    }

    private static ScanResults loadScanResults(String outputDir, String metadataJson) throws IOException {
        ScanResults results = new ScanResults();
        Path outPath = Paths.get(outputDir);

        // Load metadata
        if (metadataJson != null && Files.exists(Paths.get(metadataJson))) {
            results.metadata = GSON.fromJson(Files.readString(Paths.get(metadataJson)), JsonObject.class);
        }

        // Load Trivy results
        Path trivyFs = outPath.resolve("trivy-fs-results.json");
        if (Files.exists(trivyFs)) {
            results.trivyFs = GSON.fromJson(Files.readString(trivyFs), JsonObject.class);
        }

        Path trivyImage = outPath.resolve("trivy-image-results.json");
        if (Files.exists(trivyImage)) {
            results.trivyImage = GSON.fromJson(Files.readString(trivyImage), JsonObject.class);
        }

        // Load Semgrep results
        Path semgrep = outPath.resolve("semgrep-results.json");
        if (Files.exists(semgrep)) {
            results.semgrep = GSON.fromJson(Files.readString(semgrep), JsonObject.class);
        }

        // Load summaries
        Path trivySummary = outPath.resolve("TRIVY_SUMMARY.md");
        if (Files.exists(trivySummary) && Files.size(trivySummary) > 0) {
            results.trivySummary = Files.readString(trivySummary);
        }

        Path semgrepSummary = outPath.resolve("SEMGREP_SUMMARY.md");
        if (Files.exists(semgrepSummary) && Files.size(semgrepSummary) > 0) {
            results.semgrepSummary = Files.readString(semgrepSummary);
        }

        Path dependabotSummary = outPath.resolve("DEPENDABOT_SUMMARY.md");
        if (Files.exists(dependabotSummary) && Files.size(dependabotSummary) > 0) {
            results.dependabotSummary = Files.readString(dependabotSummary);
        }

        return results;
    }

    private static void copyJsonFiles(String outputDir, Path scanPath) throws IOException {
        Path outPath = Paths.get(outputDir);

        // Copy all JSON files
        try (Stream<Path> stream = Files.list(outPath)) {
            stream.filter(p -> p.toString().endsWith(".json"))
                    .forEach(source -> {
                        try {
                            Path dest = scanPath.resolve(source.getFileName());
                            Files.copy(source, dest, StandardCopyOption.REPLACE_EXISTING);
                            System.out.println("   📄 Copied: " + source.getFileName());
                        } catch (IOException e) {
                            System.err.println("⚠️  Failed to copy " + source.getFileName() + ": " + e.getMessage());
                        }
                    });
        }
    }

    private static void generateScanDetailPage(Path scanPath, ScanResults results, String timestamp, String channel)
            throws IOException {
        StringBuilder html = new StringBuilder();

        html.append("<!DOCTYPE html>\n");
        html.append("<html lang=\"en\">\n");
        html.append("<head>\n");
        html.append("  <meta charset=\"UTF-8\">\n");
        html.append("  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n");
        html.append("  <title>Security Scan - ").append(timestamp).append("</title>\n");
        html.append("  <link rel=\"stylesheet\" href=\"../../../style.css\">\n");
        html.append("</head>\n");
        html.append("<body>\n");

        // Header
        html.append("  <header>\n");
        html.append("    <h1>🔍 Security Scan Report</h1>\n");
        html.append("    <nav>\n");
        html.append("      <a href=\"../../../index.html\">← All Scans</a>\n");
        html.append("      <a href=\"../index.html\">← ").append(channel).append(" Scans</a>\n");
        html.append("    </nav>\n");
        html.append("  </header>\n");

        html.append("  <main>\n");

        // Metadata section
        html.append("    <section class=\"metadata\">\n");
        html.append("      <h2>Scan Information</h2>\n");
        html.append("      <dl>\n");
        html.append("        <dt>Timestamp:</dt><dd>").append(formatTimestamp(timestamp)).append("</dd>\n");
        html.append("        <dt>Channel:</dt><dd>").append(channel).append("</dd>\n");

        if (results.metadata != null) {
            addMetadataField(html, results.metadata, "branch", "Branch");
            addMetadataField(html, results.metadata, "commit_sha", "Commit");
            addMetadataField(html, results.metadata, "repository", "Repository");
        }

        html.append("      </dl>\n");
        html.append("    </section>\n");

        // Summary sections - Trivy with tables
        if (results.trivyFs != null || results.trivyImage != null) {
            html.append("    <section class=\"summary trivy\">\n");
            html.append("      <h2>Trivy Results</h2>\n");

            if (results.trivyFs != null) {
                html.append("      <h3>Filesystem Scan</h3>\n");
                appendTrivyTable(html, results.trivyFs);
                html.append(
                        "      <p><a href=\"trivy-fs-results.json\" class=\"json-link\">📄 View Full JSON</a></p>\n");
            }

            if (results.trivyImage != null) {
                html.append("      <h3>Image Scan</h3>\n");
                appendTrivyTable(html, results.trivyImage);
                html.append(
                        "      <p><a href=\"trivy-image-results.json\" class=\"json-link\">📄 View Full JSON</a></p>\n");
            }

            html.append("    </section>\n");
        }

        if (results.semgrep != null) {
            html.append("    <section class=\"summary semgrep\">\n");
            html.append("      <h2>Semgrep Results</h2>\n");
            appendSemgrepTable(html, results.semgrep);
            html.append("      <p><a href=\"semgrep-results.json\" class=\"json-link\">📄 View JSON</a></p>\n");
            html.append("    </section>\n");
        } else if (results.semgrepSummary != null) {
            html.append("    <section class=\"summary semgrep\">\n");
            html.append("      <h2>Semgrep Results</h2>\n");
            html.append("      <div class=\"markdown-content\">").append(markdownToHtml(results.semgrepSummary))
                    .append("</div>\n");
            html.append("      <p><a href=\"semgrep-results.json\" class=\"json-link\">📄 View JSON</a></p>\n");
            html.append("    </section>\n");
        }

        if (results.dependabotSummary != null) {
            html.append("    <section class=\"summary dependabot\">\n");
            html.append("      <h2>Dependabot Alerts</h2>\n");
            html.append("      <div class=\"markdown-content\">").append(markdownToHtml(results.dependabotSummary))
                    .append("</div>\n");
            html.append("    </section>\n");
        }

        // No results message
        if (results.trivySummary == null && results.semgrepSummary == null && results.dependabotSummary == null) {
            html.append("    <section class=\"no-issues\">\n");
            html.append("      <h2>✅ No Security Issues Found!</h2>\n");
            html.append(
                    "      <p>All scans completed successfully with no vulnerabilities, misconfigurations, or alerts detected.</p>\n");
            html.append("    </section>\n");
        }

        html.append("  </main>\n");

        html.append("  <footer>\n");
        html.append(
                "    <p>Generated by <a href=\"https://github.com/Avarko/gh-security-toolkit\">gh-security-toolkit</a></p>\n");
        html.append("  </footer>\n");

        html.append("</body>\n");
        html.append("</html>\n");

        Files.writeString(scanPath.resolve("index.html"), html.toString());
        System.out.println("   ✅ Generated scan detail page");
    }

    private static void updateChannelIndexPage(Path channelPath, String channel) throws IOException {
        Files.createDirectories(channelPath);

        // List all scans in this channel (sorted by timestamp, newest first)
        List<ScanEntry> scans = new ArrayList<>();

        try (Stream<Path> stream = Files.list(channelPath)) {
            stream.filter(Files::isDirectory)
                    .forEach(scanDir -> {
                        String timestamp = scanDir.getFileName().toString();
                        Path indexPath = scanDir.resolve("index.html");
                        if (Files.exists(indexPath)) {
                            ScanEntry entry = new ScanEntry(timestamp, "scans/" + channel + "/" + timestamp);
                            entry.stats = loadScanStats(scanDir);
                            scans.add(entry);
                        }
                    });
        }

        scans.sort((a, b) -> b.timestamp.compareTo(a.timestamp));

        StringBuilder html = new StringBuilder();

        html.append("<!DOCTYPE html>\n");
        html.append("<html lang=\"en\">\n");
        html.append("<head>\n");
        html.append("  <meta charset=\"UTF-8\">\n");
        html.append("  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n");
        html.append("  <title>Security Scans - ").append(channel).append("</title>\n");
        html.append("  <link rel=\"stylesheet\" href=\"../../style.css\">\n");
        html.append("</head>\n");
        html.append("<body>\n");

        html.append("  <header>\n");
        html.append("    <h1>🔍 Security Scans - ").append(channel).append("</h1>\n");
        html.append("    <nav><a href=\"../../index.html\">← All Channels</a></nav>\n");
        html.append("  </header>\n");

        html.append("  <main>\n");
        html.append("    <section class=\"scan-list\">\n");
        html.append("      <h2>Scan History (").append(scans.size()).append(" scans)</h2>\n");

        if (scans.isEmpty()) {
            html.append("      <p class=\"no-scans\">No scans available yet.</p>\n");
        } else {
            // Table with scan statistics
            html.append("      <div class=\"table-wrapper\">\n");
            html.append("        <table class=\"scan-table\">\n");
            html.append("          <thead>\n");
            html.append("            <tr>\n");
            html.append("              <th rowspan=\"2\">Timestamp</th>\n");
            html.append("              <th colspan=\"4\">Trivy FS Vulnerabilities</th>\n");
            html.append("              <th colspan=\"4\">Trivy FS Misconfig</th>\n");
            html.append("              <th colspan=\"4\">Trivy Image Vulnerabilities</th>\n");
            html.append("              <th colspan=\"4\">Trivy Image Misconfig</th>\n");
            html.append("              <th colspan=\"3\">Semgrep</th>\n");
            html.append("            </tr>\n");
            html.append("            <tr>\n");
            // Trivy FS Vulns
            html.append("              <th class=\"severity-c\">C</th>\n");
            html.append("              <th class=\"severity-h\">H</th>\n");
            html.append("              <th class=\"severity-m\">M</th>\n");
            html.append("              <th class=\"severity-l\">L</th>\n");
            // Trivy FS Misconfig
            html.append("              <th class=\"severity-c\">C</th>\n");
            html.append("              <th class=\"severity-h\">H</th>\n");
            html.append("              <th class=\"severity-m\">M</th>\n");
            html.append("              <th class=\"severity-l\">L</th>\n");
            // Trivy Image Vulns
            html.append("              <th class=\"severity-c\">C</th>\n");
            html.append("              <th class=\"severity-h\">H</th>\n");
            html.append("              <th class=\"severity-m\">M</th>\n");
            html.append("              <th class=\"severity-l\">L</th>\n");
            // Trivy Image Misconfig
            html.append("              <th class=\"severity-c\">C</th>\n");
            html.append("              <th class=\"severity-h\">H</th>\n");
            html.append("              <th class=\"severity-m\">M</th>\n");
            html.append("              <th class=\"severity-l\">L</th>\n");
            // Semgrep
            html.append("              <th class=\"severity-error\">E</th>\n");
            html.append("              <th class=\"severity-warn\">W</th>\n");
            html.append("              <th class=\"severity-info\">I</th>\n");
            html.append("            </tr>\n");
            html.append("          </thead>\n");
            html.append("          <tbody>\n");

            for (ScanEntry scan : scans) {
                html.append("            <tr>\n");
                html.append("              <td class=\"timestamp-cell\"><a href=\"").append(scan.timestamp)
                        .append("/index.html\">").append(formatTimestamp(scan.timestamp)).append("</a></td>\n");

                // Trivy FS Vulns
                appendStatsCell(html, scan.stats.trivyFs);
                // Trivy FS Misconfig
                appendStatsCell(html, scan.stats.trivyFsMisconfig);
                // Trivy Image Vulns
                appendStatsCell(html, scan.stats.trivyImage);
                // Trivy Image Misconfig
                appendStatsCell(html, scan.stats.trivyImageMisconfig);

                // Semgrep
                html.append("              <td class=\"count")
                        .append(scan.stats.semgrepErrors > 0 ? " severity-error" : "")
                        .append("\">").append(scan.stats.semgrepErrors > 0 ? scan.stats.semgrepErrors : "-")
                        .append("</td>\n");
                html.append("              <td class=\"count")
                        .append(scan.stats.semgrepWarnings > 0 ? " severity-warn" : "")
                        .append("\">").append(scan.stats.semgrepWarnings > 0 ? scan.stats.semgrepWarnings : "-")
                        .append("</td>\n");
                html.append("              <td class=\"count")
                        .append(scan.stats.semgrepInfo > 0 ? " severity-info" : "")
                        .append("\">").append(scan.stats.semgrepInfo > 0 ? scan.stats.semgrepInfo : "-")
                        .append("</td>\n");

                html.append("            </tr>\n");
            }

            html.append("          </tbody>\n");
            html.append("        </table>\n");
            html.append("      </div>\n");
        }

        html.append("    </section>\n");
        html.append("  </main>\n");

        html.append("  <footer>\n");
        html.append(
                "    <p>Generated by <a href=\"https://github.com/Avarko/gh-security-toolkit\">gh-security-toolkit</a></p>\n");
        html.append("  </footer>\n");

        html.append("</body>\n");
        html.append("</html>\n");

        Files.writeString(channelPath.resolve("index.html"), html.toString());
        System.out.println("   ✅ Updated channel index page");
    }

    private static void appendBranchCommitInfo(StringBuilder html, ScanEntry scan, Path pagesPath) {
        try {
            Path metadataPath = pagesPath.resolve(scan.path).resolve("scan-metadata.json");
            if (Files.exists(metadataPath)) {
                JsonObject metadata = GSON.fromJson(Files.readString(metadataPath), JsonObject.class);
                String branch = metadata.has("branch") && !metadata.get("branch").isJsonNull()
                        ? metadata.get("branch").getAsString()
                        : "";
                String commit = metadata.has("commit_sha") && !metadata.get("commit_sha").isJsonNull()
                        ? metadata.get("commit_sha").getAsString()
                        : "";
                String repo = metadata.has("repository") && !metadata.get("repository").isJsonNull()
                        ? metadata.get("repository").getAsString()
                        : "";

                if (!branch.isEmpty()) {
                    html.append("<div class=\"branch\">").append(escapeHtml(branch)).append("</div>");
                }
                if (!commit.isEmpty()) {
                    String shortCommit = commit.length() > 7 ? commit.substring(0, 7) : commit;
                    if (!repo.isEmpty()) {
                        String commitUrl = "https://github.com/" + repo + "/commit/" + commit;
                        html.append("<div class=\"commit\"><a href=\"").append(commitUrl)
                                .append("\" target=\"_blank\" rel=\"noopener\">").append(escapeHtml(shortCommit))
                                .append("</a></div>");
                    } else {
                        html.append("<div class=\"commit\">").append(escapeHtml(shortCommit)).append("</div>");
                    }
                }
                if (branch.isEmpty() && commit.isEmpty()) {
                    html.append("-");
                }
            } else {
                html.append("-");
            }
        } catch (Exception e) {
            html.append("-");
        }
    }

    private static void appendStatsCell(StringBuilder html, VulnStats stats) {
        if (!stats.scanned) {
            html.append("              <td class=\"not-scanned\" colspan=\"4\">✗</td>\n");
        } else {
            html.append("              <td class=\"count").append(stats.critical > 0 ? " severity-critical" : "")
                    .append("\">").append(stats.critical > 0 ? stats.critical : "-").append("</td>\n");
            html.append("              <td class=\"count").append(stats.high > 0 ? " severity-high" : "")
                    .append("\">").append(stats.high > 0 ? stats.high : "-").append("</td>\n");
            html.append("              <td class=\"count").append(stats.medium > 0 ? " severity-medium" : "")
                    .append("\">").append(stats.medium > 0 ? stats.medium : "-").append("</td>\n");
            html.append("              <td class=\"count").append(stats.low > 0 ? " severity-low" : "")
                    .append("\">").append(stats.low > 0 ? stats.low : "-").append("</td>\n");
        }
    }

    private static void appendTrivyTable(StringBuilder html, JsonObject trivyResult) {
        if (trivyResult == null || !trivyResult.has("Results")) {
            html.append("      <p>No results available.</p>\n");
            return;
        }

        // Collect all vulnerabilities and misconfigurations
        List<TrivyFinding> findings = new ArrayList<>();
        JsonArray results = trivyResult.getAsJsonArray("Results");

        for (int i = 0; i < results.size(); i++) {
            JsonObject result = results.get(i).getAsJsonObject();
            String target = result.has("Target") ? result.get("Target").getAsString() : "Unknown";

            // Parse vulnerabilities
            if (result.has("Vulnerabilities") && !result.get("Vulnerabilities").isJsonNull()) {
                JsonArray vulns = result.getAsJsonArray("Vulnerabilities");
                for (int j = 0; j < vulns.size(); j++) {
                    JsonObject vuln = vulns.get(j).getAsJsonObject();
                    findings.add(new TrivyFinding(
                            "Vulnerability",
                            target,
                            vuln.has("PkgName") ? vuln.get("PkgName").getAsString() : "—",
                            vuln.has("VulnerabilityID") ? vuln.get("VulnerabilityID").getAsString() : "—",
                            vuln.has("Severity") ? vuln.get("Severity").getAsString() : "UNKNOWN",
                            vuln.has("Title") ? vuln.get("Title").getAsString()
                                    : (vuln.has("Description") ? vuln.get("Description").getAsString() : "—"),
                            vuln.has("InstalledVersion") ? vuln.get("InstalledVersion").getAsString() : "—",
                            vuln.has("FixedVersion") ? vuln.get("FixedVersion").getAsString() : "—"));
                }
            }

            // Parse misconfigurations
            if (result.has("Misconfigurations") && !result.get("Misconfigurations").isJsonNull()) {
                JsonArray misconfigs = result.getAsJsonArray("Misconfigurations");
                for (int j = 0; j < misconfigs.size(); j++) {
                    JsonObject misconfig = misconfigs.get(j).getAsJsonObject();
                    findings.add(new TrivyFinding(
                            "Misconfiguration",
                            target,
                            misconfig.has("Type") ? misconfig.get("Type").getAsString() : "—",
                            misconfig.has("ID") ? misconfig.get("ID").getAsString() : "—",
                            misconfig.has("Severity") ? misconfig.get("Severity").getAsString() : "UNKNOWN",
                            misconfig.has("Title") ? misconfig.get("Title").getAsString()
                                    : (misconfig.has("Message") ? misconfig.get("Message").getAsString() : "—"),
                            "—",
                            "—"));
                }
            }
        }

        if (findings.isEmpty()) {
            html.append("      <p>✓ No issues found.</p>\n");
            return;
        }

        // Sort by severity (CRITICAL > HIGH > MEDIUM > LOW > UNKNOWN)
        findings.sort((a, b) -> {
            int severityA = getSeverityOrder(a.severity);
            int severityB = getSeverityOrder(b.severity);
            return Integer.compare(severityB, severityA); // Descending
        });

        html.append("      <table class=\"scan-table findings-table\">\n");
        html.append("        <thead>\n");
        html.append("          <tr>\n");
        html.append("            <th>Type</th>\n");
        html.append("            <th>Target</th>\n");
        html.append("            <th>Package/Type</th>\n");
        html.append("            <th>ID</th>\n");
        html.append("            <th>Severity</th>\n");
        html.append("            <th>Title</th>\n");
        html.append("            <th>Installed</th>\n");
        html.append("            <th>Fixed</th>\n");
        html.append("          </tr>\n");
        html.append("        </thead>\n");
        html.append("        <tbody>\n");

        for (TrivyFinding finding : findings) {
            String severityClass = "severity-" + finding.severity.toLowerCase();
            html.append("          <tr>\n");
            html.append("            <td>").append(finding.type).append("</td>\n");
            html.append("            <td class=\"target-cell\">").append(escapeHtml(finding.target)).append("</td>\n");
            html.append("            <td>").append(escapeHtml(finding.pkg)).append("</td>\n");
            html.append("            <td class=\"id-cell\">").append(escapeHtml(finding.id)).append("</td>\n");
            html.append("            <td class=\"").append(severityClass).append("\">")
                    .append(finding.severity).append("</td>\n");
            html.append("            <td class=\"title-cell\">").append(escapeHtml(finding.title)).append("</td>\n");
            html.append("            <td>").append(escapeHtml(finding.installedVersion)).append("</td>\n");
            html.append("            <td>").append(escapeHtml(finding.fixedVersion)).append("</td>\n");
            html.append("          </tr>\n");
        }

        html.append("        </tbody>\n");
        html.append("      </table>\n");
    }

    private static int getSeverityOrder(String severity) {
        switch (severity.toUpperCase()) {
            case "CRITICAL":
                return 4;
            case "HIGH":
                return 3;
            case "MEDIUM":
                return 2;
            case "LOW":
                return 1;
            default:
                return 0;
        }
    }

    static class TrivyFinding {
        String type;
        String target;
        String pkg;
        String id;
        String severity;
        String title;
        String installedVersion;
        String fixedVersion;

        TrivyFinding(String type, String target, String pkg, String id, String severity,
                String title, String installedVersion, String fixedVersion) {
            this.type = type;
            this.target = target;
            this.pkg = pkg;
            this.id = id;
            this.severity = severity;
            this.title = title;
            this.installedVersion = installedVersion;
            this.fixedVersion = fixedVersion;
        }
    }

    private static void appendSemgrepTable(StringBuilder html, JsonObject semgrepResult) {
        if (semgrepResult == null || !semgrepResult.has("results")) {
            html.append("      <p>No results available.</p>\n");
            return;
        }

        JsonArray results = semgrepResult.getAsJsonArray("results");
        if (results.size() == 0) {
            html.append("      <p>✓ No issues found.</p>\n");
            return;
        }

        // Collect findings
        List<SemgrepFinding> findings = new ArrayList<>();
        for (int i = 0; i < results.size(); i++) {
            JsonObject finding = results.get(i).getAsJsonObject();

            String ruleId = finding.has("check_id") ? finding.get("check_id").getAsString() : "—";
            String severity = "INFO";
            String message = finding.has("extra") && finding.getAsJsonObject("extra").has("message")
                    ? finding.getAsJsonObject("extra").get("message").getAsString()
                    : "—";

            if (finding.has("extra") && finding.getAsJsonObject("extra").has("severity")) {
                severity = finding.getAsJsonObject("extra").get("severity").getAsString().toUpperCase();
            }

            String path = finding.has("path") ? finding.get("path").getAsString() : "—";
            int line = 0;
            if (finding.has("start") && finding.getAsJsonObject("start").has("line")) {
                line = finding.getAsJsonObject("start").get("line").getAsInt();
            }

            findings.add(new SemgrepFinding(ruleId, severity, path, line, message));
        }

        // Sort by severity (ERROR > WARNING > INFO)
        findings.sort((a, b) -> {
            int severityA = getSemgrepSeverityOrder(a.severity);
            int severityB = getSemgrepSeverityOrder(b.severity);
            return Integer.compare(severityB, severityA); // Descending
        });

        html.append("      <table class=\"scan-table findings-table\">\n");
        html.append("        <thead>\n");
        html.append("          <tr>\n");
        html.append("            <th>Rule ID</th>\n");
        html.append("            <th>Severity</th>\n");
        html.append("            <th>File</th>\n");
        html.append("            <th>Line</th>\n");
        html.append("            <th>Message</th>\n");
        html.append("          </tr>\n");
        html.append("        </thead>\n");
        html.append("        <tbody>\n");

        for (SemgrepFinding finding : findings) {
            String severityClass = "severity-" + finding.severity.toLowerCase();
            html.append("          <tr>\n");
            html.append("            <td class=\"rule-cell\">").append(escapeHtml(finding.ruleId)).append("</td>\n");
            html.append("            <td class=\"").append(severityClass).append("\">")
                    .append(finding.severity).append("</td>\n");
            html.append("            <td class=\"path-cell\">").append(escapeHtml(finding.path)).append("</td>\n");
            html.append("            <td class=\"line-cell\">").append(finding.line > 0 ? finding.line : "—")
                    .append("</td>\n");
            html.append("            <td class=\"message-cell\">").append(escapeHtml(finding.message))
                    .append("</td>\n");
            html.append("          </tr>\n");
        }

        html.append("        </tbody>\n");
        html.append("      </table>\n");
    }

    private static int getSemgrepSeverityOrder(String severity) {
        switch (severity.toUpperCase()) {
            case "ERROR":
                return 3;
            case "WARNING":
                return 2;
            case "INFO":
                return 1;
            default:
                return 0;
        }
    }

    static class SemgrepFinding {
        String ruleId;
        String severity;
        String path;
        int line;
        String message;

        SemgrepFinding(String ruleId, String severity, String path, int line, String message) {
            this.ruleId = ruleId;
            this.severity = severity;
            this.path = path;
            this.line = line;
            this.message = message;
        }
    }

    private static void updateMainIndexPage(Path pagesPath) throws IOException {
        Path scansPath = pagesPath.resolve("scans");

        // List all channels
        Map<String, List<ScanEntry>> channelScans = new TreeMap<>();

        if (Files.exists(scansPath)) {
            try (Stream<Path> stream = Files.list(scansPath)) {
                stream.filter(Files::isDirectory)
                        .forEach(channelDir -> {
                            String channel = channelDir.getFileName().toString();
                            List<ScanEntry> scans = new ArrayList<>();

                            try (Stream<Path> scanStream = Files.list(channelDir)) {
                                scanStream.filter(Files::isDirectory)
                                        .forEach(scanDir -> {
                                            String timestamp = scanDir.getFileName().toString();
                                            Path indexPath = scanDir.resolve("index.html");
                                            if (Files.exists(indexPath)) {
                                                scans.add(
                                                        new ScanEntry(timestamp, "scans/" + channel + "/" + timestamp));
                                            }
                                        });
                            } catch (IOException e) {
                                // Ignore
                            }

                            if (!scans.isEmpty()) {
                                scans.sort((a, b) -> b.timestamp.compareTo(a.timestamp));
                                channelScans.put(channel, scans);
                            }
                        });
            }
        }

        StringBuilder html = new StringBuilder();

        html.append("<!DOCTYPE html>\n");
        html.append("<html lang=\"en\">\n");
        html.append("<head>\n");
        html.append("  <meta charset=\"UTF-8\">\n");
        html.append("  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n");
        html.append("  <title>Security Scan Reports</title>\n");
        html.append("  <link rel=\"stylesheet\" href=\"style.css\">\n");
        html.append("</head>\n");
        html.append("<body>\n");

        html.append("  <header>\n");
        html.append("    <h1>🔍 Security Scan Reports</h1>\n");
        html.append("    <p class=\"subtitle\">Automated security scanning results</p>\n");
        html.append("  </header>\n");

        html.append("  <main>\n");

        if (channelScans.isEmpty()) {
            html.append("    <section class=\"no-scans\">\n");
            html.append("      <p>No security scans available yet.</p>\n");
            html.append("    </section>\n");
        } else {
            for (Map.Entry<String, List<ScanEntry>> entry : channelScans.entrySet()) {
                String channel = entry.getKey();
                List<ScanEntry> scans = entry.getValue();

                // Load stats for all scans and get latest
                for (ScanEntry scan : scans) {
                    if (scan.stats == null) {
                        Path scanPath = pagesPath.resolve(scan.path);
                        scan.stats = loadScanStats(scanPath);
                    }
                }
                ScanEntry latest = scans.get(0);

                html.append("    <section class=\"channel\">\n");
                html.append("      <h2>").append(channel).append("</h2>\n");
                html.append("      <p class=\"channel-info\">\n");
                html.append("        <strong>Total scans:</strong> ").append(scans.size()).append(" | \n");
                html.append("        <strong>Latest:</strong> ").append(formatTimestamp(latest.timestamp))
                        .append(" | \n");
                html.append("        <a href=\"scans/").append(channel).append("/index.html\">View All →</a>\n");
                html.append("      </p>\n");

                // Show last 5 scans in table
                List<ScanEntry> recentScans = scans.stream().limit(5).toList();
                html.append("      <div class=\"table-wrapper\">\n");
                html.append("        <table class=\"scan-table scan-table-compact\">\n");
                html.append("          <thead>\n");
                html.append("            <tr>\n");
                html.append("              <th>Timestamp</th>\n");
                html.append("              <th>Branch & Commit</th>\n");
                html.append("              <th colspan=\"4\">Trivy FS Vuln</th>\n");
                html.append("              <th colspan=\"4\">Trivy Image Vuln</th>\n");
                html.append("              <th colspan=\"3\">Semgrep</th>\n");
                html.append("            </tr>\n");
                html.append("            <tr class=\"subheader\">\n");
                html.append("              <th></th>\n");
                html.append("              <th></th>\n");
                html.append(
                        "              <th class=\"severity-c\">C</th><th class=\"severity-h\">H</th><th class=\"severity-m\">M</th><th class=\"severity-l\">L</th>\n");
                html.append(
                        "              <th class=\"severity-c\">C</th><th class=\"severity-h\">H</th><th class=\"severity-m\">M</th><th class=\"severity-l\">L</th>\n");
                html.append(
                        "              <th class=\"severity-error\">E</th><th class=\"severity-warn\">W</th><th class=\"severity-info\">I</th>\n");
                html.append("            </tr>\n");
                html.append("          </thead>\n");
                html.append("          <tbody>\n");

                for (ScanEntry scan : recentScans) {
                    html.append("            <tr>\n");
                    html.append("              <td class=\"timestamp-cell\"><a href=\"").append(scan.path)
                            .append("/index.html\">").append(formatTimestamp(scan.timestamp)).append("</a></td>\n");

                    // Branch & Commit cell
                    html.append("              <td class=\"metadata-cell\">");
                    appendBranchCommitInfo(html, scan, pagesPath);
                    html.append("</td>\n");

                    // Trivy FS Vulns (simplified - no misconfig)
                    appendStatsCell(html, scan.stats.trivyFs);
                    // Trivy Image Vulns (simplified - no misconfig)
                    appendStatsCell(html, scan.stats.trivyImage);

                    // Semgrep
                    html.append("              <td class=\"count")
                            .append(scan.stats.semgrepErrors > 0 ? " severity-error" : "")
                            .append("\">").append(scan.stats.semgrepErrors > 0 ? scan.stats.semgrepErrors : "-")
                            .append("</td>\n");
                    html.append("              <td class=\"count")
                            .append(scan.stats.semgrepWarnings > 0 ? " severity-warn" : "")
                            .append("\">").append(scan.stats.semgrepWarnings > 0 ? scan.stats.semgrepWarnings : "-")
                            .append("</td>\n");
                    html.append("              <td class=\"count")
                            .append(scan.stats.semgrepInfo > 0 ? " severity-info" : "")
                            .append("\">").append(scan.stats.semgrepInfo > 0 ? scan.stats.semgrepInfo : "-")
                            .append("</td>\n");

                    html.append("            </tr>\n");
                }

                html.append("          </tbody>\n");
                html.append("        </table>\n");
                html.append("      </div>\n");
                html.append("    </section>\n");
            }
        }

        html.append("  </main>\n");

        html.append("  <footer>\n");
        html.append(
                "    <p>Generated by <a href=\"https://github.com/Avarko/gh-security-toolkit\">gh-security-toolkit</a></p>\n");
        html.append("  </footer>\n");

        html.append("</body>\n");
        html.append("</html>\n");

        Files.writeString(pagesPath.resolve("index.html"), html.toString());
        System.out.println("   ✅ Updated main index page");
    }

    private static void generateCssFile(Path pagesPath) throws IOException {
        String css = """
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }

                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    background: #f5f5f5;
                }

                header {
                    background: #2c3e50;
                    color: white;
                    padding: 2rem;
                    text-align: center;
                }

                header h1 {
                    margin-bottom: 0.5rem;
                }

                header .subtitle {
                    color: #ecf0f1;
                    font-size: 1.1rem;
                }

                nav {
                    margin-top: 1rem;
                }

                nav a {
                    color: #3498db;
                    text-decoration: none;
                    margin: 0 1rem;
                }

                nav a:hover {
                    text-decoration: underline;
                }

                main {
                    max-width: 1200px;
                    margin: 2rem auto;
                    padding: 0 1rem;
                }

                section {
                    background: white;
                    padding: 2rem;
                    margin-bottom: 2rem;
                    border-radius: 8px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }

                section h2 {
                    color: #2c3e50;
                    margin-bottom: 1rem;
                    padding-bottom: 0.5rem;
                    border-bottom: 2px solid #3498db;
                }

                .metadata dl {
                    display: grid;
                    grid-template-columns: 150px 1fr;
                    gap: 0.5rem;
                }

                .metadata dt {
                    font-weight: bold;
                    color: #7f8c8d;
                }

                .metadata dd {
                    color: #2c3e50;
                }

                .markdown-content {
                    padding: 1rem 0;
                }

                .markdown-content pre {
                    background: #f8f9fa;
                    padding: 1rem;
                    border-radius: 4px;
                    overflow-x: auto;
                }

                .json-link {
                    display: inline-block;
                    padding: 0.5rem 1rem;
                    background: #3498db;
                    color: white;
                    text-decoration: none;
                    border-radius: 4px;
                    margin-top: 1rem;
                }

                .json-link:hover {
                    background: #2980b9;
                }

                .no-issues {
                    text-align: center;
                    padding: 3rem;
                    background: #d4edda;
                    border: 2px solid #28a745;
                }

                .no-issues h2 {
                    color: #28a745;
                    border: none;
                }

                .scan-list ul {
                    list-style: none;
                }

                .scan-list li {
                    margin-bottom: 0.5rem;
                }

                .scan-list a {
                    display: block;
                    padding: 1rem;
                    background: #f8f9fa;
                    border-left: 4px solid #3498db;
                    text-decoration: none;
                    color: #2c3e50;
                    transition: all 0.2s;
                }

                .scan-list a:hover {
                    background: #e9ecef;
                    border-left-color: #2980b9;
                }

                .channel {
                    border-left: 4px solid #3498db;
                }

                .channel-info {
                    color: #7f8c8d;
                    margin: 1rem 0;
                }

                .channel-actions {
                    display: flex;
                    gap: 1rem;
                    margin-top: 1rem;
                }

                .btn {
                    display: inline-block;
                    padding: 0.75rem 1.5rem;
                    text-decoration: none;
                    border-radius: 4px;
                    font-weight: bold;
                    transition: all 0.2s;
                }

                .btn-primary {
                    background: #3498db;
                    color: white;
                }

                .btn-primary:hover {
                    background: #2980b9;
                }

                .btn-secondary {
                    background: #95a5a6;
                    color: white;
                }

                .btn-secondary:hover {
                    background: #7f8c8d;
                }

                footer {
                    text-align: center;
                    padding: 2rem;
                    color: #7f8c8d;
                }

                footer a {
                    color: #3498db;
                    text-decoration: none;
                }

                footer a:hover {
                    text-decoration: underline;
                }

                /* Scan statistics table */
                .table-wrapper {
                    overflow-x: auto;
                    margin: 1rem 0;
                }

                .scan-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.9rem;
                }

                .scan-table th {
                    background: #54697e;
                    color: white;
                    padding: 0.75rem 0.5rem;
                    text-align: center;
                    font-weight: 600;
                    border: 1px solid #2c3e50;
                    font-size: 0.85rem;
                }

                .scan-table td {
                    padding: 0.75rem 0.5rem;
                    text-align: center;
                    border: 1px solid #ddd;
                }

                .scan-table tbody tr:hover {
                    background: #f8f9fa;
                }

                .timestamp-cell {
                    text-align: left !important;
                    white-space: nowrap;
                }

                .timestamp-cell a {
                    color: #3498db;
                    text-decoration: none;
                    font-weight: 500;
                }

                .timestamp-cell a:hover {
                    text-decoration: underline;
                }

                .metadata-cell {
                    text-align: left !important;
                    font-size: 0.85rem;
                    white-space: nowrap;
                }

                .metadata-cell .branch {
                    color: #2c3e50;
                    font-weight: 500;
                }

                .metadata-cell .commit {
                    color: #7f8c8d;
                    font-family: 'Courier New', monospace;
                    font-size: 0.8rem;
                    margin-top: 0.2rem;
                }

                .metadata-cell .commit a {
                    color: #3498db;
                    text-decoration: none;
                }

                .metadata-cell .commit a:hover {
                    text-decoration: underline;
                }

                .count {
                    font-family: 'Courier New', monospace;
                    font-weight: 600;
                }

                .severity-critical {
                    color: #c0392b;
                    font-weight: bold;
                }

                .severity-high {
                    color: #e67e22;
                    font-weight: bold;
                }

                .severity-medium {
                    color: #f39c12;
                }

                .severity-low {
                    color: #95a5a6;
                }

                .severity-error {
                    color: #c0392b;
                    font-weight: bold;
                }

                .severity-warn {
                    color: #f39c12;
                }

                .severity-info {
                    color: #3498db;
                }

                .severity-c, .severity-h, .severity-m, .severity-l {
                    font-size: 0.75rem;
                    font-weight: 600;
                }

                .not-scanned {
                    color: #95a5a6;
                    font-size: 1.2rem;
                }

                .scan-table-compact {
                    font-size: 0.85rem;
                }

                .scan-table-compact th,
                .scan-table-compact td {
                    padding: 0.5rem 0.4rem;
                }

                .subheader th {
                    background: #657a84;
                    font-size: 0.75rem;
                }

                .findings-table {
                    margin: 1.5rem 0;
                }

                .findings-table th {
                    background: #34495e;
                    position: sticky;
                    top: 0;
                }

                .findings-table td {
                    padding: 0.75rem 0.5rem;
                    vertical-align: top;
                }

                .target-cell,
                .path-cell {
                    font-family: 'Courier New', monospace;
                    font-size: 0.85rem;
                    max-width: 300px;
                    word-break: break-all;
                }

                .id-cell,
                .rule-cell {
                    font-family: 'Courier New', monospace;
                    font-size: 0.85rem;
                    white-space: nowrap;
                }

                .line-cell {
                    text-align: center;
                    font-family: 'Courier New', monospace;
                }

                .title-cell,
                .message-cell {
                    max-width: 400px;
                    line-height: 1.4;
                }

                @media (max-width: 768px) {
                    .metadata dl {
                        grid-template-columns: 1fr;
                    }

                    .channel-actions {
                        flex-direction: column;
                    }

                    .scan-table {
                        font-size: 0.75rem;
                    }

                    .scan-table th,
                    .scan-table td {
                        padding: 0.5rem 0.25rem;
                    }
                }
                """;

        Files.writeString(pagesPath.resolve("style.css"), css);
        System.out.println("   ✅ Generated CSS file");
    }

    // Helper methods

    private static void addMetadataField(StringBuilder html, JsonObject metadata, String field, String label) {
        if (metadata.has(field) && !metadata.get(field).isJsonNull()) {
            String value = metadata.get(field).getAsString();
            if (!value.isEmpty()) {
                html.append("        <dt>").append(label).append(":</dt><dd>").append(escapeHtml(value))
                        .append("</dd>\n");
            }
        }
    }

    private static String formatTimestamp(String timestamp) {
        try {
            // Parse: 2025-11-07-033946Z -> OffsetDateTime in UTC
            // Format: yyyy-MM-dd-HHmmssX (X handles Z as UTC offset)
            DateTimeFormatter inputFormat = DateTimeFormatter.ofPattern("yyyy-MM-dd-HHmmssX");
            OffsetDateTime odt = OffsetDateTime.parse(timestamp, inputFormat);

            // Format output with explicit UTC zone info preserved
            DateTimeFormatter outputFormat = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss 'UTC'");
            return odt.withOffsetSameInstant(ZoneOffset.UTC).format(outputFormat);
        } catch (Exception e) {
            // If parsing fails, return original timestamp
            return timestamp;
        }
    }

    private static String markdownToHtml(String markdown) {
        // Simple markdown to HTML conversion (basic support)
        String html = escapeHtml(markdown);

        // Headers
        html = html.replaceAll("### ([^\n]+)", "<h3>$1</h3>");
        html = html.replaceAll("## ([^\n]+)", "<h2>$1</h2>");
        html = html.replaceAll("# ([^\n]+)", "<h1>$1</h1>");

        // Bold
        html = html.replaceAll("\\*\\*([^*]+)\\*\\*", "<strong>$1</strong>");

        // Code blocks
        html = html.replaceAll("```([^`]+)```", "<pre><code>$1</code></pre>");

        // Inline code
        html = html.replaceAll("`([^`]+)`", "<code>$1</code>");

        // Line breaks
        html = html.replaceAll("\n\n", "</p><p>");
        html = "<p>" + html + "</p>";

        return html;
    }

    private static String escapeHtml(String text) {
        return text
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }

    // Data classes

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

        ScanEntry(String timestamp, String path) {
            this.timestamp = timestamp;
            this.path = path;
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
        int critical = 0;
        int high = 0;
        int medium = 0;
        int low = 0;
        boolean scanned = false;

        int total() {
            return critical + high + medium + low;
        }
    }

    // Parse Trivy JSON to extract vulnerability stats
    private static VulnStats parseTrivyVulnerabilities(JsonObject trivyJson) {
        VulnStats stats = new VulnStats();
        if (trivyJson == null)
            return stats;

        stats.scanned = true;
        try {
            JsonArray results = trivyJson.getAsJsonArray("Results");
            if (results != null) {
                for (int i = 0; i < results.size(); i++) {
                    JsonObject result = results.get(i).getAsJsonObject();
                    JsonArray vulns = result.getAsJsonArray("Vulnerabilities");
                    if (vulns != null) {
                        for (int j = 0; j < vulns.size(); j++) {
                            JsonObject vuln = vulns.get(j).getAsJsonObject();
                            String severity = vuln.has("Severity") ? vuln.get("Severity").getAsString() : "";
                            switch (severity.toUpperCase()) {
                                case "CRITICAL" -> stats.critical++;
                                case "HIGH" -> stats.high++;
                                case "MEDIUM" -> stats.medium++;
                                case "LOW" -> stats.low++;
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            // Ignore parse errors
        }
        return stats;
    }

    // Parse Trivy JSON to extract misconfiguration stats
    private static VulnStats parseTrivyMisconfigurations(JsonObject trivyJson) {
        VulnStats stats = new VulnStats();
        if (trivyJson == null)
            return stats;

        stats.scanned = true;
        try {
            JsonArray results = trivyJson.getAsJsonArray("Results");
            if (results != null) {
                for (int i = 0; i < results.size(); i++) {
                    JsonObject result = results.get(i).getAsJsonObject();
                    JsonArray misconfigs = result.getAsJsonArray("Misconfigurations");
                    if (misconfigs != null) {
                        for (int j = 0; j < misconfigs.size(); j++) {
                            JsonObject misconfig = misconfigs.get(j).getAsJsonObject();
                            String severity = misconfig.has("Severity") ? misconfig.get("Severity").getAsString() : "";
                            switch (severity.toUpperCase()) {
                                case "CRITICAL" -> stats.critical++;
                                case "HIGH" -> stats.high++;
                                case "MEDIUM" -> stats.medium++;
                                case "LOW" -> stats.low++;
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            // Ignore parse errors
        }
        return stats;
    }

    // Parse Semgrep JSON to extract finding stats
    private static void parseSemgrepStats(JsonObject semgrepJson, ScanStats stats) {
        if (semgrepJson == null)
            return;

        try {
            JsonArray results = semgrepJson.getAsJsonArray("results");
            if (results != null) {
                for (int i = 0; i < results.size(); i++) {
                    JsonObject result = results.get(i).getAsJsonObject();
                    JsonObject extra = result.getAsJsonObject("extra");
                    if (extra != null && extra.has("severity")) {
                        String severity = extra.get("severity").getAsString().toUpperCase();
                        switch (severity) {
                            case "ERROR" -> stats.semgrepErrors++;
                            case "WARNING" -> stats.semgrepWarnings++;
                            case "INFO" -> stats.semgrepInfo++;
                        }
                    }
                }
            }
        } catch (Exception e) {
            // Ignore parse errors
        }
    }

    // Load scan statistics from JSON files
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

            // Check for Dependabot
            stats.hasDependabot = Files.exists(scanPath.resolve("DEPENDABOT_SUMMARY.md"));
        } catch (Exception e) {
            // Ignore errors
        }

        return stats;
    }
}
