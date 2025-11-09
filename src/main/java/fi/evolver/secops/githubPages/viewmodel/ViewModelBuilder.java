package fi.evolver.secops.githubPages.viewmodel;

import fi.evolver.secops.githubPages.model.*;
import fi.evolver.secops.githubPages.transformer.FindingsTransformer.TransformedScanData;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Builds view models for FreeMarker templates.
 * This layer contains NO I/O, only data mapping.
 */
public class ViewModelBuilder {

    public Map<String, Object> buildScanDetailModel(
            TransformedScanData data,
            String timestamp,
            String channel,
            Path scanPath) {
        var model = new HashMap<String, Object>();

        // Basic info
        model.put("title", "Security Scan - " + timestamp);
        model.put("channel", channel);
        model.put("timestamp", timestamp);
        model.put("timestampHuman", formatTimestamp(timestamp));

        // Metadata
        var md = new HashMap<String, Object>();
        if (data.metadata != null) {
            putIfNotNull(md, "branch", data.metadata.branch);
            putIfNotNull(md, "commit_sha", data.metadata.commitSha);
            putIfNotNull(md, "repository", data.metadata.repository);
            md.put("timestamp", timestamp);
        }
        model.put("metadata", md);

        // Footer metadata
        var footer = new HashMap<String, Object>();
        if (data.metadata != null && data.metadata.footer != null) {
            putIfNotNull(footer, "app_docs_url", data.metadata.footer.app_docs_url);
            putIfNotNull(footer, "app_issues_url", data.metadata.footer.app_issues_url);
            putIfNotNull(footer, "ci_job_name", data.metadata.footer.ci_job_name);
            putIfNotNull(footer, "ci_job_url", data.metadata.footer.ci_job_url);
            putIfNotNull(footer, "trivy_version", data.metadata.footer.trivy_version);
            putIfNotNull(footer, "semgrep_version", data.metadata.footer.semgrep_version);
            putIfNotNull(footer, "toolkit_version", data.metadata.footer.toolkit_version);
        }
        model.put("footer", footer);

        // Trivy findings with boolean flags
        model.put("hasTrivyFsVulns", !data.trivyFsVulns.isEmpty());
        model.put("trivyFsVulns", data.trivyFsVulns);
        model.put("hasTrivyFsMisconfigs", !data.trivyFsMisconfigs.isEmpty());
        model.put("trivyFsMisconfigs", data.trivyFsMisconfigs);

        model.put("hasTrivyImageVulns", !data.trivyImageVulns.isEmpty());
        model.put("trivyImageVulns", data.trivyImageVulns);
        model.put("hasTrivyImageMisconfigs", !data.trivyImageMisconfigs.isEmpty());
        model.put("trivyImageMisconfigs", data.trivyImageMisconfigs);

        model.put("hasTrivy",
                !data.trivyFsVulns.isEmpty() ||
                        !data.trivyFsMisconfigs.isEmpty() ||
                        !data.trivyImageVulns.isEmpty() ||
                        !data.trivyImageMisconfigs.isEmpty());

        // Semgrep findings with boolean flag
        model.put("hasSemgrepFindings", !data.semgrepFindings.isEmpty());
        model.put("semgrepFindings", data.semgrepFindings);
        model.put("semgrepSummaryMd", data.semgrepSummary);

        // Dependabot
        model.put("hasDependabot", data.dependabotSummary != null && !data.dependabotSummary.isBlank());
        model.put("dependabotSummaryMd", data.dependabotSummary);

        // Paths (relative to scan page)
        model.put("rootCss", "../../../style.css");
        model.put("linkAllScans", "../../../index.html");
        model.put("linkChannelIndex", "../index.html");

        // JSON file paths (only if they exist)
        model.put("jsonFsPath",
                Files.exists(scanPath.resolve("trivy-fs-results.json")) ? "trivy-fs-results.json" : null);
        model.put("jsonImagePath",
                Files.exists(scanPath.resolve("trivy-image-results.json")) ? "trivy-image-results.json" : null);
        model.put("jsonSemgrepPath",
                Files.exists(scanPath.resolve("semgrep-results.json")) ? "semgrep-results.json" : null);

        return model;
    }

    public Map<String, Object> buildChannelIndexModel(
            String channel,
            List<ScanEntry> scans) {
        var model = new HashMap<String, Object>();
        model.put("title", "Security Scans - " + channel);
        model.put("channel", channel);
        model.put("rootCss", "../../style.css");
        model.put("linkAllChannels", "../../index.html");
        model.put("scans", scans);
        model.put("metadata", new HashMap<String, Object>()); // Empty metadata for index pages
        model.put("footer", new HashMap<String, Object>()); // Empty footer for index pages
        return model;
    }

    public Map<String, Object> buildMainIndexModel(
            List<ChannelSummary> channels) {
        var model = new HashMap<String, Object>();
        model.put("title", "Security Scan Reports");
        model.put("rootCss", "style.css");
        model.put("channels", channels);
        model.put("metadata", new HashMap<String, Object>()); // Empty metadata for index pages
        model.put("footer", new HashMap<String, Object>()); // Empty footer for index pages
        return model;
    }

    private void putIfNotNull(Map<String, Object> map, String key, String value) {
        if (value != null && !value.isBlank()) {
            map.put(key, value);
        }
    }

    public static String formatTimestamp(String ts) {
        try {
            DateTimeFormatter inFmt = DateTimeFormatter.ofPattern("yyyy-MM-dd-HHmmssX");
            OffsetDateTime odt = OffsetDateTime.parse(ts, inFmt);
            return odt.withOffsetSameInstant(ZoneOffset.UTC)
                    .format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss 'UTC'"));
        } catch (Exception e) {
            // Fallback: return raw timestamp
            return ts;
        }
    }

    /**
     * Scan entry for index pages.
     */
    public static class ScanEntry {
        public String timestamp;
        public String path;
        public ScanStats stats;
        public String branch;
        public String commit;
        public String repository;
        public String linkHref;

        public ScanEntry(String timestamp, String path) {
            this.timestamp = timestamp;
            this.path = path;
        }

        public String getTimestampHuman() {
            return formatTimestamp(timestamp);
        }
    }

    /**
     * Channel summary for main index.
     */
    public static class ChannelSummary {
        public String name;
        public int total;
        public String latestTs;
        public String latestHuman;
        public String viewAllHref;
        public List<ScanEntry> recent;
    }
}
