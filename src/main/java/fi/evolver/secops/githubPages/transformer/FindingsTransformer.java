package fi.evolver.secops.githubPages.transformer;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import fi.evolver.secops.githubPages.loader.ScanResultLoader.RawScanData;
import fi.evolver.secops.githubPages.model.*;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Transforms raw JSON data into typed domain models with normalized severity.
 */
public class FindingsTransformer {

    public TransformedScanData transform(RawScanData raw) {
        TransformedScanData result = new TransformedScanData();

        // Transform Trivy findings
        result.trivyFsVulns = extractTrivyVulnerabilities(raw.trivyFs);
        result.trivyFsMisconfigs = extractTrivyMisconfigurations(raw.trivyFs);
        result.trivyImageVulns = extractTrivyVulnerabilities(raw.trivyImage);
        result.trivyImageMisconfigs = extractTrivyMisconfigurations(raw.trivyImage);

        // Transform Opengrep findings
        result.opengrepFindings = extractOpengrepFindings(raw.opengrep);

        // Extract metadata
        result.metadata = extractMetadata(raw.metadata, "");

        // Copy summaries as-is
        result.trivySummary = raw.trivySummary;
        result.opengrepSummary = raw.opengrepSummary;
        result.dependabotSummary = raw.dependabotSummary;

        return result;
    }

    private List<TrivyFinding> extractTrivyVulnerabilities(JsonObject trivyResult) {
        List<TrivyFinding> findings = new ArrayList<>();
        if (trivyResult == null || !trivyResult.has("Results")) {
            return findings;
        }

        try {
            JsonArray results = trivyResult.getAsJsonArray("Results");
            for (JsonElement re : results) {
                JsonObject result = re.getAsJsonObject();
                String target = getString(result, "Target", "Unknown");

                if (!result.has("Vulnerabilities") || result.get("Vulnerabilities").isJsonNull()) {
                    continue;
                }

                JsonArray vulns = result.getAsJsonArray("Vulnerabilities");
                for (JsonElement ve : vulns) {
                    JsonObject v = ve.getAsJsonObject();
                    findings.add(new TrivyFinding(
                            "Vulnerability",
                            target,
                            getString(v, "PkgName", null),
                            getString(v, "VulnerabilityID", null),
                            Severity.parse(getString(v, "Severity", null)),
                            getString(v, "Title", getString(v, "Description", null)),
                            getString(v, "InstalledVersion", null),
                            getString(v, "FixedVersion", null)));
                }
            }
        } catch (Exception e) {
            System.err.println("⚠️  Failed to parse Trivy vulnerabilities: " + e.getMessage());
        }

        findings.sort(Comparator.comparingInt((TrivyFinding f) -> f.severity.getRank()).reversed());
        return findings;
    }

    private List<TrivyFinding> extractTrivyMisconfigurations(JsonObject trivyResult) {
        List<TrivyFinding> findings = new ArrayList<>();
        if (trivyResult == null || !trivyResult.has("Results")) {
            return findings;
        }

        try {
            JsonArray results = trivyResult.getAsJsonArray("Results");
            for (JsonElement re : results) {
                JsonObject result = re.getAsJsonObject();
                String target = getString(result, "Target", "Unknown");

                if (!result.has("Misconfigurations") || result.get("Misconfigurations").isJsonNull()) {
                    continue;
                }

                JsonArray mis = result.getAsJsonArray("Misconfigurations");
                for (JsonElement me : mis) {
                    JsonObject m = me.getAsJsonObject();
                    findings.add(new TrivyFinding(
                            "Misconfiguration",
                            target,
                            getString(m, "Type", null),
                            getString(m, "ID", null),
                            Severity.parse(getString(m, "Severity", null)),
                            getString(m, "Title", getString(m, "Message", null)),
                            null,
                            null));
                }
            }
        } catch (Exception e) {
            System.err.println("⚠️  Failed to parse Trivy misconfigurations: " + e.getMessage());
        }

        findings.sort(Comparator.comparingInt((TrivyFinding f) -> f.severity.getRank()).reversed());
        return findings;
    }

    private List<OpengrepFinding> extractOpengrepFindings(JsonObject opengrepResult) {
        List<OpengrepFinding> findings = new ArrayList<>();
        if (opengrepResult == null || !opengrepResult.has("results")) {
            return findings;
        }

        try {
            JsonArray results = opengrepResult.getAsJsonArray("results");
            for (JsonElement e : results) {
                JsonObject o = e.getAsJsonObject();
                String ruleId = getString(o, "check_id", null);
                String path = getString(o, "path", null);
                int line = 0;

                if (o.has("start") && !o.get("start").isJsonNull()) {
                    JsonObject start = o.getAsJsonObject("start");
                    if (start.has("line") && !start.get("line").isJsonNull()) {
                        line = start.get("line").getAsInt();
                    }
                }

                String severityStr = "INFO";
                String message = null;
                if (o.has("extra") && !o.get("extra").isJsonNull()) {
                    JsonObject extra = o.getAsJsonObject("extra");
                    severityStr = getString(extra, "severity", "INFO").toUpperCase();
                    message = getString(extra, "message", null);
                }

                findings.add(new OpengrepFinding(
                        ruleId,
                        Severity.parse(severityStr),
                        path,
                        line,
                        message));
            }
        } catch (Exception e) {
            System.err.println("⚠️  Failed to parse Opengrep findings: " + e.getMessage());
        }

        findings.sort(Comparator.comparingInt((OpengrepFinding f) -> f.severity.getRank()).reversed());
        return findings;
    }

