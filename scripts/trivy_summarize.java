///usr/bin/env jbang "$0" "$@" ; exit $?
/*
 * Usage:
 *   jbang scripts/trivy_summarize.java <JSON_PATH> <MAX_ROWS> <OUTDIR>
 *
 * Arguments:
 *   JSON_PATH  - Path to trivy-results.json file (e.g., /tmp/output/trivy-fs-results.json)
 *   MAX_ROWS   - Maximum number of rows to display in summary (e.g., 20)
 *   OUTDIR     - Output directory for summary files (e.g., /tmp/output)
 *
 * Env:
 *   TITLE_VULN, TITLE_MIS, WRITE_LOCAL_PR_COMMENT=1
 *   GITHUB_STEP_SUMMARY, GITHUB_OUTPUT
 *   SLACK_BOT_TOKEN (optional) - OAuth token with chat:write permission
 *   SLACK_CHANNEL (optional) - Channel ID (#security-alerts), User ID (U1234567890), or email
 */
//DEPS com.fasterxml.jackson.core:jackson-databind:2.17.2
//DEPS com.squareup.okhttp3:okhttp:4.12.0

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import okhttp3.*;

import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.stream.*;

public class trivy_summarize {

    static final Map<String, Integer> SEV_ORDER = Map.of(
            "CRITICAL", 0, "HIGH", 1, "MEDIUM", 2, "LOW", 3, "UNKNOWN", 4);

    record Vuln(String severity, String pkg, String version, String fix, String cve, String url, Set<String> targets) {
    }

    record Mis(String severity, String title, String id, Set<String> targets, Set<String> lines) {
    }

    public static void main(String[] args) throws Exception {
        if (args.length < 3) {
            System.err.println("Usage: jbang trivy_summarize.java <JSON_PATH> <MAX_ROWS> <OUTDIR>");
            System.err.println("  JSON_PATH: Path to trivy-results.json (e.g., /tmp/output/trivy-fs-results.json)");
            System.err.println("  MAX_ROWS:  Maximum number of rows to display (e.g., 20)");
            System.err.println("  OUTDIR:    Output directory for summary files (e.g., /tmp/output)");
            System.exit(1);
        }

        String jsonPath = args[0];
        int maxRows = Integer.parseInt(args[1]);
        String outdir = args[2];
        String titleV = envOr("TITLE_VULN", "Trivy vulnerability summary");
        String titleM = envOr("TITLE_MIS", "Trivy misconfiguration summary");

        Files.createDirectories(Path.of(outdir));
        String summaryFile = outdir + "/TRIVY_SUMMARY.md";
        String prCommentFile = outdir + "/.trivy-pr-comment.txt";
        boolean writeLocalPr = "1".equals(System.getenv("WRITE_LOCAL_PR_COMMENT"));

        ObjectMapper om = new ObjectMapper();
        JsonNode root;
        try {
            root = om.readTree(new File(jsonPath));
        } catch (IOException e) {
            // ei tuloksia → kirjoita tyhjä yhteenveto
            String body = section(titleV, "No results file produced.") +
                    "\n" + section(titleM, "No results file produced.") + "\n";
            writeSummary(body, summaryFile);
            writeGitHubOutputBody("[No results file produced]");
            if (writeLocalPr)
                Files.writeString(Path.of(prCommentFile), "[No results file produced]\n");
            slackNotifyIfConfigured("Trivy summary: no results file", body);
            return;
        }

        List<Vuln> vulns = groupVulns(root);
        List<Mis> mis = groupMis(root);

        String vulnCounts = countsBySeverity(vulns);
        String vulnBlock = lines(vulns, maxRows).map(v -> String.format("[%s] %s@%s (fix: %s) in %s [%s]%s",
                v.severity(), v.pkg(), v.version(), v.fix(),
                String.join(", ", sorted(v.targets())),
                v.cve(), v.url().isBlank() ? "" : " " + v.url())).collect(Collectors.joining("\n"));

        String misBlock = lines(mis, maxRows).map(m -> String.format("[%s] %s (%s) in %s%s",
                m.severity(), m.title(), m.id(),
                String.join(", ", sorted(m.targets())),
                m.lines().isEmpty() ? "" : ":" + String.join(",", sorted(m.lines()))))
                .collect(Collectors.joining("\n"));

        String summaryMd = "## " + titleV + "\n" +
                (vulnCounts.isBlank() ? "" : "**Summary:** " + vulnCounts + " unique vulnerabilities found\n\n") +
                (!vulnBlock.isBlank() ? "**Top vulnerabilities (showing max " + maxRows + "):**\n" +
                        Arrays.stream(vulnBlock.split("\n")).map(l -> "* " + l).collect(Collectors.joining("\n"))
                        : "No vulnerabilities found.")
                +
                "\n\n## " + titleM + "\n" +
                (!misBlock.isBlank()
                        ? Arrays.stream(misBlock.split("\n")).map(l -> "* " + l).collect(Collectors.joining("\n"))
                        : "No misconfigurations found.")
                + "\n";

        writeSummary(summaryMd, summaryFile);

        String prBody = "== Vulnerabilities (top " + maxRows + ") ==\n" +
                (vulnBlock.isBlank() ? "No vulnerabilities found." : vulnBlock) +
                "\n\n== Misconfigurations (top " + maxRows + ") ==\n" +
                (misBlock.isBlank() ? "No misconfigurations found." : misBlock) + "\n";

        writeGitHubOutputBody(prBody);
        if (writeLocalPr)
            Files.writeString(Path.of(prCommentFile), prBody);

        slackNotifyIfConfigured(buildSlackTitle(), summarizeForSlack(vulnCounts, vulns, mis));
    }

