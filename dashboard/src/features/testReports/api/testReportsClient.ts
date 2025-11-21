/**
 * Client API for fetching test report history data.
 * Includes comprehensive validation using Zod schemas.
 */

import {
    testReportHistorySchema,
    type TestReportHistory,
    type ValidationResult,
} from "../model/testReportTypes";
import { getDataRoot } from "../../../lib/dataPath";
import { MissingTenantParamsError } from "../../../errors/MissingTenantParamsError";
import type { TenantRegistry } from "../../../lib/tenantRegistry";

/**
 * Result type for test report history loading.
 */
export type TestReportHistoryLoadResult = ValidationResult<TestReportHistory>;

export type TestReportContext = {
    githubOrg: string;
    githubRepo: string;
    registry: TenantRegistry;
};

/**
 * Fetches and validates test report history data from the server,
 * scoped to a specific tenant (identified by GitHub org/repo).
 *
 * @throws {MissingTenantParamsError} if org/repo not found in registry
 */
export async function fetchTestReportHistory(
    ctx: TestReportContext
): Promise<TestReportHistoryLoadResult> {
    // This may throw MissingTenantParamsError -> let it bubble up
    const base = getDataRoot(ctx);
    const url = `${base}/hist/test-report-history.json`;

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
                    : "Unknown error occurred while fetching test report history",
            details: error,
        };
    }
}
