/**
 * Client API for fetching test report history data.
 *
 * Provides separate functions for single-tenant and multi-tenant modes:
 * - fetchTestReportsSingleTenant(): Data at /data/hist/test-report-history.json
 * - fetchTestReportsMultiTenant(tenantId): Data at /data/<uuid>/hist/test-report-history.json
 */

import { fetchAndValidate, buildDataUrl, type ValidationResult } from "../../../lib/fetchAndValidate";
import { testReportHistorySchema, type TestReportHistory } from "../model/testReportTypes";

/**
 * Result type for test report history loading.
 */
export type TestReportsLoadResult = ValidationResult<TestReportHistory>;

// Empty result for 404 responses (no test reports yet)
const EMPTY_RESULT: TestReportHistory = { version: "1", reports: [] };

/**
 * Fetches and validates test report history for SINGLE-TENANT mode.
 * Data is stored at /data/hist/test-report-history.json
 */
export async function fetchTestReportsSingleTenant(): Promise<TestReportsLoadResult> {
    return fetchAndValidate({
        url: buildDataUrl("hist/test-report-history.json"),
        schema: testReportHistorySchema,
        dataDescription: "test report history data",
        emptyOnNotFound: EMPTY_RESULT,
    });
}

/**
 * Fetches and validates test report history for MULTI-TENANT mode.
 * Data is stored at /data/<uuid>/hist/test-report-history.json
 *
 * @param tenantId - The tenant's UUID (from multi-tenant config)
 */
export async function fetchTestReportsMultiTenant(
    tenantId: string
): Promise<TestReportsLoadResult> {
    if (!tenantId) {
        return {
            success: false,
            error: "Tenant ID is required in multi-tenant mode",
        };
    }

    return fetchAndValidate({
        url: buildDataUrl("hist/test-report-history.json", tenantId),
        schema: testReportHistorySchema,
        dataDescription: "test report history data",
        emptyOnNotFound: EMPTY_RESULT,
    });
}
