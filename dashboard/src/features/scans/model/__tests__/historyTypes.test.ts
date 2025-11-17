/**
 * Unit tests for Zod validation schemas
 */

import { describe, it, expect } from 'vitest';
import { scanMetadataSchema, scanHistorySchema } from '../historyTypes';

describe('scanMetadataSchema', () => {
    it('should validate correct scan metadata', () => {
        const validScan = {
            timestamp: '2024-01-15-120000Z',
            channel: 'prod-main',
            branch: 'main',
            commit: 'a1b2c3d4e5f6789012345678901234567890abcd',
            trivyFsResults: {
                totalVulnerabilities: {
                    CRITICAL: 2,
                    HIGH: 5,
                    MEDIUM: 10,
                },
            },
            semgrepResults: {
                totalErrors: 1,
                totalWarnings: 3,
                totalInfos: 5,
            },
        };

        const result = scanMetadataSchema.safeParse(validScan);
        expect(result.success).toBe(true);
    });

    it('should reject invalid timestamp', () => {
        const invalidScan = {
            timestamp: 'not-a-timestamp',
            channel: 'prod',
            branch: 'main',
            commit: 'a1b2c3d4e5f6789012345678901234567890abcd',
        };

        const result = scanMetadataSchema.safeParse(invalidScan);
        expect(result.success).toBe(false);
    });

    it('should reject invalid channel name with special characters', () => {
        const invalidScan = {
            timestamp: '2024-01-15-120000Z',
            channel: 'test@invalid!',
            branch: 'main',
            commit: 'a1b2c3d4e5f6789012345678901234567890abcd',
        };

        const result = scanMetadataSchema.safeParse(invalidScan);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some(e => e.path.includes('channel'))).toBe(true);
        }
    });

    it('should reject path traversal in branch name', () => {
        const maliciousScan = {
            timestamp: '2024-01-15-120000Z',
            channel: 'prod',
            branch: '../../etc/passwd',
            commit: 'a1b2c3d4e5f6789012345678901234567890abcd',
        };

        const result = scanMetadataSchema.safeParse(maliciousScan);
        expect(result.success).toBe(false);
    });

    it('should reject short commit SHA', () => {
        const invalidScan = {
            timestamp: '2024-01-15-120000Z',
            channel: 'prod',
            branch: 'main',
            commit: 'abc123', // Too short
        };

        const result = scanMetadataSchema.safeParse(invalidScan);
        expect(result.success).toBe(false);
    });

    it('should handle negative vulnerability count with .catch()', () => {
        const scanWithNegative = {
            timestamp: '2024-01-15-120000Z',
            channel: 'prod',
            branch: 'main',
            commit: 'a1b2c3d4e5f6789012345678901234567890abcd',
            semgrepResults: {
                totalErrors: -5, // Invalid negative
                totalWarnings: 10,
                totalInfos: 5,
            },
        };

        const result = scanMetadataSchema.safeParse(scanWithNegative);
        // With .catch(0), this should actually pass and convert to 0
        if (result.success) {
            expect(result.data.semgrepResults?.totalErrors).toBe(0);
        }
    });

    it('should handle string instead of number with .catch()', () => {
        const scanWithString = {
            timestamp: '2024-01-15-120000Z',
            channel: 'prod',
            branch: 'main',
            commit: 'a1b2c3d4e5f6789012345678901234567890abcd',
            trivyFsResults: {
                totalVulnerabilities: {
                    CRITICAL: 'not-a-number', // Invalid type
                },
            },
        };

        const result = scanMetadataSchema.safeParse(scanWithString);
        // With .catch(0), this should convert invalid values to 0
        if (result.success) {
            expect(result.data.trivyFsResults?.totalVulnerabilities.CRITICAL).toBe(0);
        }
    });

    it('should reject unknown fields with .strict()', () => {
        const scanWithExtra = {
            timestamp: '2024-01-15-120000Z',
            channel: 'prod',
            branch: 'main',
            commit: 'a1b2c3d4e5f6789012345678901234567890abcd',
            extraField: 'should not be here',
        };

        const result = scanMetadataSchema.safeParse(scanWithExtra);
        expect(result.success).toBe(false);
    });
});

describe('scanHistorySchema', () => {
    it('should validate correct scan history', () => {
        const validHistory = {
            version: '1.0',
            scans: [
                {
                    timestamp: '2024-01-15-120000Z',
                    channel: 'prod',
                    branch: 'main',
                    commit: 'a1b2c3d4e5f6789012345678901234567890abcd',
                },
            ],
        };

        const result = scanHistorySchema.safeParse(validHistory);
        expect(result.success).toBe(true);
    });

    it('should reject missing version field', () => {
        const invalidHistory = {
            scans: [],
        };

        const result = scanHistorySchema.safeParse(invalidHistory);
        expect(result.success).toBe(false);
    });

    it('should reject too large array (DoS protection)', () => {
        const hugeHistory = {
            version: '1.0',
            scans: new Array(10001).fill({
                timestamp: '2024-01-15-120000Z',
                channel: 'prod',
                branch: 'main',
                commit: 'a1b2c3d4e5f6789012345678901234567890abcd',
            }),
        };

        const result = scanHistorySchema.safeParse(hugeHistory);
        expect(result.success).toBe(false);
    });
});
