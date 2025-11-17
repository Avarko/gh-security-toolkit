/**
 * Client API for fetching scan history data.
 * Includes comprehensive validation using Zod schemas.
 */

import {
    scanHistorySchema,
    type ScanHistory,
    type ValidationResult,
} from "../model/historyTypes";
import { getDataRoot } from "../../../lib/dataPath";
import { MissingTenantParamsError } from "../../../errors/MissingTenantParamsError";

/**
 * Result type for scan history loading.
 * Either successful with validated data, or failed with error details.
 */
export type ScanHistoryLoadResult = ValidationResult<ScanHistory>;

export type HistoryContext = {
    orgSlug?: string;
    appSlug?: string;
    repoSlug?: string;
};

/**
 * Fetches and validates scan history data from the server,
 * scoped to a specific tenant (org/app[/repo]).
 *
 * Security principle:
 * - getDataRoot throws MissingTenantParamsError if org/app is missing.
 * - This error is NOT encapsulated as a validation error but allowed to propagate,
 *   so that the router's error boundary can handle it as a configuration error.
 *
 * Other errors (network, HTTP status, JSON parse, Zod) are returned
 * as a ScanHistoryLoadResult object (success: false).
 */
export async function fetchScanHistory(
    ctx: HistoryContext
): Promise<ScanHistoryLoadResult> {
    // This may throw MissingTenantParamsError → let it bubble up
    const base = getDataRoot(ctx);
    const url = `${base}/hist/scan-history.json`;

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
        // Configuration error: let MissingTenantParamsError bubble up
        if (error instanceof MissingTenantParamsError) {
            throw error;
        }

        // Other unexpected errors are encapsulated normally
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
