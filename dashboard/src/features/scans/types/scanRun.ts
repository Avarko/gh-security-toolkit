// app/features/scans/types/scanRun.ts
import { z } from "zod";

/**
 * scan-metadata.json
 */

const scanRunMetadataInnerSchema = z.object({
    branch: z.string().optional().default(""),
    commit: z.string().optional().default(""),
    repository: z.string().optional().default(""),
});

const footerMetadataSchema = z.object({
    ci_job_name: z.string().optional(),
    ci_job_url: z.string().optional(),
    trivy_version: z.string().optional(),
    semgrep_version: z.string().optional(),
    toolkit_version: z.string().optional(),
    app_docs_url: z.string().optional(),
    app_issues_url: z.string().optional(),
}).optional();

export const scanRunMetadataSchema = z.object({
    timestamp: z.string(),
    metadata: scanRunMetadataInnerSchema,
    footer: footerMetadataSchema,
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
