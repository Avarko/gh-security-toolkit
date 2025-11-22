/**
 * Client API for fetching scan history data.
 *
 * Single-tenant mode: Data at /data/hist/scan-history.json
 *
 * Includes comprehensive validation using Zod schemas.
 */

import {
    scanHistorySchema,
    type ScanHistory,
    type ValidationResult,
} from "../model/historyTypes";

/**
 * Result type for scan history loading.
 * Either successful with validated data, or failed with error details.
 */
export type ScanHistoryLoadResult = ValidationResult<ScanHistory>;

/**
 * Fetches and validates scan history data.
 *
 * Data is stored at /data/hist/scan-history.json
 */
export async function fetchScanHistory(): Promise<ScanHistoryLoadResult> {
    const url = "/data/hist/scan-history.json";

    try {
        const response = await fetch(url);

        if (!response.ok) {
            return {
                success: false,
                error: `HTTP ${response.status}: Failed to load scan history from ${url}`,
            };
        }

        // Parse JSON
        let jsonData: unknown;
        try {
            jsonData = await response.json();
        } catch (parseError) {
            return {
                success: false,
                error: "Invalid JSON format in scan history data",
                details: parseError,
            };
        }

        // Validate with Zod schema
        const parseResult = scanHistorySchema.safeParse(jsonData);

        if (!parseResult.success) {
            const errorMessages = parseResult.error.issues
                .map((err) => `${err.path.join(".")}: ${err.message}`)
                .join("; ");

            return {
                success: false,
                error: `Invalid scan history data: ${errorMessages}`,
                details: parseResult.error,
            };
        }

        return {
            success: true,
            data: parseResult.data,
        };
    } catch (error) {
        return {
            success: false,
            error:
                error instanceof Error
                    ? error.message
                    : "Unknown error occurred while fetching scan history",
            details: error,
        };
    }
}
