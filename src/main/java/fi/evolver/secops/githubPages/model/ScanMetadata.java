package fi.evolver.secops.githubPages.model;

/**
 * Metadata about a security scan.
 */
public class ScanMetadata {
    public final String branch;
    public final String commit;
    public final String repository;
    public final String timestamp;

    public ScanMetadata(String branch, String commit, String repository, String timestamp) {
        this.branch = branch;
        this.commit = commit;
        this.repository = repository;
        this.timestamp = timestamp;
    }

    public static ScanMetadata empty(String timestamp) {
        return new ScanMetadata(null, null, null, timestamp);
    }
}
