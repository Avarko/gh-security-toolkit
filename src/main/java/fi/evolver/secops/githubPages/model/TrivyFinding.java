package fi.evolver.secops.githubPages.model;

/**
 * Represents a Trivy finding (vulnerability or misconfiguration).
 */
public class TrivyFinding {
    public final String type; // "Vulnerability" or "Misconfiguration"
    public final String target;
    public final String pkg; // Package name (for vulns) or Type (for misconfigs)
    public final String id; // VulnerabilityID or ID
    public final Severity severity;
    public final String cssClass; // Pre-computed CSS class
    public final String title;
    public final String installedVersion;
    public final String fixedVersion;

    public TrivyFinding(
            String type,
            String target,
            String pkg,
            String id,
            Severity severity,
            String title,
            String installedVersion,
            String fixedVersion) {
        this.type = type;
        this.target = target != null && !target.isBlank() ? target : "—";
        this.pkg = pkg != null && !pkg.isBlank() ? pkg : "—";
        this.id = id != null && !id.isBlank() ? id : "—";
        this.severity = severity;
        this.cssClass = severity.getCssClass();
        this.title = title != null && !title.isBlank() ? title : "—";
        this.installedVersion = installedVersion != null && !installedVersion.isBlank() ? installedVersion : "—";
        this.fixedVersion = fixedVersion != null && !fixedVersion.isBlank() ? fixedVersion : "—";
    }

    public String getSeverityText() {
        return severity.name();
    }
}