    // -------- helpers --------
    static String envOr(String k, String def) {
        return System.getenv().getOrDefault(k, def);
    }

    static String section(String title, String body) {
        return "## " + title + "\n" + body + "\n";
    }

    static List<Vuln> groupVulns(JsonNode root) {
        List<Vuln> out = new ArrayList<>();
        for (JsonNode r : optArray(root.get("Results"))) {
            String target = text(r, "Target", "unknown");
            for (JsonNode v : optArray(r.get("Vulnerabilities"))) {
                String pkg = text(v, "PkgName", "unknown");
                String ver = text(v, "InstalledVersion", "?");
                String cve = text(v, "VulnerabilityID", "N/A");
                String key = pkg + "@" + ver + "#" + cve;
                Vuln cur = new Vuln(
                        text(v, "Severity", "UNKNOWN"),
                        pkg, ver,
                        text(v, "FixedVersion", "-"),
                        cve,
                        text(v, "PrimaryURL", ""),
                        new HashSet<>(List.of(target)));
                // merge by key
                int idx = indexBy(out, key, x -> x.pkg() + "@" + x.version() + "#" + x.cve());
                if (idx >= 0) {
                    out.get(idx).targets().add(target);
                } else
                    out.add(cur);
            }
        }
        out.sort(Comparator.comparingInt(v -> SEV_ORDER.getOrDefault(v.severity(), 99)));
        return out;
    }

    static List<Mis> groupMis(JsonNode root) {
        List<Mis> out = new ArrayList<>();
        for (JsonNode r : optArray(root.get("Results"))) {
            String target = text(r, "Target", "unknown");
            for (JsonNode m : optArray(r.get("Misconfigurations"))) {
                String id = text(m, "ID", "N/A");
                String title = text(m, "Title", "Untitled");
                String key = id + "#" + title;
                String line = String.valueOf(intAt(m, "CauseMetadata", "StartLine", 0));
                Mis cur = new Mis(
                        text(m, "Severity", "UNKNOWN"),
                        title, id,
                        new HashSet<>(List.of(target)),
                        "0".equals(line) ? new HashSet<>() : new HashSet<>(List.of(line)));
                int idx = indexBy(out, key, x -> x.id() + "#" + x.title());
                if (idx >= 0) {
                    out.get(idx).targets().add(target);
                    if (!"0".equals(line))
                        out.get(idx).lines().add(line);
                } else
                    out.add(cur);
            }
        }
        out.sort(Comparator.comparingInt(v -> SEV_ORDER.getOrDefault(v.severity(), 99)));
        return out;
    }

    static String countsBySeverity(List<Vuln> vulns) {
        Map<String, Long> m = vulns.stream().collect(Collectors.groupingBy(Vuln::severity, Collectors.counting()));
        List<String> order = List.of("CRITICAL", "HIGH", "MEDIUM", "LOW", "UNKNOWN");
        return order.stream().filter(m::containsKey).map(s -> s + ":" + m.get(s)).collect(Collectors.joining(", "));
    }

    static <T> int indexBy(List<T> list, String key, java.util.function.Function<T, String> f) {
        for (int i = 0; i < list.size(); i++)
            if (f.apply(list.get(i)).equals(key))
                return i;
        return -1;
    }

    static Iterable<JsonNode> optArray(JsonNode n) {
        return n != null && n.isArray() ? n : List.<JsonNode>of();
    }

    static String text(JsonNode n, String field, String def) {
        JsonNode v = n.get(field);
        return v != null ? v.asText(def) : def;
    }

    static int intAt(JsonNode n, String f1, String f2, int def) {
        JsonNode c = n.get(f1);
        if (c == null)
            return def;
        JsonNode s = c.get(f2);
        return s != null ? s.asInt(def) : def;
    }

    static <T extends Comparable<T>> List<T> sorted(Collection<T> c) {
        return c.stream().sorted().toList();
    }

    static <T> Stream<T> lines(List<T> list, int max) {
        return list.stream().limit(max);
    }

