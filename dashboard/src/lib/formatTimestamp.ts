/**
 * Format a timestamp string to a locale date/time string.
 * Handles various ISO 8601 formats and legacy formats.
 * Falls back to "Invalid Date" if parsing fails.
 */
export function formatTimestamp(timestamp: string | undefined): string {
    if (!timestamp) {
        return "Invalid Date";
    }

    // Try parsing the timestamp directly (handles ISO 8601: 2025-11-19T12:34:56Z)
    let date = new Date(timestamp);

    // If that fails, try to handle legacy format: 2025-11-19-123456Z
    if (isNaN(date.getTime()) && /^\d{4}-\d{2}-\d{2}-\d{6}Z$/.test(timestamp)) {
        // Legacy format: YYYY-MM-DD-HHMMSSZ -> YYYY-MM-DDTHH:MM:SSZ
        const normalized = timestamp.replace(
            /^(\d{4}-\d{2}-\d{2})-(\d{2})(\d{2})(\d{2})Z$/,
            "$1T$2:$3:$4Z"
        );
        date = new Date(normalized);
    }

    // Check if the date is valid
    if (isNaN(date.getTime())) {
        // Log for debugging in development
        if (import.meta.env.DEV) {
            console.warn(`Invalid timestamp format: "${timestamp}"`);
        }
        return "Invalid Date";
    }

    return date.toLocaleString();
}

/**
 * Parse timestamp to Date object, returns null if invalid
 * Handles ISO 8601 formats with or without fractional seconds (e.g., 2025-11-19T05:28:14.934050109Z)
 */
export function parseTimestamp(timestamp: string | undefined): Date | null {
    if (!timestamp) {
        return null;
    }

    // Try parsing the timestamp directly (handles most ISO 8601 formats including fractional seconds)
    let date = new Date(timestamp);

    // If that fails, try to handle legacy format: 2025-11-19-123456Z
    if (isNaN(date.getTime()) && /^\d{4}-\d{2}-\d{2}-\d{6}Z$/.test(timestamp)) {
        // Legacy format: YYYY-MM-DD-HHMMSSZ -> YYYY-MM-DDTHH:MM:SSZ
        const normalized = timestamp.replace(
            /^(\d{4}-\d{2}-\d{2})-(\d{2})(\d{2})(\d{2})Z$/,
            "$1T$2:$3:$4Z"
        );
        date = new Date(normalized);
    }

    return isNaN(date.getTime()) ? null : date;
}
