/**
 * Format a timestamp string to a locale date/time string.
 * Handles various formats:
 * - ISO 8601: "2025-11-19T12:34:56Z"
 * - Compact UTC: "20251119-123456" (YYYYMMDD-HHMMSS)
 * - Legacy: "2025-11-19-123456Z"
 * Falls back to "Invalid Date" if parsing fails.
 */
export function formatTimestamp(timestamp: string | undefined): string {
    if (!timestamp) {
        return "Invalid Date";
    }

    // Try parsing the timestamp directly (handles ISO 8601: 2025-11-19T12:34:56Z)
    let date = new Date(timestamp);

    // Handle compact UTC format: YYYYMMDD-HHMMSS (e.g., "20251119-123456")
    if (isNaN(date.getTime()) && /^\d{8}-\d{6}$/.test(timestamp)) {
        // Compact format: YYYYMMDD-HHMMSS -> YYYY-MM-DDTHH:MM:SSZ
        const normalized = timestamp.replace(
            /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/,
            "$1-$2-$3T$4:$5:$6Z"
        );
        date = new Date(normalized);
    }

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
 * Parse timestamp to Date object, returns null if invalid.
 * Handles various formats:
 * - ISO 8601 with fractional seconds: "2025-11-19T05:28:14.934050109Z"
 * - Compact UTC: "20251119-123456" (YYYYMMDD-HHMMSS)
 * - Legacy: "2025-11-19-123456Z"
 */
export function parseTimestamp(timestamp: string | undefined): Date | null {
    if (!timestamp) {
        return null;
    }

    // Try parsing the timestamp directly (handles most ISO 8601 formats including fractional seconds)
    let date = new Date(timestamp);

    // Handle compact UTC format: YYYYMMDD-HHMMSS (e.g., "20251119-123456")
    if (isNaN(date.getTime()) && /^\d{8}-\d{6}$/.test(timestamp)) {
        // Compact format: YYYYMMDD-HHMMSS -> YYYY-MM-DDTHH:MM:SSZ
        const normalized = timestamp.replace(
            /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/,
            "$1-$2-$3T$4:$5:$6Z"
        );
        date = new Date(normalized);
    }

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
