package fi.evolver.secops.githubPages.model;

/**
 * Metadata about a security scan.
 */
public class ScanMetadata {
    public final String branch;
    public final String commitSha;
    public final String repository;
    public final String timestamp;
    public final FooterMetadata footer;

    public ScanMetadata(String branch, String commitSha, String repository, String timestamp, FooterMetadata footer) {
        this.branch = branch;
        this.commitSha = commitSha;
        this.repository = repository;
        this.timestamp = timestamp;
        this.footer = footer != null ? footer : FooterMetadata.empty();
    }

    public static ScanMetadata empty(String timestamp) {
        return new ScanMetadata(null, null, null, timestamp, FooterMetadata.empty());
    }

    /**
     * Footer metadata for links and tool versions.
     */
    public static class FooterMetadata {
        public final String app_docs_url;
        public final String app_issues_url;
        public final String ci_job_name;
        public final String ci_job_url;
        public final String trivy_version;
        public final String opengrep_version;
        public final String toolkit_version;

        public FooterMetadata(
                String app_docs_url,
                String app_issues_url,
                String ci_job_name,
                String ci_job_url,
                String trivy_version,
                String opengrep_version,
                String toolkit_version) {
            this.app_docs_url = app_docs_url;
            this.app_issues_url = app_issues_url;
            this.ci_job_name = ci_job_name;
            this.ci_job_url = ci_job_url;
            this.trivy_version = trivy_version;
            this.opengrep_version = opengrep_version;
            this.toolkit_version = toolkit_version;
        }

        public static FooterMetadata empty() {
            return new FooterMetadata("", "", "", "", "", "", "");
        }
    }
}
