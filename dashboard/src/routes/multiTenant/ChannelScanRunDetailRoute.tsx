// src/routes/multiTenant/ChannelScanRunDetailRoute.tsx
/**
 * Scan run detail route for multi-tenant mode.
 *
 * URL: /:tenantPath/security-scans/channel/:channel/run/:timestamp
 */
import type { LoaderFunctionArgs } from "react-router-dom";
import { useLoaderData, useParams } from "react-router-dom";
import { Container, Typography } from "@mui/material";

import { ScanRunDetailPage } from "../../features/scans/components/ScanRunDetailPage";
import { ValidationErrorDisplay } from "../../features/scans/components/ValidationErrorDisplay";
import { findTenantByUrlPath } from "../../config/tenantMode";
import type { ScanRunMetadata, TrivyScan, SemgrepScan } from "../../features/scans/types/scanRun";

type LoaderData =
    | {
          success: true;
          channel: string;
          metadata: ScanRunMetadata;
          trivyData: TrivyScan;
          semgrepData: SemgrepScan;
          dataBasePath: string;
      }
    | { success: false; error: string; details?: unknown };

export async function loader(args: LoaderFunctionArgs): Promise<LoaderData> {
    const { tenantPath, channel, timestamp } = args.params;

    if (!tenantPath || !channel || !timestamp) {
        return {
            success: false,
            error: "Tenant path, channel, and timestamp parameters are required",
        };
    }

    const tenant = findTenantByUrlPath(tenantPath);

    if (!tenant) {
        return {
            success: false,
            error: `Tenant not found: ${tenantPath}`,
        };
    }

    // In multi-tenant mode, data is at /data/<uuid>/runs/<channel>/<timestamp>/
    const dataBasePath = `/data/${tenant.id}/runs/${channel}/${timestamp}`;

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

        const metadata = (await metadataRes.json()) as ScanRunMetadata;

        // Trivy and Semgrep files may not exist - use empty defaults
        const trivyFs: TrivyScan = trivyFsRes.ok
            ? await trivyFsRes.json()
            : { Results: [] };
        const trivyImage: TrivyScan = trivyImageRes.ok
            ? await trivyImageRes.json()
            : { Results: [] };
        const semgrepData: SemgrepScan = semgrepRes.ok
            ? await semgrepRes.json()
            : { results: [] };

        // Merge Trivy results from both filesystem and image scans
        const trivyData: TrivyScan = {
            Results: [
                ...(trivyFs.Results ?? []),
                ...(trivyImage.Results ?? []),
            ],
        };

        return {
            success: true,
            channel,
            metadata,
            trivyData,
            semgrepData,
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
                trivyData={data.trivyData}
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
