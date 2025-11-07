///usr/bin/env jbang "$0" "$@" ; exit $?
//DEPS gg.jte:jte:3.1.12
//DEPS com.google.code.gson:gson:2.10.1

import gg.jte.ContentType;
import gg.jte.TemplateEngine;
import gg.jte.TemplateOutput;
import gg.jte.output.StringOutput;
import gg.jte.resolve.DirectoryCodeResolver;
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

        // Summary sections
        if (results.trivySummary != null) {
            html.append("    <section class=\"summary trivy\">\n");
            html.append("      <h2>Trivy Results</h2>\n");
            html.append("      <div class=\"markdown-content\">").append(markdownToHtml(results.trivySummary))
                    .append("</div>\n");
            if (results.trivyFs != null) {
                html.append(
                        "      <p><a href=\"trivy-fs-results.json\" class=\"json-link\">📄 View Filesystem JSON</a></p>\n");
            }
            if (results.trivyImage != null) {
                html.append(
                        "      <p><a href=\"trivy-image-results.json\" class=\"json-link\">📄 View Image JSON</a></p>\n");
            }
            html.append("    </section>\n");
        }

        if (results.semgrepSummary != null) {
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
                            scans.add(new ScanEntry(timestamp, "scans/" + channel + "/" + timestamp));
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
            html.append("      <ul class=\"scan-items\">\n");
            for (ScanEntry scan : scans) {
                html.append("        <li>\n");
                html.append("          <a href=\"").append(scan.timestamp).append("/index.html\">\n");
                html.append("            <span class=\"timestamp\">").append(formatTimestamp(scan.timestamp))
                        .append("</span>\n");
                html.append("          </a>\n");
                html.append("        </li>\n");
            }
            html.append("      </ul>\n");
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
                ScanEntry latest = scans.get(0);

                html.append("    <section class=\"channel\">\n");
                html.append("      <h2>").append(channel).append("</h2>\n");
                html.append("      <p class=\"channel-info\">\n");
                html.append("        <strong>Total scans:</strong> ").append(scans.size()).append(" | \n");
                html.append("        <strong>Latest:</strong> ").append(formatTimestamp(latest.timestamp)).append("\n");
                html.append("      </p>\n");
                html.append("      <div class=\"channel-actions\">\n");
                html.append("        <a href=\"").append(latest.path)
                        .append("/index.html\" class=\"btn btn-primary\">View Latest Scan</a>\n");
                html.append("        <a href=\"scans/").append(channel)
                        .append("/index.html\" class=\"btn btn-secondary\">View All (").append(scans.size())
                        .append(")</a>\n");
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

                @media (max-width: 768px) {
                    .metadata dl {
                        grid-template-columns: 1fr;
                    }

                    .channel-actions {
                        flex-direction: column;
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
            // Format: 2025-11-07-033946Z -> 2025-11-07 03:39:46 UTC
            String dateStr = timestamp.replace("Z", "").replace("-", " ", 3);
            return dateStr.substring(0, 10) + " " +
                    dateStr.substring(11, 13) + ":" +
                    dateStr.substring(13, 15) + ":" +
                    dateStr.substring(15, 17) + " UTC";
        } catch (Exception e) {
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

        ScanEntry(String timestamp, String path) {
            this.timestamp = timestamp;
            this.path = path;
        }
    }
}
