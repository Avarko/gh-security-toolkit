/**
 * Client API for fetching scan history data.
 *
 * Provides separate functions for single-tenant and multi-tenant modes:
 * - fetchScanHistorySingleTenant(): Data at /data/hist/scan-history.json
 * - fetchScanHistoryMultiTenant(tenantId): Data at /data/<uuid>/hist/scan-history.json
 */

import { fetchAndValidate, buildDataUrl, type ValidationResult } from "../../../lib/fetchAndValidate";
import { scanHistorySchema, type ScanHistory } from "../model/historyTypes";

/**
 * Result type for scan history loading.
 */
export type ScanHistoryLoadResult = ValidationResult<ScanHistory>;

/**
 * Fetches and validates scan history data for SINGLE-TENANT mode.
 * Data is stored at /data/hist/scan-history.json
 */
export async function fetchScanHistorySingleTenant(): Promise<ScanHistoryLoadResult> {
    return fetchAndValidate({
        url: buildDataUrl("hist/scan-history.json"),
        schema: scanHistorySchema,
        dataDescription: "scan history data",
    });
}

/**
 * Fetches and validates scan history data for MULTI-TENANT mode.
 * Data is stored at /data/<uuid>/hist/scan-history.json
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

    return fetchAndValidate({
        url: buildDataUrl("hist/scan-history.json", tenantId),
        schema: scanHistorySchema,
        dataDescription: "scan history data",
    });
}
