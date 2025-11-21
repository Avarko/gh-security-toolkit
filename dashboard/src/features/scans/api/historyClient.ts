/**
 * Client API for fetching scan history data.
 *
 * Provides separate functions for single-tenant and multi-tenant modes:
 * - fetchScanHistorySingleTenant(): Data at /data/hist/scan-history.json
 * - fetchScanHistoryMultiTenant(tenantId): Data at /data/<uuid>/hist/scan-history.json
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
 * Fetches and validates scan history data for SINGLE-TENANT mode.
 *
 * In single-tenant mode (GitHub Pages):
 * - Data is stored directly at /data/hist/scan-history.json
 * - No tenant resolution needed
 * - No UUID in path
 */
export async function fetchScanHistorySingleTenant(): Promise<ScanHistoryLoadResult> {
    const url = "/data/hist/scan-history.json";
    return fetchAndValidateScanHistory(url);
}

/**
 * Fetches and validates scan history data for MULTI-TENANT mode.
 *
 * In multi-tenant mode (S3/CDN):
 * - Data is stored at /data/<uuid>/hist/scan-history.json
 * - Tenant ID (UUID) is resolved from URL path via tenant config
 *
 * @param tenantId - The tenant's UUID (from multi-tenant config)
 */
export async function fetchScanHistoryMultiTenant(
    tenantId: string
): Promise<ScanHistoryLoadResult> {
    if (!tenantId) {
        return {
            success: false,
            error: "Tenant ID is required in multi-tenant mode",
        };
    }

    const url = `/data/${tenantId}/hist/scan-history.json`;
    return fetchAndValidateScanHistory(url);
}

/**
 * Internal function to fetch and validate scan history from a URL.
 */
async function fetchAndValidateScanHistory(
    url: string
): Promise<ScanHistoryLoadResult> {
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
