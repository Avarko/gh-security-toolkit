/**
 * Client API for fetching scan history data.
 * Includes comprehensive validation using Zod schemas.
 */

import { scanHistorySchema, type ScanHistory, type ValidationResult } from "../model/historyTypes";
import { ZodError } from "zod";

/**
 * Fetches and validates scan history data from the server.
 * 
 * @returns ValidationResult with either validated data or error details
 * @throws Never throws - returns validation errors in result object
 */
export async function fetchScanHistory(): Promise<ValidationResult<ScanHistory>> {
    try {
        const response = await fetch("/data/hist/scan-history.json");
        
        if (!response.ok) {
            return {
                success: false,
                error: `HTTP ${response.status}: Failed to load scan history`,
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
            // Extract human-readable error messages
            const errorMessages = parseResult.error.issues
                .map((err) => `${err.path.join('.')}: ${err.message}`)
                .join('; ');
            
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
        // Catch any unexpected errors (network issues, etc.)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error occurred",
            details: error,
        };
    }
}
