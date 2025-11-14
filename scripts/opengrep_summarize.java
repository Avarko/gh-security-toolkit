///usr/bin/env jbang "$0" "$@" ; exit $?
/*
 * Usage:
 *   jbang scripts/opengrep_summarize.java <JSON_PATH> <MAX_ROWS> <OUTDIR>
 *
 * Arguments:
 *   JSON_PATH  - Path to opengrep-results.json file
 *   MAX_ROWS   - Maximum number of rows to display in summary
 *   OUTDIR     - Output directory for summary files
 *
 * Env:
 *   TITLE (optional) - Custom title for summary
 */
//DEPS com.fasterxml.jackson.core:jackson-databind:2.17.2

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;

import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.stream.*;

public class opengrep_summarize {

    static final Map<String, Integer> SEV_ORDER = Map.of(
            "ERROR", 0, "WARNING", 1, "INFO", 2);

    record Finding(String severity, String check_id, String message, String path, int line, String fingerprint) {
    }

    public static void main(String[] args) throws Exception {
        if (args.length < 3) {
            System.err.println("Usage: jbang opengrep_summarize.java <JSON_PATH> <MAX_ROWS> <OUTDIR>");
            System.exit(1);
        }

        String jsonPath = args[0];
        int maxRows = Integer.parseInt(args[1]);
        String outdir = args[2];
        String title = envOr("TITLE", "Opengrep SAST summary");

        Files.createDirectories(Path.of(outdir));
        String summaryFile = outdir + "/SEMGREP_SUMMARY.md";

        ObjectMapper om = new ObjectMapper();
        JsonNode root;
        try {
            root = om.readTree(new File(jsonPath));
        } catch (IOException e) {
            String body = "## " + title + "\nNo Opengrep results file produced.\n";
            writeSummary(body, summaryFile);
            return;
        }

        List<Finding> findings = extractFindings(root);

        // Group by severity
        Map<String, Long> counts = findings.stream()
                .collect(Collectors.groupingBy(Finding::severity, Collectors.counting()));

        long errorCount = counts.getOrDefault("ERROR", 0L);
        long warningCount = counts.getOrDefault("WARNING", 0L);
        long infoCount = counts.getOrDefault("INFO", 0L);

        String countsSummary = String.format("%d ERROR, %d WARNING, %d INFO",
                errorCount, warningCount, infoCount);

        // Sort by severity, then by check_id
        findings.sort(Comparator
                .comparingInt((Finding f) -> SEV_ORDER.getOrDefault(f.severity(), 99))
                .thenComparing(Finding::check_id));

        // Format top findings
        String findingsBlock = findings.stream()
                .limit(maxRows)
                .map(f -> String.format("[%s] %s - %s:%d\n  Message: %s",
                        f.severity(),
                        f.check_id(),
                        f.path(),
                        f.line(),
                        truncate(f.message(), 100)))
                .collect(Collectors.joining("\n\n"));

        String summaryMd = "## " + title + "\n" +
                "**Summary:** " + countsSummary + " findings (" + findings.size() + " total)\n\n" +
                (!findingsBlock.isBlank()
                        ? "**Top findings (showing max " + maxRows + "):**\n\n" + findingsBlock
                        : "No findings.")
                +
                "\n";

        writeSummary(summaryMd, summaryFile);
    }

    static List<Finding> extractFindings(JsonNode root) {
        List<Finding> out = new ArrayList<>();
        JsonNode results = root.get("results");
        if (results == null || !results.isArray()) {
            return out;
        }

        for (JsonNode r : results) {
            String checkId = text(r, "check_id", "unknown");
            String message = text(r, "extra", "message", "");
            String severity = text(r, "extra", "severity", "INFO").toUpperCase();
            String fingerprint = text(r, "extra", "fingerprint", "");

            JsonNode pathNode = r.get("path");
            String path = pathNode != null ? pathNode.asText() : "unknown";

            JsonNode startNode = r.get("start");
            int line = startNode != null && startNode.has("line")
                    ? startNode.get("line").asInt()
                    : 0;

            out.add(new Finding(severity, checkId, message, path, line, fingerprint));
        }

        return out;
    }

    static String text(JsonNode node, String... path) {
        JsonNode current = node;
        for (String key : path) {
            if (current == null || !current.has(key)) {
                return "";
            }
            current = current.get(key);
        }
        return current != null ? current.asText() : "";
    }

    static String envOr(String k, String def) {
        return System.getenv().getOrDefault(k, def);
    }

    static String truncate(String s, int maxLen) {
        if (s == null || s.length() <= maxLen) {
            return s;
        }
        return s.substring(0, maxLen) + "...";
    }

    static void writeSummary(String md, String fallbackFile) throws IOException {
        // Always write to fallback file for artifacts/release
        Files.writeString(Path.of(fallbackFile), md + "\n");
        System.out.println("Wrote " + fallbackFile);

        // Also write to GitHub step summary if available
        String summaryPath = System.getenv("GITHUB_STEP_SUMMARY");
        if (summaryPath != null && !summaryPath.isBlank()) {
            Files.writeString(Path.of(summaryPath), md + "\n",
                    java.nio.file.StandardOpenOption.CREATE,
                    java.nio.file.StandardOpenOption.APPEND);
        }
    }
}