    static void writeSummary(String md, String fallbackFile) throws IOException {
        // Always write to fallback file for artifacts/release
        Files.writeString(Path.of(fallbackFile), md + "\n");
        System.out.println("Wrote " + fallbackFile);

        // Also write to GitHub step summary if available
        String summaryPath = System.getenv("GITHUB_STEP_SUMMARY");
        if (summaryPath != null && !summaryPath.isBlank()) {
            Files.writeString(Path.of(summaryPath), md + "\n", java.nio.file.StandardOpenOption.CREATE,
                    java.nio.file.StandardOpenOption.APPEND);
        }
    }

    static void writeGitHubOutputBody(String body) throws IOException {
        String out = System.getenv("GITHUB_OUTPUT");
        if (out != null && !out.isBlank()) {
            Files.writeString(Path.of(out), "body<<EOF\n" + body + "\nEOF\n", java.nio.file.StandardOpenOption.CREATE,
                    java.nio.file.StandardOpenOption.APPEND);
        }
    }

    static void slackNotifyIfConfigured(String title, String text) {
        String token = System.getenv("SLACK_BOT_TOKEN");
        String channel = System.getenv("SLACK_CHANNEL");

        if (token == null || token.isBlank() || channel == null || channel.isBlank()) {
            return;
        }

        try {
            // Call slack_integration.java via ProcessBuilder
            ProcessBuilder pb = new ProcessBuilder(
                    "jbang", "scripts/slack_integration.java", title, text);
            pb.environment().put("SLACK_BOT_TOKEN", token);
            pb.environment().put("SLACK_CHANNEL", channel);
            pb.inheritIO(); // Show output directly

            Process process = pb.start();
            int exitCode = process.waitFor();

            if (exitCode != 0) {
                System.err.println("Slack notification failed with exit code: " + exitCode);
            }
        } catch (Exception e) {
            System.err.println("Failed to invoke slack_integration.java: " + e.getMessage());
        }
    }

    static String summarizeForSlack(String counts, List<Vuln> vulns, List<Mis> mis) {
        StringBuilder sb = new StringBuilder();

        // Add summary counts
        if (!counts.isBlank()) {
            sb.append(counts).append("\n\n");
        } else {
            sb.append("No vulnerabilities found.\n\n");
        }

        // Add top vulnerabilities as bullet points
        if (!vulns.isEmpty()) {
            sb.append("Top 5 vulnerabilities:\n");
            vulns.stream().limit(5).forEach(v -> {
                String cveId = v.cve();
                String cveOrgUrl = "https://www.cve.org/CVERecord?id=" + cveId;
                String nistUrl = "https://nvd.nist.gov/vuln/detail/" + cveId;
                String osvUrl = "https://osv.dev/vulnerability/" + cveId;

                sb.append("• [").append(v.severity()).append("] ")
                        .append(cveId).append(" ")
                        .append("(<").append(cveOrgUrl).append("|CVE.org>, ")
                        .append("<").append(nistUrl).append("|NIST>, ")
                        .append("<").append(osvUrl).append("|OSV>)")
                        .append("\n").append(v.pkg()).append("@").append(v.version())
                        .append(" → fix: `").append(v.fix()).append("`")
                        .append("\n");
            });
        }

        return sb.toString();
    }

    static String buildSlackTitle() {
        // Get git information
        String repoName = System.getenv("GITHUB_REPOSITORY");
        String branch = System.getenv("GITHUB_REF_NAME");
        String sha = System.getenv("GITHUB_SHA");

        // Fallback to local git if not in GitHub Actions
        if (repoName == null || repoName.isBlank()) {
            try {
                repoName = new String(Runtime.getRuntime()
                        .exec(new String[] { "git", "remote", "get-url", "origin" })
                        .getInputStream().readAllBytes()).trim()
                        .replaceAll(".*[:/]([^/]+/[^/]+)\\.git.*", "$1");
            } catch (Exception e) {
                repoName = "unknown-repo";
            }
        }

        if (branch == null || branch.isBlank()) {
            try {
                branch = new String(Runtime.getRuntime()
                        .exec(new String[] { "git", "rev-parse", "--abbrev-ref", "HEAD" })
                        .getInputStream().readAllBytes()).trim();
            } catch (Exception e) {
                branch = "unknown-branch";
            }
        }

        if (sha == null || sha.isBlank()) {
            try {
                sha = new String(Runtime.getRuntime()
                        .exec(new String[] { "git", "rev-parse", "HEAD" })
                        .getInputStream().readAllBytes()).trim().substring(0, 7);
            } catch (Exception e) {
                sha = "unknown";
            }
        } else {
            sha = sha.substring(0, Math.min(7, sha.length()));
        }

        // Current timestamp
        String timestamp = java.time.LocalDateTime.now()
                .format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));

        return String.format("*🔍 Trivy security scan*\n*%s | %s | %s @ %s*",
                repoName, branch, sha, timestamp);
    }
}
