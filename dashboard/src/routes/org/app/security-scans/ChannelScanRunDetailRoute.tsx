// src/routes/org/app/security-scans/ChannelScanRunDetailRoute.tsx

/**
 * Scan run detail route.
 * Loads a single scan run (metadata + Trivy + Semgrep) and displays it.
 *
 * Route path (either org-app- or repo-scoped):
 * /org/:orgSlug/app/:appSlug/security-scans/channel/:channel/run/:timestamp
 * /org/:orgSlug/app/:appSlug/repo/:repoSlug/security-scans/channel/:channel/run/:timestamp
 */

import type { LoaderFunctionArgs } from "react-router-dom";
import { useLoaderData } from "react-router-dom";

import {
    scanRunMetadataSchema,
    trivyScanSchema,
    semgrepScanSchema,
    type ScanRunMetadata,
    type TrivyScan,
    type SemgrepScan,
} from "../../../../features/scans/types/scanRun";
import { ScanRunDetailPage } from "../../../../features/scans/components/ScanRunDetailPage";
import { getDataRoot } from "../../../../lib/dataPath";
import { MissingTenantParamsError } from "../../../../errors/MissingTenantParamsError";

type LoaderData = {
    channel: string;
    metadata: ScanRunMetadata;
    trivyData: TrivyScan;
    semgrepData: SemgrepScan;
};

export async function loader(args: LoaderFunctionArgs): Promise<LoaderData> {
    const { params } = args;
    const { orgSlug, appSlug, repoSlug, channel, timestamp } = params;

    try {
        if (!channel || !timestamp) {
            throw new Error(
                "Both channel and timestamp route params are required",
            );
        }

        const dataRoot = getDataRoot({ orgSlug, appSlug, repoSlug });
        const baseUrl = `${dataRoot}/runs/${channel}/${timestamp}`;

        const [metadataRes, trivyRes, semgrepRes] = await Promise.all([
            fetch(`${baseUrl}/scan-metadata.json`),
            fetch(`${baseUrl}/trivy-fs-results.json`),
            fetch(`${baseUrl}/semgrep-results.json`),
        ]);

        if (!metadataRes.ok || !trivyRes.ok || !semgrepRes.ok) {
            throw new Error("Failed to load scan data");
        }

        const metadataJson = await metadataRes.json();
        const metadata = scanRunMetadataSchema.parse(metadataJson);

        const trivyData = trivyScanSchema.parse(await trivyRes.json());
        const semgrepData = semgrepScanSchema.parse(await semgrepRes.json());

        return { channel, metadata, trivyData, semgrepData };
    } catch (error) {
        console.error("Unexpected error during loader:", error);

        if (error instanceof MissingTenantParamsError) {
            // Tenant context missing is a critical configuration error → let it bubble up
            throw error;
        }

        throw new Error("Failed to load scan run details");
    }
}

export default function ChannelScanRunDetailRoute() {
    const { channel, metadata, trivyData, semgrepData } =
        useLoaderData() as LoaderData;

    return (
        <ScanRunDetailPage
            channel={channel}
            metadata={metadata}
            trivyData={trivyData}
            semgrepData={semgrepData}
        />
    );
}
