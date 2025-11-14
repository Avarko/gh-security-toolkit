package fi.evolver.secops.githubPages.model;

/**
 * Represents a Opengrep finding.
 */
public class OpengrepFinding {
    public final String ruleId;
    public final Severity severity;
    public final String cssClass; // Pre-computed CSS class
    public final String path;
    public final int line;
    public final String lineDisplay; // "—" if line < 1
    public final String message;

    public OpengrepFinding(
            String ruleId,
            Severity severity,
            String path,
            int line,
            String message) {
        this.ruleId = ruleId != null && !ruleId.isBlank() ? ruleId : "—";
        this.severity = severity;
        this.cssClass = severity.getCssClass();
        this.path = path != null && !path.isBlank() ? path : "—";
        this.line = line;
        this.lineDisplay = line > 0 ? String.valueOf(line) : "—";
        this.message = message != null && !message.isBlank() ? message : "—";
    }

    public String getSeverityText() {
        return severity.name();
    }
}
