// src/routes/ChannelScanRunDetailRoute.tsx
/**
 * Scan run detail route.
 * URL: /security-scans/channel/:channel/run/:timestamp
 */
import type { LoaderFunctionArgs } from "react-router-dom";
import { useLoaderData, useParams } from "react-router-dom";
import { Container, Typography } from "@mui/material";

import { ScanRunDetailPage } from "../features/scans/components/ScanRunDetailPage";
import { ValidationErrorDisplay } from "../features/scans/components/ValidationErrorDisplay";
import {
    scanRunMetadataSchema,
    trivyScanSchema,
    semgrepScanSchema,
} from "../features/scans/types/scanRun";
import type {
    ScanRunMetadata,
    ScopedTrivyResult,
    SemgrepScan,
    TrivyScanScope,
} from "../features/scans/types/scanRun";
import { getDataRootFromParams } from "./loaderHelpers";

type LoaderData =
    | {
          success: true;
          channel: string;
          metadata: ScanRunMetadata;
          trivyResults: ScopedTrivyResult[];
          semgrepData: SemgrepScan;
          dataBasePath: string;
      }
    | { success: false; error: string; details?: unknown };

export async function loader({ params }: LoaderFunctionArgs): Promise<LoaderData> {
    const { channel, timestamp } = params;

    if (!channel || !timestamp) {
        return {
            success: false,
            error: "Channel and timestamp parameters are required",
        };
    }

    const dataRoot = getDataRootFromParams(params);
    const dataBasePath = `${dataRoot}/runs/${channel}/${timestamp}`;

    try {
        // Load all scan data files in parallel
        const [metadataRes, trivyFsRes, trivyImageRes, semgrepRes] = await Promise.all([
            fetch(`${dataBasePath}/scan-run.json`),
            fetch(`${dataBasePath}/trivy-fs-results.json`),
            fetch(`${dataBasePath}/trivy-image-results.json`),
            fetch(`${dataBasePath}/semgrep-results.json`),
        ]);

        if (!metadataRes.ok) {
            return {
                success: false,
                error: `HTTP ${metadataRes.status}: Failed to load scan metadata from ${dataBasePath}/scan-run.json`,
            };
        }

        // Scan output is validated, not cast. It is written by whatever ran the
        // scan and read here as data, so the schemas are the boundary -- see
        // ZOD_VALIDATION.md. A cast would let a malformed or hostile document
        // through to rendering with only TypeScript's word that it is fine.
        const metadataResult = scanRunMetadataSchema.safeParse(await metadataRes.json());

        if (!metadataResult.success) {
            return {
                success: false,
                error: `Invalid scan metadata in ${dataBasePath}/scan-run.json`,
                details: metadataResult.error,
            };
        }

        // Trivy and Semgrep files may not exist - use empty defaults
        const trivyFs = trivyFsRes.ok
            ? trivyScanSchema.safeParse(await trivyFsRes.json())
            : null;
        const trivyImage = trivyImageRes.ok
            ? trivyScanSchema.safeParse(await trivyImageRes.json())
            : null;
        const semgrep = semgrepRes.ok
            ? semgrepScanSchema.safeParse(await semgrepRes.json())
            : null;

        // Provenance is recorded here because here is where it is known: the
        // two scans arrive as separate files and nothing inside a Result says
        // which one it came from. Merging them first and guessing afterwards
        // from Target or Type cannot work -- Target is a file path and Type is
        // a package ecosystem, neither names the scan.
        const scoped = (
            result: ReturnType<typeof trivyScanSchema.safeParse> | null,
            scope: TrivyScanScope,
        ): ScopedTrivyResult[] =>
            result?.success
                ? (result.data.Results ?? []).map((entry) => ({ ...entry, scope }))
                : [];

        const trivyResults: ScopedTrivyResult[] = [
            ...scoped(trivyFs, "fs"),
            ...scoped(trivyImage, "img"),
        ];

        return {
            success: true,
            channel,
            metadata: metadataResult.data,
            trivyResults,
            semgrepData: semgrep?.success ? semgrep.data : { results: [] },
            dataBasePath,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
            details: error,
        };
    }
}

export default function ChannelScanRunDetailRoute() {
    const data = useLoaderData() as LoaderData;
    const { channel, timestamp } = useParams<{ channel: string; timestamp: string }>();

    if (!channel || !timestamp) {
        return (
            <Container maxWidth="lg" sx={{ mt: 4 }}>
                <Typography color="error">
                    Channel and timestamp parameters are required
                </Typography>
            </Container>
        );
    }

    if (data.success) {
        return (
            <ScanRunDetailPage
                channel={data.channel}
                metadata={data.metadata}
                trivyResults={data.trivyResults}
                semgrepData={data.semgrepData}
                dataBasePath={data.dataBasePath}
            />
        );
    }

    return (
        <Container maxWidth="lg" sx={{ mt: 4 }}>
            <ValidationErrorDisplay error={data.error} details={data.details} />
        </Container>
    );
}
