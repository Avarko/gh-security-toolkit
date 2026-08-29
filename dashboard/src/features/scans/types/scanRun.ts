// app/features/scans/types/scanRun.ts
import { z } from "zod";
import { branchSchema, commitSchema, repositorySchema } from "../../../lib/gitRefSchemas";

/**
 * scan-run.json
 */

// These three feed ReportFooter's GitHub links on the run detail page, so they
// get the same validation as the history documents rather than none at all.
export const scanRunMetadataInnerSchema = z.object({
    branch: branchSchema,
    commit: commitSchema,
    repository: repositorySchema,
});

export const scanRunMetadataSchema = z.object({
    timestamp: z.string(),
    metadata: scanRunMetadataInnerSchema
});

export type ScanRunMetadata = z.infer<typeof scanRunMetadataSchema>;

/**
 * Trivy JSON (SchemaVersion 2), as this toolkit invokes it.
 *
 * The field names below are Trivy's own and are pinned by a test that parses
 * scripts/test-fixtures/trivy-fs-results.json. If Trivy changes the shape, that
 * test fails -- which is the point: this dashboard reads the output of whatever
 * Trivy version the toolkit image ships, and a silent shape change would show
 * up as an empty table rather than an error.
 */

export const trivyVulnerabilitySchema = z.object({
    VulnerabilityID: z.string(),
    PkgName: z.string(),
    Severity: z.string(),
    Title: z.string(),
    InstalledVersion: z.string().optional(),
    FixedVersion: z.string().optional(),
    Description: z.string().optional(),
    PrimaryURL: z.string().optional(),
});

export type TrivyVulnerability = z.infer<typeof trivyVulnerabilitySchema>;

/**
 * One entry of Results[].
 *
 * Target is the scanned artifact -- a file path such as "package-lock.json"
 * for a filesystem scan, an image reference for an image scan. Class says what
 * kind of finding it holds ("lang-pkgs", "os-pkgs", "config", "secret") and
 * Type names the ecosystem ("npm", "gomod", "dockerfile"). None of the three
 * says which of our two scans produced it; that is tracked separately, see
 * trivyScanScope.
 */
export const trivyResultSchema = z
    .object({
        Target: z.string(),
        Class: z.string().optional(),
        Type: z.string().optional(),
        Vulnerabilities: z.array(trivyVulnerabilitySchema).optional(),
    })
    // Trivy reports far more than we render (Misconfigurations, Secrets,
    // Licenses); we model only what is displayed.
    .passthrough();

export type TrivyResult = z.infer<typeof trivyResultSchema>;

export const trivyScanSchema = z
    .object({
        SchemaVersion: z.number().optional(),
        Results: z.array(trivyResultSchema).optional(),
    })
    .passthrough();

export type TrivyScan = z.infer<typeof trivyScanSchema>;

/**
 * Which of the two scans a result came from.
 *
 * The toolkit publishes trivy-fs-results.json and trivy-image-results.json
 * side by side, so provenance is known exactly at the point they are loaded.
 * It has to be recorded there, because nothing inside a Result carries it.
 */
export type TrivyScanScope = "fs" | "img";

export type ScopedTrivyResult = TrivyResult & { scope: TrivyScanScope };

/**
 * Semgrep: kiinnostaa results[]
 */
export const semgrepFindingSchema = z.object({
    check_id: z.string(),
    path: z.string(),
    start: z.object({
        line: z.number(),
        col: z.number().optional(),
    }).optional(),
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
