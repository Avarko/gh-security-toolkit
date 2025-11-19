/**
 * Format a timestamp string to a locale date/time string.
 * Handles various ISO 8601 formats and falls back to "Invalid Date" if parsing fails.
 */
export function formatTimestamp(timestamp: string | undefined): string {
    if (!timestamp) {
        return "Invalid Date";
    }

    // Try parsing the timestamp
    const date = new Date(timestamp);

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
 */
export function parseTimestamp(timestamp: string | undefined): Date | null {
    if (!timestamp) {
        return null;
    }

    const date = new Date(timestamp);
    return isNaN(date.getTime()) ? null : date;
}
