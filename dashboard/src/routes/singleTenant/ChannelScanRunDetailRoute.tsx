// src/routes/singleTenant/ChannelScanRunDetailRoute.tsx
/**
 * Scan run detail route for single-tenant mode.
 *
 * URL: /security-scans/channel/:channel/run/:timestamp
 */
import type { LoaderFunctionArgs } from "react-router-dom";
import { useLoaderData, useParams } from "react-router-dom";
import { Container, Typography } from "@mui/material";

import { ScanRunDetailPage } from "../../features/scans/components/ScanRunDetailPage";
import { ValidationErrorDisplay } from "../../features/scans/components/ValidationErrorDisplay";
import type { ScanRun } from "../../features/scans/types/scanRun";

type LoaderData =
    | { success: true; scanRun: ScanRun }
    | { success: false; error: string; details?: unknown };

export async function loader(args: LoaderFunctionArgs): Promise<LoaderData> {
    const { channel, timestamp } = args.params;

    if (!channel || !timestamp) {
        return {
            success: false,
            error: "Channel and timestamp parameters are required",
        };
    }

    // In single-tenant mode, data is at /data/runs/<channel>/<timestamp>/
    const scanRunUrl = `/data/runs/${channel}/${timestamp}/scan-run.json`;

    try {
        const response = await fetch(scanRunUrl);

        if (!response.ok) {
            return {
                success: false,
                error: `HTTP ${response.status}: Failed to load scan run from ${scanRunUrl}`,
            };
        }

        const scanRun = (await response.json()) as ScanRun;
        return { success: true, scanRun };
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
        return <ScanRunDetailPage scanRun={data.scanRun} />;
    }

    return (
        <Container maxWidth="lg" sx={{ mt: 4 }}>
            <ValidationErrorDisplay error={data.error} details={data.details} />
        </Container>
    );
}
