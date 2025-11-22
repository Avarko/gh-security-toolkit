/**
 * Canonical types and schemas for test report history data.
 * Uses Zod for runtime validation to ensure data integrity.
 */

import { z } from 'zod';

// Maximum safe lengths for string inputs
const MAX_STRING_LENGTH = 1000;
const MAX_COMMIT_SHA_LENGTH = 40;
const MAX_BRANCH_LENGTH = 200;
const MAX_CHANNEL_LENGTH = 100;

// Timestamp validation: YYYYMMDD-HHMMSS format (e.g., "20251122-145232")
const timestampSchema = z.string()
    .max(MAX_STRING_LENGTH)
    .regex(/^\d{8}-\d{6}$/, "Invalid timestamp format (expected YYYYMMDD-HHMMSS)");

// Git commit SHA validation
const commitSchema = z.string()
    .max(MAX_COMMIT_SHA_LENGTH)
    .regex(/^[a-f0-9]{7,40}$/i, "Invalid git commit SHA")
    .optional()
    .default("");

// Git branch name validation
const branchSchema = z.string()
    .min(1)
    .max(MAX_BRANCH_LENGTH)
    .regex(/^[a-zA-Z0-9\/_\-\.]+$/, "Invalid branch name")
    .optional()
    .default("");

// Channel name validation
const channelSchema = z.string()
    .min(1)
    .max(MAX_CHANNEL_LENGTH)
    .regex(/^[a-zA-Z0-9\-_]+$/, "Invalid channel name");

// Metadata schema for branch, commit, repository
const metadataSchema = z.object({
    branch: branchSchema,
    commit: commitSchema,
    repository: z.string().max(MAX_STRING_LENGTH).optional().default("")
}).strict();

// Test report entry schema
export const testReportEntrySchema = z.object({
    timestamp: timestampSchema,
    channel: channelSchema,
    metadata: metadataSchema,
    hasJacoco: z.boolean().catch(false),
    hasSurefire: z.boolean().catch(false),
    dataPath: z.string().max(MAX_STRING_LENGTH).optional(),
}).strict();

// Test report history schema (top-level structure)
export const testReportHistorySchema = z.object({
    version: z.union([z.string(), z.number()]).transform(String),
    reports: z.array(testReportEntrySchema).max(10000),
}).strict();

// TypeScript types inferred from Zod schemas
export type TestReportEntry = z.infer<typeof testReportEntrySchema>;
export type TestReportHistory = z.infer<typeof testReportHistorySchema>;

// Validation result type for error handling
export type ValidationResult<T> =
    | { success: true; data: T }
    | { success: false; error: string; details?: unknown };
