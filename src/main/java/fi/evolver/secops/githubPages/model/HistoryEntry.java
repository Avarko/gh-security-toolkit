package fi.evolver.secops.githubPages.model;

/**
 * Single history entry: statistics and metadata for a single run.
 */
public class HistoryEntry {

    public String channel;
    public String timestamp;
    // public HistoryStats stats; // stats removed
    public HistoryMetadata metadata;

    public static HistoryEntry from(String channel,
            String timestamp,
            ScanMetadata metadata) {
        HistoryEntry entry = new HistoryEntry();
        entry.channel = channel;
        entry.timestamp = timestamp;
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
