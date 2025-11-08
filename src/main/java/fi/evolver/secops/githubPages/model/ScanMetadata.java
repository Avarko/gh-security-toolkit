package fi.evolver.secops.githubPages.model;

/**
 * Metadata about a security scan.
 */
public class ScanMetadata {
    public final String branch;
    public final String commitSha;
    public final String repository;
    public final String timestamp;

    public ScanMetadata(String branch, String commitSha, String repository, String timestamp) {
        this.branch = branch;
        this.commitSha = commitSha;
        this.repository = repository;
        this.timestamp = timestamp;
    }

    public static ScanMetadata empty(String timestamp) {
        return new ScanMetadata(null, null, null, timestamp);
    }
}
