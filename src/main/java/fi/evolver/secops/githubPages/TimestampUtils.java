package fi.evolver.secops.githubPages;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Utility class for timestamp parsing and conversion.
 * Supports both ISO 8601 and URL-friendly compact formats.
 */
public final class TimestampUtils {

    /**
     * URL-friendly compact format: YYYYMMDD-HHMMSS or YYYY-MM-DD-HHMMSSZ
     * Examples:
     * - "20251119-175624"
     * - "2025-11-21-055532Z"
     */
    private static final Pattern URL_FRIENDLY_PATTERN = Pattern.compile(
            "^(\\d{4})-?(\\d{2})-?(\\d{2})-(\\d{2})(\\d{2})(\\d{2})Z?$");

    private static final DateTimeFormatter COMPACT_FORMATTER = DateTimeFormatter
            .ofPattern("yyyyMMdd-HHmmss")
            .withZone(ZoneOffset.UTC);

    private TimestampUtils() {
        // Utility class - no instantiation
    }

    /**
     * Converts a timestamp to compact URL-safe format in UTC.
     *
     * Supported input formats:
     * - ISO 8601: "2025-11-19T17:56:24Z", "2025-11-19T17:56:24+02:00"
     * - URL-friendly: "2025-11-21-055532Z", "20251119-175624"
     *
     * Output format: YYYYMMDD-HHMMSS (always UTC)
     *
     * This ensures:
     * 1. No URL encoding needed (no colons or special characters)
     * 2. Timezone-independent (always UTC to avoid collisions)
     * 3. Chronologically sortable
     * 4. Human-readable
     *
     * @param timestamp Timestamp in ISO 8601 or URL-friendly format
     * @return Compact timestamp in format YYYYMMDD-HHMMSS (UTC)
     */
    public static String toCompactTimestamp(String timestamp) {
        if (timestamp == null || timestamp.isEmpty()) {
            throw new IllegalArgumentException("Timestamp cannot be null or empty");
        }

        // Try URL-friendly format first (most common in our use case)
        Matcher urlMatcher = URL_FRIENDLY_PATTERN.matcher(timestamp);
        if (urlMatcher.matches()) {
            String year = urlMatcher.group(1);
            String month = urlMatcher.group(2);
            String day = urlMatcher.group(3);
            String hour = urlMatcher.group(4);
            String minute = urlMatcher.group(5);
            String second = urlMatcher.group(6);
            return year + month + day + "-" + hour + minute + second;
        }

        // Try ISO 8601 format
        try {
            Instant instant = Instant.parse(timestamp);
            return COMPACT_FORMATTER.format(instant);
        } catch (DateTimeParseException e) {
            // Fall back to sanitized original timestamp
            System.err.println("⚠️  Warning: Failed to parse timestamp '" + timestamp + "', using sanitized version");
            return timestamp.replaceAll("[^0-9A-Za-z-]", "");
        }
    }

    /**
     * Checks if the given timestamp is already in compact format.
     *
     * @param timestamp Timestamp string to check
     * @return true if already in compact format (YYYYMMDD-HHMMSS)
     */
    public static boolean isCompactFormat(String timestamp) {
        if (timestamp == null) {
            return false;
        }
        return timestamp.matches("^\\d{8}-\\d{6}$");
    }

    /**
     * Converts compact timestamp back to ISO 8601 format for display.
     *
     * @param compactTimestamp Timestamp in YYYYMMDD-HHMMSS format
     * @return ISO 8601 formatted timestamp
     */
    public static String toIsoTimestamp(String compactTimestamp) {
        if (compactTimestamp == null || !isCompactFormat(compactTimestamp)) {
            return compactTimestamp;
        }

        // Parse YYYYMMDD-HHMMSS
        String year = compactTimestamp.substring(0, 4);
        String month = compactTimestamp.substring(4, 6);
        String day = compactTimestamp.substring(6, 8);
        String hour = compactTimestamp.substring(9, 11);
        String minute = compactTimestamp.substring(11, 13);
        String second = compactTimestamp.substring(13, 15);

        return year + "-" + month + "-" + day + "T" + hour + ":" + minute + ":" + second + "Z";
    }
}
