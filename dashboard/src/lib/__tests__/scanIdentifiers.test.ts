import { describe, it, expect } from 'vitest';
import { parseScanAddress } from '../scanIdentifiers';

describe('parseScanAddress', () => {
    it('accepts what the publisher actually writes', () => {
        expect(parseScanAddress('prod-main', '20251122-145232')).toEqual({
            channel: 'prod-main',
            timestamp: '20251122-145232',
        });
    });

    it('accepts legacy timestamps, which published history still contains', () => {
        expect(parseScanAddress('nightly', '2025-11-16-020000Z')).not.toBeNull();
    });

    // The pair is interpolated into the URL the run detail page fetches, so a
    // traversal that survives validation redirects the request -- across
    // tenants where a deployment shares one origin.
    it.each([
        ['parent segment', '../../../other-tenant'],
        ['encoded parent segment', '..%2F..%2Fother-tenant'],
        ['absolute path', '/etc/passwd'],
        ['embedded slash', 'prod/../staging'],
        ['query string', 'prod?x=1'],
        ['empty', ''],
    ])('rejects %s as a channel', (_label, channel) => {
        expect(parseScanAddress(channel, '20251122-145232')).toBeNull();
    });

    it.each([
        ['parent segment', '../../../secret'],
        ['encoded parent segment', '..%2F..%2Fsecret'],
        ['free text', 'latest'],
        ['empty', ''],
    ])('rejects %s as a timestamp', (_label, timestamp) => {
        expect(parseScanAddress('prod', timestamp)).toBeNull();
    });

    it('rejects a missing parameter', () => {
        expect(parseScanAddress(undefined, '20251122-145232')).toBeNull();
        expect(parseScanAddress('prod', undefined)).toBeNull();
    });
});
