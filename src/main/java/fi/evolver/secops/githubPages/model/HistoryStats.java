package fi.evolver.secops.githubPages.model;

/**
 * Statistics to be stored in the history from different scanners.
 */
public class HistoryStats {

    public SeverityCounts trivyFs;
    public SeverityCounts trivyFsMisconfig;
    public SeverityCounts trivyImage;
    public SeverityCounts trivyImageMisconfig;
    public SemgrepCounts semgrep;
}
