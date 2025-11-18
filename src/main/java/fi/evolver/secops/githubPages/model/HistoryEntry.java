package fi.evolver.secops.githubPages.model;

/**
 * Single history entry: statistics and metadata for a single run.
 */
public class HistoryEntry {

    public String channel;
    public String timestamp;
    public HistoryStats stats;
    public HistoryMetadata metadata;

    public static HistoryEntry from(String channel,
            String timestamp,
            ScanStats stats,
            ScanMetadata metadata) {
        HistoryEntry entry = new HistoryEntry();
        entry.channel = channel;
        entry.timestamp = timestamp;

        if (stats == null) {
            stats = new ScanStats();
        }

        HistoryStats historyStats = new HistoryStats();
        historyStats.trivyFs = SeverityCounts.from(stats.trivyFs);
        historyStats.trivyFsMisconfig = SeverityCounts.from(stats.trivyFsMisconfig);
        historyStats.trivyImage = SeverityCounts.from(stats.trivyImage);
        historyStats.trivyImageMisconfig = SeverityCounts.from(stats.trivyImageMisconfig);
        historyStats.semgrep = SemgrepCounts.from(stats);

        entry.stats = historyStats;

        if (metadata != null) {
            HistoryMetadata m = new HistoryMetadata();
            m.branch = metadata.branch;
            m.commitSha = metadata.commitSha;
            m.repository = metadata.repository;
            entry.metadata = m;
        }

        return entry;
    }
}
