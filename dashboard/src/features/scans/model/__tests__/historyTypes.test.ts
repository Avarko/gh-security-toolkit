/**
 * Unit tests for Zod validation schemas
 */

import { describe, it, expect } from 'vitest';
import { scanMetadataSchema, scanHistorySchema } from '../historyTypes';

describe('scanMetadataSchema', () => {
    it('should validate correct scan metadata', () => {
        const validScan = {
            timestamp: '20240115-120000',
            channel: 'prod-main',
            metadata: {
                branch: 'main',
                commit: 'a1b2c3d4e5f6789012345678901234567890abcd',
                repository: 'owner/repo',
            },
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

    it('should accept legacy YYYY-MM-DD-HHMMSSZ timestamps', () => {
        // Published history retains every scan, so entries written before the
        // switch to compact timestamps are still in the live file. Rejecting
        // them fails the whole document and the page renders no data.
        const legacyScan = {
            timestamp: '2025-11-16-020000Z',
            channel: 'prod-main',
            metadata: {
                branch: 'main',
                commit: 'a1b2c3d4e5f6789012345678901234567890abcd',
                repository: 'owner/repo',
            },
        };

        const result = scanMetadataSchema.safeParse(legacyScan);
        expect(result.success).toBe(true);
    });

    it('should reject invalid timestamp', () => {
        const invalidScan = {
            timestamp: 'not-a-timestamp',
            channel: 'prod',
            metadata: {
                branch: 'main',
                commit: 'a1b2c3d4e5f6789012345678901234567890abcd',
            },
        };

        const result = scanMetadataSchema.safeParse(invalidScan);
        expect(result.success).toBe(false);
    });

    it('should reject invalid channel name with special characters', () => {
        const invalidScan = {
            timestamp: '20240115-120000',
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

    // Branch and repository are interpolated into
    // https://github.com/<repository>/tree/<branch> and rendered as an href by
    // ReportFooter and both ChannelTables. A traversal that survives validation
    // produces a link whose text reads "main" and whose target, after the
    // browser normalises the path, is a different repository entirely.
    //
    // The original version of this test put branch and commit at the top level
    // instead of inside metadata, so .strict() rejected it on the unrecognised
    // keys and the traversal itself was never exercised -- it passed while the
    // schema accepted "../../etc/passwd" happily.
    it.each([
        ['parent segments', '../../etc/passwd'],
        ['embedded traversal', 'feature/../../evil'],
        ['leading slash', '/etc/passwd'],
        ['doubled separator', 'feature//evil'],
        ['reflog syntax', 'main@{upstream}'],
    ])('should not let %s through as a branch name', (_label, branch) => {
        const maliciousScan = {
            timestamp: '20240115-120000',
            channel: 'prod',
            metadata: {
                branch,
                commit: 'a1b2c3d4e5f6789012345678901234567890abcd',
                repository: 'owner/repo',
            },
        };

        const result = scanMetadataSchema.safeParse(maliciousScan);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.metadata.branch).toBe('');
        }
    });

    it.each([
        ['traversal', '../../../evil/repo'],
        ['absolute path', '/evil/repo'],
        ['extra path segment', 'owner/repo/tree/evil'],
        ['no owner', 'repo'],
        ['dot segment', 'owner/..'],
    ])('should not let %s through as a repository', (_label, repository) => {
        const maliciousScan = {
            timestamp: '20240115-120000',
            channel: 'prod',
            metadata: {
                branch: 'main',
                commit: 'a1b2c3d4e5f6789012345678901234567890abcd',
                repository,
            },
        };

        const result = scanMetadataSchema.safeParse(maliciousScan);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.metadata.repository).toBe('');
        }
    });

    it.each([
        'main',
        'feature/JIRA-123_some.thing',
        'release/1.2.3',
        'dependabot/npm_and_yarn/dashboard/npm_and_yarn-e7552e82bb',
    ])('should accept the real branch name %s', (branch) => {
        const scan = {
            timestamp: '20240115-120000',
            channel: 'prod',
            metadata: {
                branch,
                commit: 'a1b2c3d4e5f6789012345678901234567890abcd',
                repository: 'Avarko/gh-security-toolkit',
            },
        };

        const result = scanMetadataSchema.safeParse(scan);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.metadata.branch).toBe(branch);
        }
    });

    it('should drop a short commit SHA rather than fail the document', () => {
        const scanWithShortCommit = {
            timestamp: '20240115-120000',
            channel: 'prod',
            metadata: {
                branch: 'main',
                commit: 'abc', // Too short - invalid
                repository: 'owner/repo',
            },
        };

        // One malformed field must not cost the reader the whole history: the
        // value is dropped and the component renders no commit link for it.
        const result = scanMetadataSchema.safeParse(scanWithShortCommit);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.metadata.commit).toBe('');
        }
    });

    it('should handle negative vulnerability count with .catch()', () => {
        const scanWithNegative = {
            timestamp: '20240115-120000',
            channel: 'prod',
            metadata: {
                branch: 'main',
                commit: 'a1b2c3d4e5f6789012345678901234567890abcd',
            },
            semgrepResults: {
                totalErrors: -5, // Invalid negative
                totalWarnings: 10,
                totalInfos: 5,
            },
        };

        const result = scanMetadataSchema.safeParse(scanWithNegative);
        // With .catch(0), this should actually pass and convert to 0
        expect(result.success).toBe(true);
    });

    it('should handle string instead of number with .catch()', () => {
        const scanWithString = {
            timestamp: '20240115-120000',
            channel: 'prod',
            metadata: {
                branch: 'main',
                commit: 'a1b2c3d4e5f6789012345678901234567890abcd',
            },
            trivyFsResults: {
                totalVulnerabilities: {
                    CRITICAL: 'not-a-number',
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
            timestamp: '20240115-120000',
            channel: 'prod',
            metadata: {
                branch: 'main',
                commit: 'a1b2c3d4e5f6789012345678901234567890abcd',
            },
            extraField: 123,
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
                        timestamp: '20240115-120000',
                        channel: 'prod',
                        metadata: {
                            branch: 'main',
                            commit: 'a1b2c3d4e5f6789012345678901234567890abcd',
                            repository: 'owner/repo',
                        },
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
                    timestamp: '20240115-120000',
                    channel: 'prod',
                    metadata: {
                        branch: 'main',
                        commit: 'a1b2c3d4e5f6789012345678901234567890abcd',
                    },
                }),
            };

            const result = scanHistorySchema.safeParse(hugeHistory);
            expect(result.success).toBe(false);
        });
});