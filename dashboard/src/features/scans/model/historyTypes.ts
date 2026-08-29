/**
 * Canonical types and schemas for scan history data.
 * Used across all scan-related features.
 *
 * Uses Zod for runtime validation to ensure data integrity
 * and protect against malformed or malicious input.
 */

import { z } from 'zod';
import { branchSchema, commitSchema, repositorySchema } from '../../../lib/gitRefSchemas';
import { channelSchema, timestampSchema } from '../../../lib/scanIdentifiers';

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

// Main scan metadata schema

// Metadata schema for branch, commit, repository
const metadataSchema = z.object({
    branch: branchSchema,
    commit: commitSchema,
    repository: repositorySchema,
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

// Validation result type for error handling
export type ValidationResult<T> =
    | { success: true; data: T }
    | { success: false; error: string; details?: unknown };
