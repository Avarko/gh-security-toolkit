/**
 * Scan run detail route.
 * Loads a single scan run (metadata + Trivy + Semgrep) and displays it.
 *
 * Route path: /scans/:channel/:timestamp
 */

import type { ClientLoaderFunctionArgs } from "@remix-run/react";
import { useLoaderData } from "@remix-run/react";

import {
    scanRunMetadataSchema,
    trivyScanSchema,
    semgrepScanSchema,
    type ScanRunMetadata,
    type TrivyScan,
    type SemgrepScan,
} from "~/features/scans/types/scanRun";
import { ScanRunDetailPage } from "~/features/scans/components/ScanRunDetailPage";

type LoaderData = {
    channel: string;
    metadata: ScanRunMetadata;
    trivyData: TrivyScan;
    semgrepData: SemgrepScan;
};

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
    const { channel, timestamp } = params;

    if (!channel || !timestamp) {
        throw new Error("Both channel and timestamp route params are required");
    }

    const baseUrl = `/data/runs/${channel}/${timestamp}`;

    const [metadataRes, trivyRes, semgrepRes] = await Promise.all([
        fetch(`${baseUrl}/scan-metadata.json`),
        fetch(`${baseUrl}/trivy-fs-results.json`),
        fetch(`${baseUrl}/semgrep-results.json`),
    ]);

    if (!metadataRes.ok) {
        throw new Error(
            `Failed to load scan metadata (${metadataRes.status} ${metadataRes.statusText})`
        );
    }

    const metadataJson = await metadataRes.json();
    const metadata = scanRunMetadataSchema.parse(metadataJson);

    // Trivy ja Semgrep voivat puuttua; käytetään tyhjää objektia fallbackina.
    const trivyJson = trivyRes.ok ? await trivyRes.json() : {};
    const semgrepJson = semgrepRes.ok ? await semgrepRes.json() : {};

    const trivyData = trivyScanSchema.parse(trivyJson);
    const semgrepData = semgrepScanSchema.parse(semgrepJson);

    const data: LoaderData = {
        channel,
        metadata,
        trivyData,
        semgrepData,
    };

    return data;
}

export default function RunDetailRoute() {
    const { channel, metadata, trivyData, semgrepData } =
        useLoaderData<typeof clientLoader>();

    return (
        <ScanRunDetailPage
            channel={channel}
            metadata={metadata}
            trivyData={trivyData}
            semgrepData={semgrepData}
        />
    );
}
