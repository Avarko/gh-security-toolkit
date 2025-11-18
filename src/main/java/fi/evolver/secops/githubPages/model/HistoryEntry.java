package fi.evolver.secops.githubPages.model;

/**
 * Single history entry: statistics and metadata for a single run.
 *
 * Fields are flattened to match TypeScript schema:
 * {
 *   channel: string,
 *   timestamp: string,
 *   metadata: {...},
 *   trivyFsResults?: {...},
 *   trivyImageResults?: {...},
 *   semgrepResults?: {...}
 * }
 */
public class HistoryEntry {

    public String channel;
    public String timestamp;
    public HistoryMetadata metadata;

    // Stats fields are flattened (not nested under "stats" object)
    public HistoryStats.TrivyResults trivyFsResults;
    public HistoryStats.TrivyResults trivyImageResults;
    public HistoryStats.SemgrepResults semgrepResults;

    public static HistoryEntry from(String channel,
            String timestamp,
            ScanMetadata metadata,
            HistoryStats stats) {
        HistoryEntry entry = new HistoryEntry();
        entry.channel = channel;
        entry.timestamp = timestamp;

        // Flatten stats fields
        if (stats != null) {
            entry.trivyFsResults = stats.trivyFsResults;
            entry.trivyImageResults = stats.trivyImageResults;
            entry.semgrepResults = stats.semgrepResults;
        }

        if (metadata != null) {
            HistoryMetadata m = new HistoryMetadata();
            m.branch = metadata.branch;
            m.commit = metadata.commit;
            m.repository = metadata.repository;
            entry.metadata = m;
        }
        return entry;
    }
}
