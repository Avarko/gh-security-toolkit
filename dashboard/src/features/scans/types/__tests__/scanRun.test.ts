/**
 * These tests parse the checked-in Trivy and Semgrep fixtures under
 * scripts/test-fixtures/, which are real scanner output rather than data
 * written to suit the schema. That is deliberate: if a Trivy upgrade in the
 * toolkit image renames or moves a field, this fails loudly here instead of
 * quietly rendering an empty vulnerability table in the dashboard.
 *
 * When it does fail, the fixture is the thing to trust -- update the schema to
 * match Trivy, not the other way round.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
    trivyScanSchema,
    semgrepScanSchema,
    scanRunMetadataInnerSchema,
} from '../scanRun';

function fixture(name: string): unknown {
    const path = fileURLToPath(
        new URL(`../../../../../../scripts/test-fixtures/${name}`, import.meta.url),
    );
    return JSON.parse(readFileSync(path, 'utf-8'));
}

describe('trivyScanSchema against real Trivy output', () => {
    it('parses the filesystem scan fixture', () => {
        const result = trivyScanSchema.safeParse(fixture('trivy-fs-results.json'));

        expect(result.success).toBe(true);
        if (!result.success) return;

        expect(result.data.SchemaVersion).toBe(2);
        expect(result.data.Results).toHaveLength(1);
    });

    it('keeps the fields the run detail page reads', () => {
        const result = trivyScanSchema.safeParse(fixture('trivy-fs-results.json'));
        expect(result.success).toBe(true);
        if (!result.success) return;

        const entry = (result.data.Results ?? [])[0]!;

        // Target is a file path and Type is a package ecosystem. Neither says
        // whether the finding came from the filesystem or the image scan --
        // that is why provenance is tagged in the loader instead.
        expect(entry.Target).toBe('package-lock.json');
        expect(entry.Class).toBe('lang-pkgs');
        expect(entry.Type).toBe('npm');

        const vulns = entry.Vulnerabilities ?? [];
        expect(vulns.length).toBeGreaterThan(0);
        for (const vuln of vulns) {
            expect(vuln.VulnerabilityID).toMatch(/^(CVE|GHSA)-/);
            expect(vuln.PkgName).toBeTruthy();
            expect(vuln.Severity).toBeTruthy();
            expect(vuln.Title).toBeTruthy();
        }
    });

    it('preserves sections it does not model, such as Misconfigurations', () => {
        const result = trivyScanSchema.safeParse(fixture('trivy-fs-results.json'));
        expect(result.success).toBe(true);
        if (!result.success) return;

        const entry = (result.data.Results ?? [])[0]!;
        expect(entry).toHaveProperty('Misconfigurations');
    });
});

describe('semgrepScanSchema against real Semgrep output', () => {
    it('parses the fixture', () => {
        const result = semgrepScanSchema.safeParse(fixture('semgrep-results.json'));

        expect(result.success).toBe(true);
        if (!result.success) return;

        for (const finding of result.data.results ?? []) {
            expect(finding.check_id).toBeTruthy();
            expect(finding.path).toBeTruthy();
            expect(finding.extra.severity).toBeTruthy();
        }
    });
});

describe('scan metadata against real scan output', () => {
    // scan-metadata.json holds the metadata object on its own; scan-run.json
    // nests the same shape under a "metadata" key alongside the timestamp.
    it('parses the fixture', () => {
        const result = scanRunMetadataInnerSchema.safeParse(fixture('scan-metadata.json'));

        expect(result.success).toBe(true);
        if (!result.success) return;

        expect(result.data.branch).toBe('main');
        expect(result.data.repository).toBe('Avarko/gh-security-toolkit');
        expect(result.data.commit).toBe('abc123def456789');
    });
});
