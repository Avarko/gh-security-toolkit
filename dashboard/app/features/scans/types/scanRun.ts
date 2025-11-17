// app/features/scans/types/scanRun.ts
import { z } from "zod";

/**
 * scan-metadata.json
 */
export const scanRunMetadataSchema = z.object({
    timestamp: z.string(),
    branch: z.string(),
    commitSha: z.string(),
    repository: z.string(),
});

export type ScanRunMetadata = z.infer<typeof scanRunMetadataSchema>;

/**
 * Trivy: tarvitsemme vain Results[].Vulnerabilities[]-listan
 */
export const trivyVulnerabilitySchema = z.object({
    VulnerabilityID: z.string(),
    PkgName: z.string(),
    Severity: z.string(),
    Title: z.string(),
    Description: z.string().optional(),
    PrimaryURL: z.string().optional(),
});

export type TrivyVulnerability = z.infer<typeof trivyVulnerabilitySchema>;

export const trivyScanSchema = z
    .object({
        Results: z
            .array(
                z.object({
                    Vulnerabilities: z.array(trivyVulnerabilitySchema).optional(),
                })
            )
            .optional(),
    })
    // sallitaan ylimääräiset kentät, emme mallinna koko Trivyä
    .passthrough();

export type TrivyScan = z.infer<typeof trivyScanSchema>;

/**
 * Semgrep: kiinnostaa results[]
 */
export const semgrepFindingSchema = z.object({
    check_id: z.string(),
    path: z.string(),
    extra: z.object({
        severity: z.string(),
        message: z.string(),
        lines: z.string().optional(),
    }),
});

export type SemgrepFinding = z.infer<typeof semgrepFindingSchema>;

export const semgrepScanSchema = z
    .object({
        results: z.array(semgrepFindingSchema).optional(),
    })
    .passthrough();

export type SemgrepScan = z.infer<typeof semgrepScanSchema>;
