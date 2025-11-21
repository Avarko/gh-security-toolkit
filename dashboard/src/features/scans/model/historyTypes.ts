/**
 * Canonical types and schemas for scan history data.
 * Used across all scan-related features.
 *
 * Uses Zod for runtime validation to ensure data integrity
 * and protect against malformed or malicious input.
 */

import { z } from 'zod';

// Maximum safe lengths for string inputs to prevent DoS attacks
const MAX_STRING_LENGTH = 1000;
const MAX_COMMIT_SHA_LENGTH = 40;
const MAX_BRANCH_LENGTH = 200;
const MAX_CHANNEL_LENGTH = 100;

// Validate vulnerability count is a non-negative integer
const vulnerabilityCountSchema = z.number()
    .int()
    .nonnegative()
    .finite()
    .safe()
    .catch(0); // Default to 0 if invalid

// Record of severity levels to vulnerability counts
const vulnerabilityRecordSchema = z.record(
    z.string().max(50), // severity level (CRITICAL, HIGH, etc.)
    vulnerabilityCountSchema
).catch({});

// Trivy results schema
const trivyResultsSchema = z.object({
    totalVulnerabilities: vulnerabilityRecordSchema,
}).strict().optional().catch(undefined);

// Semgrep results schema
const semgrepResultsSchema = z.object({
    totalErrors: vulnerabilityCountSchema,
    totalWarnings: vulnerabilityCountSchema,
    totalInfos: vulnerabilityCountSchema,
}).strict().optional().catch(undefined);

// Timestamp validation
// Supports multiple formats:
// - ISO 8601: 2025-10-28T02:00:00Z
// - Compact UTC: 20251028-020000 (YYYYMMDD-HHMMSS)
// - Legacy: 2025-10-28-020000Z
const timestampSchema = z.string()
    .max(MAX_STRING_LENGTH)
    .refine(
        (val) => {
            // Try standard ISO 8601 first
            if (!isNaN(Date.parse(val))) {
                return true;
            }
            // Try compact UTC format: YYYYMMDD-HHMMSS
            const compactFormat = /^\d{8}-\d{6}$/;
            if (compactFormat.test(val)) {
                return true;
            }
            // Try legacy format: YYYY-MM-DD-HHMMSSZ
            const legacyFormat = /^\d{4}-\d{2}-\d{2}-\d{6}Z$/;
            return legacyFormat.test(val);
        },
        { message: "Invalid timestamp format" }
    );

// Git commit SHA validation (7-40 hex chars for SHA-1, optional with default)
const commitSchema = z.string()
    .max(MAX_COMMIT_SHA_LENGTH)
    .regex(/^[a-f0-9]{7,40}$/i, "Invalid git commit SHA")
    .optional()
    .default("");

// Git branch name validation (optional with default)
const branchSchema = z.string()
    .min(1)
    .max(MAX_BRANCH_LENGTH)
    .regex(/^[a-zA-Z0-9\/_\-\.]+$/, "Invalid branch name")
    .optional()
    .default("");

// Channel name validation (alphanumeric, dash, underscore)
const channelSchema = z.string()
    .min(1)
    .max(MAX_CHANNEL_LENGTH)
    .regex(/^[a-zA-Z0-9\-_]+$/, "Invalid channel name");

// Main scan metadata schema

// Metadata schema for branch, commit, repository
const metadataSchema = z.object({
    branch: branchSchema,
    commit: commitSchema,
    repository: z.string().max(MAX_STRING_LENGTH).optional().default("")
}).strict();

export const scanMetadataSchema = z.object({
    timestamp: timestampSchema,
    channel: channelSchema,
    metadata: metadataSchema,
    trivyFsResults: trivyResultsSchema,
    trivyImageResults: trivyResultsSchema,
    semgrepResults: semgrepResultsSchema,
}).strict();

// Scan history schema (top-level structure)
export const scanHistorySchema = z.object({
    version: z.union([z.string(), z.number()]).transform(String), // Accept both string and number
    scans: z.array(scanMetadataSchema).max(10000), // Limit array size
}).strict();

// TypeScript types inferred from Zod schemas
export type ScanMetadata = z.infer<typeof scanMetadataSchema>;
export type ScanHistory = z.infer<typeof scanHistorySchema>;
