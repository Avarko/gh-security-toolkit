package fi.evolver.secops.githubPages.model;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Statistics to be stored in scan-history.json, matching TypeScript schema.
 *
 * TypeScript schema expects:
 * {
 *   trivyFsResults?: { totalVulnerabilities: Record<string, number> },
 *   trivyImageResults?: { totalVulnerabilities: Record<string, number> },
 *   semgrepResults?: { totalErrors: number, totalWarnings: number, totalInfos: number }
 * }
 */
public class HistoryStats {

    public TrivyResults trivyFsResults;
    public TrivyResults trivyImageResults;
    public SemgrepResults semgrepResults;

    /**
     * Trivy results wrapper for vulnerability counts.
     */
    public static class TrivyResults {
        public Map<String, Integer> totalVulnerabilities = new LinkedHashMap<>();

        public static TrivyResults from(ScanStats.VulnStats vulnStats, ScanStats.VulnStats misconfigStats) {
            TrivyResults results = new TrivyResults();
            if (vulnStats != null && vulnStats.scanned) {
                results.totalVulnerabilities.put("CRITICAL", vulnStats.critical);
                results.totalVulnerabilities.put("HIGH", vulnStats.high);
                results.totalVulnerabilities.put("MEDIUM", vulnStats.medium);
                results.totalVulnerabilities.put("LOW", vulnStats.low);
            }
            // Misconfigs could be added separately if needed, but for now we combine with vulns
            if (misconfigStats != null && misconfigStats.scanned) {
                results.totalVulnerabilities.merge("CRITICAL", misconfigStats.critical, Integer::sum);
                results.totalVulnerabilities.merge("HIGH", misconfigStats.high, Integer::sum);
                results.totalVulnerabilities.merge("MEDIUM", misconfigStats.medium, Integer::sum);
                results.totalVulnerabilities.merge("LOW", misconfigStats.low, Integer::sum);
            }
            return results.totalVulnerabilities.isEmpty() ? null : results;
        }
    }

    /**
     * Semgrep results wrapper.
     */
    public static class SemgrepResults {
        public int totalErrors;
        public int totalWarnings;
        public int totalInfos;

        public static SemgrepResults from(ScanStats stats) {
            if (stats == null) {
                return null;
            }
            SemgrepResults results = new SemgrepResults();
            results.totalErrors = stats.semgrepErrors;
            results.totalWarnings = stats.semgrepWarnings;
            results.totalInfos = stats.semgrepInfo;
            return (results.totalErrors == 0 && results.totalWarnings == 0 && results.totalInfos == 0) ? null : results;
        }
    }

    /**
     * Creates HistoryStats from ScanStats.
     */
    public static HistoryStats from(ScanStats stats) {
        if (stats == null) {
            return null;
        }
        HistoryStats historyStats = new HistoryStats();
        historyStats.trivyFsResults = TrivyResults.from(stats.trivyFs, stats.trivyFsMisconfig);
        historyStats.trivyImageResults = TrivyResults.from(stats.trivyImage, stats.trivyImageMisconfig);
        historyStats.semgrepResults = SemgrepResults.from(stats);

        // Return null if no stats were collected
        if (historyStats.trivyFsResults == null &&
            historyStats.trivyImageResults == null &&
            historyStats.semgrepResults == null) {
            return null;
        }
        return historyStats;
    }
}
