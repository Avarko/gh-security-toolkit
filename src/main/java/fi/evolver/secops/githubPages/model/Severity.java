package fi.evolver.secops.githubPages.model;

import java.util.Locale;

/**
 * Unified severity enumeration for all security findings.
 * Maps various source formats (Trivy, Opengrep) to a consistent model.
 */
public enum Severity {
    CRITICAL(5, "severity-critical", "C"),
    HIGH(4, "severity-high", "H"),
    MEDIUM(3, "severity-medium", "M"),
    LOW(2, "severity-low", "L"),
    ERROR(4, "severity-error", "E"),
    WARNING(3, "severity-warn", "W"),
    INFO(2, "severity-info", "I"),
    UNKNOWN(0, "", "?");

    private final int rank;
    private final String cssClass;
    private final String shortCode;

    Severity(int rank, String cssClass, String shortCode) {
        this.rank = rank;
        this.cssClass = cssClass;
        this.shortCode = shortCode;
    }

    public int getRank() {
        return rank;
    }

    public String getCssClass() {
        return cssClass;
    }

    public String getShortCode() {
        return shortCode;
    }

    /**
     * Parse severity from string (case-insensitive, trimmed).
     *
     * @param value severity string from JSON
     * @return normalized Severity enum
     */
    public static Severity parse(String value) {
        if (value == null || value.isBlank()) {
            return UNKNOWN;
        }
        try {
            return valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return UNKNOWN;
        }
    }

    /**
     * Returns CSS class for short-code legends (e.g., "severity-c" for CRITICAL).
     */
    public String getLegendCssClass() {
        return switch (this) {
            case CRITICAL -> "severity-c";
            case HIGH, ERROR -> "severity-h";
            case MEDIUM, WARNING -> "severity-m";
            case LOW, INFO -> "severity-l";
            default -> "";
        };
    }
}
