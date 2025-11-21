/**
 * Generic fetch and validate utility.
 *
 * Provides a reusable pattern for fetching JSON data and validating
 * it against a Zod schema with comprehensive error handling.
 */

import type { ZodSchema, ZodError } from "zod";

/**
 * Generic validation result type.
 */
export type ValidationResult<T> =
    | { success: true; data: T }
    | { success: false; error: string; details?: unknown };

/**
 * Options for fetchAndValidate.
 */
export type FetchAndValidateOptions<T> = {
    /** URL to fetch data from */
    url: string;
    /** Zod schema to validate against */
    schema: ZodSchema<T>;
    /** Description of what's being fetched (for error messages) */
    dataDescription: string;
    /** Return this value on 404 instead of error */
    emptyOnNotFound?: T;
};

/**
 * Fetches JSON data from a URL and validates it against a Zod schema.
 *
 * Handles:
 * - HTTP errors
 * - JSON parse errors
 * - Zod validation errors
 * - Network errors
 *
 * @returns ValidationResult with either validated data or error details
 */
export async function fetchAndValidate<T>(
    options: FetchAndValidateOptions<T>
): Promise<ValidationResult<T>> {
    const { url, schema, dataDescription, emptyOnNotFound } = options;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            // Handle 404 specially if emptyOnNotFound is provided
            if (response.status === 404 && emptyOnNotFound) {
                return {
                    success: true,
                    data: emptyOnNotFound as T,
                };
            }
            return {
                success: false,
                error: `HTTP ${response.status}: Failed to load ${dataDescription} from ${url}`,
            };
        }

        // Parse JSON
        let jsonData: unknown;
        try {
            jsonData = await response.json();
        } catch (parseError) {
            return {
                success: false,
                error: `Invalid JSON format in ${dataDescription}`,
                details: parseError,
            };
        }

        // Validate with Zod schema
        const parseResult = schema.safeParse(jsonData);

        if (!parseResult.success) {
            const errorMessages = (parseResult.error as ZodError).issues
                .map((err) => `${err.path.join(".")}: ${err.message}`)
                .join("; ");

            return {
                success: false,
                error: `Invalid ${dataDescription}: ${errorMessages}`,
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
                    : `Unknown error occurred while fetching ${dataDescription}`,
            details: error,
        };
    }
}

/**
 * Builds a data URL based on tenant mode.
 *
 * @param basePath - Path relative to data root (e.g., "hist/scan-history.json")
 * @param tenantId - Tenant ID for multi-tenant mode (undefined for single-tenant)
 */
export function buildDataUrl(basePath: string, tenantId?: string): string {
    if (tenantId) {
        return `/data/${tenantId}/${basePath}`;
    }
    return `/data/${basePath}`;
}
