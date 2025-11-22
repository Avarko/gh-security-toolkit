/**
 * Client API for fetching test report history data.
 *
 * Single-tenant mode: Data at /data/hist/test-report-history.json
 *
 * Includes comprehensive validation using Zod schemas.
 */

import {
    testReportHistorySchema,
    type TestReportHistory,
    type ValidationResult,
} from "../model/testReportTypes";

/**
 * Result type for test report history loading.
 */
export type TestReportsLoadResult = ValidationResult<TestReportHistory>;

/**
 * Fetches and validates test report history.
 *
 * Data is stored at /data/hist/test-report-history.json
 */
export async function fetchTestReports(): Promise<TestReportsLoadResult> {
    const url = "/data/hist/test-report-history.json";

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

        // Parse JSON
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

        // Validate with Zod schema
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
