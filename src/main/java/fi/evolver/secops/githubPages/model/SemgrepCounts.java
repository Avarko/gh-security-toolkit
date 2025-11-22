package fi.evolver.secops.githubPages.model;

/**
 * Concise counts of Semgrep results for history.
 */
public class SemgrepCounts {

    public int errors;
    public int warnings;
    public int info;

    public static SemgrepCounts from(ScanStats stats) {
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
