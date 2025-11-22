/**
 * Client API for fetching test report history data.
 *
 * Supports both single-tenant (/data) and multi-tenant (/data/<uuid>) modes
 * via the dataRoot parameter.
 */

import {
    testReportHistorySchema,
    type TestReportHistory,
    type ValidationResult,
} from "../model/testReportTypes";

export type TestReportsLoadResult = ValidationResult<TestReportHistory>;

/**
 * Fetches and validates test report history.
 *
 * @param dataRoot - Data root path (e.g., "/data" or "/data/<uuid>")
 */
export async function fetchTestReports(dataRoot: string): Promise<TestReportsLoadResult> {
    const url = `${dataRoot}/hist/test-report-history.json`;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            // 404 is not an error - just means no test reports yet
            if (response.status === 404) {
                return {
                    success: true,
                    data: { version: "1", reports: [] },
                };
            }
            return {
                success: false,
                error: `HTTP ${response.status}: Failed to load test report history from ${url}`,
            };
        }

        let jsonData: unknown;
        try {
            jsonData = await response.json();
        } catch (parseError) {
            return {
                success: false,
                error: "Invalid JSON format in test report history data",
                details: parseError,
            };
        }

        const parseResult = testReportHistorySchema.safeParse(jsonData);

        if (!parseResult.success) {
            const errorMessages = parseResult.error.issues
                .map((err) => `${err.path.join(".")}: ${err.message}`)
                .join("; ");

            return {
                success: false,
                error: `Invalid test report history data: ${errorMessages}`,
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
                    : "Unknown error occurred while fetching test report history",
            details: error,
        };
    }
}
