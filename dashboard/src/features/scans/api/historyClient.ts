/**
 * Client API for fetching scan history data.
 *
 * Supports both single-tenant (/data) and multi-tenant (/data/<uuid>) modes
 * via the dataRoot parameter.
 */

import {
    scanHistorySchema,
    type ScanHistory,
    type ValidationResult,
} from "../model/historyTypes";

export type ScanHistoryLoadResult = ValidationResult<ScanHistory>;

/**
 * Fetches and validates scan history data.
 *
 * @param dataRoot - Data root path (e.g., "/data" or "/data/<uuid>")
 */
export async function fetchScanHistory(dataRoot: string): Promise<ScanHistoryLoadResult> {
    const url = `${dataRoot}/hist/scan-history.json`;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            return {
                success: false,
                error: `HTTP ${response.status}: Failed to load scan history from ${url}`,
            };
        }

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
