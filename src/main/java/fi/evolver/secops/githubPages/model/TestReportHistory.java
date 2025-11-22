package fi.evolver.secops.githubPages.model;

import java.util.ArrayList;
import java.util.List;

/**
 * Model for test report history JSON format:
 *
 * {
 *   "version": 1,
 *   "reports": [ ... TestReportEntry ... ]
 * }
 */
public class TestReportHistory {

    public int version = 1;
    public List<TestReportEntry> reports = new ArrayList<>();

    /**
     * Single test report history entry.
     * Contains only metadata (no scan statistics).
     */
    public static class TestReportEntry {
        public String channel;
        public String timestamp;
        public HistoryMetadata metadata;
        /** Whether JaCoCo coverage report is available */
        public boolean hasJacoco;
        /** Whether Surefire test report is available */
        public boolean hasSurefire;

        public static TestReportEntry from(String channel, String timestamp,
                ScanMetadata scanMetadata, boolean hasJacoco, boolean hasSurefire) {
            TestReportEntry entry = new TestReportEntry();
            entry.channel = channel;
            entry.timestamp = timestamp;
            entry.hasJacoco = hasJacoco;
            entry.hasSurefire = hasSurefire;

            if (scanMetadata != null) {
                HistoryMetadata m = new HistoryMetadata();
                m.branch = scanMetadata.branch;
                m.commit = scanMetadata.commit;
                m.repository = scanMetadata.repository;
                entry.metadata = m;
            }
            return entry;
        }
    }
}
