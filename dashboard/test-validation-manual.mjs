#!/usr/bin/env node

/**
 * Manual validation tests
 * Run with: node test-validation-manual.mjs
 */

import { scanMetadataSchema, scanHistorySchema } from './app/features/scans/model/historyTypes.ts';

console.log('🧪 Testing Zod Validation Schemas\n');

// Test 1: Valid scan metadata
console.log('Test 1: Valid scan metadata');
const validScan = {
    timestamp: '2024-01-15-120000Z',
    channel: 'prod-main',
    branch: 'main',
    commit: 'a1b2c3d4e5f6789012345678901234567890abcd',
    metadata: {
        branch: 'main',
        commit: 'a1b2c3d4e5f6789012345678901234567890abcd',
        repository: 'owner/repo',
    },
    trivyFsResults: { totalVulnerabilities: { CRITICAL: 2, HIGH: 5 } },
};
const result1 = scanMetadataSchema.safeParse(validScan);
console.log(result1.success ? '✅ PASS' : '❌ FAIL');
if (!result1.success) {
    console.log('Errors:', result1.error.issues);
}
console.log();

// Test 2: Invalid timestamp
console.log('Test 2: Invalid timestamp');
const invalidTimestamp = {
    timestamp: 'not-a-timestamp',
    channel: 'prod',
    metadata: {
        branch: 'main',
        commit: 'a1b2c3d4e5f6789012345678901234567890abcd',
    },
};
const result2 = scanMetadataSchema.safeParse(invalidTimestamp);
console.log(!result2.success ? '✅ PASS (correctly rejected)' : '❌ FAIL (should reject)');
if (!result2.success) {
    console.log('Expected errors:', result2.error.issues.map(e => `${e.path.join('.')}: ${e.message}`));
}
console.log();

// Test 3: Invalid channel name (special characters)
console.log('Test 3: Invalid channel with special characters');
const invalidChannel = {
    timestamp: '2024-01-15-120000Z',
    channel: 'test@invalid!',
    metadata: {
        branch: 'main',
        commit: 'a1b2c3d4e5f6789012345678901234567890abcd',
    },
};
const result3 = scanMetadataSchema.safeParse(invalidChannel);
console.log(!result3.success ? '✅ PASS (correctly rejected)' : '❌ FAIL (should reject)');
if (!result3.success) {
    console.log('Expected errors:', result3.error.issues.map(e => `${e.path.join('.')}: ${e.message}`));
}
console.log();

// Test 4: Path traversal attempt in branch
console.log('Test 4: Path traversal in branch name (security test)');
const pathTraversal = {
    timestamp: '2024-01-15-120000Z',
    channel: 'prod',
    metadata: {
        branch: '../../etc/passwd',
        commit: 'a1b2c3d4e5f6789012345678901234567890abcd',
    },
};
const result4 = scanMetadataSchema.safeParse(pathTraversal);
console.log(!result4.success ? '✅ PASS (correctly rejected)' : '❌ FAIL (security issue!)');
if (!result4.success) {
    console.log('Expected errors:', result4.error.issues.map(e => `${e.path.join('.')}: ${e.message}`));
}
console.log();

// Test 5: Short commit SHA
console.log('Test 5: Short commit SHA');
const shortCommit = {
    timestamp: '2024-01-15-120000Z',
    channel: 'prod',
    metadata: {
        branch: 'main',
        commit: 'abc123',
    },
};
const result5 = scanMetadataSchema.safeParse(shortCommit);
console.log(!result5.success ? '✅ PASS (correctly rejected)' : '❌ FAIL (should reject)');
if (!result5.success) {
    console.log('Expected errors:', result5.error.issues.map(e => `${e.path.join('.')}: ${e.message}`));
}
console.log();

// Test 6: Negative vulnerability count (should be caught by .catch())
console.log('Test 6: Negative vulnerability count');
const negativeCound = {
    timestamp: '2024-01-15-120000Z',
    channel: 'prod',
    metadata: {
        branch: 'main',
        commit: 'a1b2c3d4e5f6789012345678901234567890abcd',
    },
    semgrepResults: {
        totalErrors: -5,
        totalWarnings: 10,
        totalInfos: 5,
    },
};
const result6 = scanMetadataSchema.safeParse(negativeCound);
console.log(result6.success ? '✅ PASS (converted to safe value)' : '❌ FAIL');
if (result6.success) {
    console.log('totalErrors converted to:', result6.data.semgrepResults?.totalErrors);
}
console.log();

// Test 7: Complete scan history
console.log('Test 7: Valid scan history');
const validHistory = {
    version: '1.0',
    scans: [validScan],
};
const result7 = scanHistorySchema.safeParse(validHistory);
console.log(result7.success ? '✅ PASS' : '❌ FAIL');
console.log();

console.log('✨ Testing complete!\n');
