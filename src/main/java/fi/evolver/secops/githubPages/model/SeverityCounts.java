package fi.evolver.secops.githubPages.model;

/**
 * Single severity count summary for one Trivy stats (fs/image/misconfig).
 */
public class SeverityCounts {

    public int critical;
    public int high;
    public int medium;
    public int low;
    public boolean scanned;

    public static SeverityCounts from(ScanStats.VulnStats stats) {
        SeverityCounts counts = new SeverityCounts();
        if (stats == null) {
            return counts;
        }
        counts.critical = stats.critical;
        counts.high = stats.high;
        counts.medium = stats.medium;
        counts.low = stats.low;
        counts.scanned = stats.scanned;
        return counts;
    }
}