    public ScanMetadata extractMetadata(JsonObject metadataJson, String timestamp) {
        if (metadataJson == null) {
            return ScanMetadata.empty(timestamp);
        }

        // Extract footer metadata if present
        ScanMetadata.FooterMetadata footer = ScanMetadata.FooterMetadata.empty();
        if (metadataJson.has("footer") && metadataJson.get("footer").isJsonObject()) {
            JsonObject footerJson = metadataJson.getAsJsonObject("footer");
            footer = new ScanMetadata.FooterMetadata(
                    getString(footerJson, "app_docs_url", ""),
                    getString(footerJson, "app_issues_url", ""),
                    getString(footerJson, "ci_job_name", ""),
                    getString(footerJson, "ci_job_url", ""),
                    getString(footerJson, "trivy_version", ""),
                    getString(footerJson, "opengrep_version", ""),
                    getString(footerJson, "toolkit_version", ""));
        }

        return new ScanMetadata(
                getString(metadataJson, "branch", null),
                getString(metadataJson, "commit_sha", null),
                getString(metadataJson, "repository", null),
                timestamp,
                footer);
    }

    public ScanStats extractStats(JsonObject trivyFs, JsonObject trivyImage, JsonObject opengrep,
            boolean hasDependabot) {
        ScanStats stats = new ScanStats();

        stats.trivyFs = parseTrivyVulnStats(trivyFs);
        stats.trivyFsMisconfig = parseTrivyMisconfigStats(trivyFs);
        stats.trivyImage = parseTrivyVulnStats(trivyImage);
        stats.trivyImageMisconfig = parseTrivyMisconfigStats(trivyImage);

        if (opengrep != null && opengrep.has("results")) {
            try {
                JsonArray results = opengrep.getAsJsonArray("results");
                for (JsonElement e : results) {
                    JsonObject extra = e.getAsJsonObject().getAsJsonObject("extra");
                    if (extra != null && extra.has("severity")) {
                        String sev = extra.get("severity").getAsString().toUpperCase();
                        switch (sev) {
                            case "ERROR" -> stats.opengrepErrors++;
                            case "WARNING" -> stats.opengrepWarnings++;
                            case "INFO" -> stats.opengrepInfo++;
                        }
                    }
                }
            } catch (Exception e) {
                System.err.println("⚠️  Failed to parse Opengrep stats: " + e.getMessage());
            }
        }

        stats.hasDependabot = hasDependabot;
        return stats;
    }

    private ScanStats.VulnStats parseTrivyVulnStats(JsonObject trivyJson) {
        ScanStats.VulnStats stats = new ScanStats.VulnStats();
        if (trivyJson == null) {
            return stats;
        }
        stats.scanned = true;

        try {
            if (!trivyJson.has("Results")) {
                return stats;
            }
            JsonArray results = trivyJson.getAsJsonArray("Results");
            for (JsonElement re : results) {
                JsonObject r = re.getAsJsonObject();
                if (!r.has("Vulnerabilities") || r.get("Vulnerabilities").isJsonNull()) {
                    continue;
                }
                JsonArray vulns = r.getAsJsonArray("Vulnerabilities");
                for (JsonElement ve : vulns) {
                    String sev = getString(ve.getAsJsonObject(), "Severity", "UNKNOWN").toUpperCase();
                    switch (sev) {
                        case "CRITICAL" -> stats.critical++;
                        case "HIGH" -> stats.high++;
                        case "MEDIUM" -> stats.medium++;
                        case "LOW" -> stats.low++;
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("⚠️  Failed to parse Trivy vulnerability stats: " + e.getMessage());
        }

        return stats;
    }

    private ScanStats.VulnStats parseTrivyMisconfigStats(JsonObject trivyJson) {
        ScanStats.VulnStats stats = new ScanStats.VulnStats();
        if (trivyJson == null) {
            return stats;
        }
        stats.scanned = true;

        try {
            if (!trivyJson.has("Results")) {
                return stats;
            }
            JsonArray results = trivyJson.getAsJsonArray("Results");
            for (JsonElement re : results) {
                JsonObject r = re.getAsJsonObject();
                if (!r.has("Misconfigurations") || r.get("Misconfigurations").isJsonNull()) {
                    continue;
                }
                JsonArray mis = r.getAsJsonArray("Misconfigurations");
                for (JsonElement me : mis) {
                    String sev = getString(me.getAsJsonObject(), "Severity", "UNKNOWN").toUpperCase();
                    switch (sev) {
                        case "CRITICAL" -> stats.critical++;
                        case "HIGH" -> stats.high++;
                        case "MEDIUM" -> stats.medium++;
                        case "LOW" -> stats.low++;
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("⚠️  Failed to parse Trivy misconfiguration stats: " + e.getMessage());
        }

        return stats;
    }

    private String getString(JsonObject obj, String key, String defaultValue) {
        if (obj == null || !obj.has(key) || obj.get(key).isJsonNull()) {
            return defaultValue;
        }
        String value = obj.get(key).getAsString();
        return (value != null && !value.isBlank()) ? value : defaultValue;
    }

    /**
     * Container for transformed data.
     */
    public static class TransformedScanData {
        public List<TrivyFinding> trivyFsVulns = new ArrayList<>();
        public List<TrivyFinding> trivyFsMisconfigs = new ArrayList<>();
        public List<TrivyFinding> trivyImageVulns = new ArrayList<>();
        public List<TrivyFinding> trivyImageMisconfigs = new ArrayList<>();
        public List<OpengrepFinding> opengrepFindings = new ArrayList<>();
        public ScanMetadata metadata;
        public String trivySummary;
        public String opengrepSummary;
        public String dependabotSummary;
    }
}
