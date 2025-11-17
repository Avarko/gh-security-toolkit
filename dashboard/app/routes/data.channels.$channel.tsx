/**
 * Channel-specific route.
 * Loads all scans for a single channel and displays them in ChannelScansPage.
 */

import type { ClientLoaderFunctionArgs } from "@remix-run/react";
import { useLoaderData } from "@remix-run/react";

import {
    scanHistorySchema,
    type ScanHistory,
    type ScanMetadata,
} from "../features/scans/model/historyTypes";
import { ChannelScansPage } from "../features/scans/components/ChannelScansPage";

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
    const channel = params.channel;
    if (!channel) {
        throw new Error("Channel parameter is missing");
    }

    const response = await fetch("/data/hist/scan-history.json");
    if (!response.ok) {
        throw new Error(
            `Failed to load scan history: ${response.status} ${response.statusText}`
        );
    }

    const rawJson = await response.json();
    const history: ScanHistory = scanHistorySchema.parse(rawJson);

    const scans: ScanMetadata[] = history.scans.filter(
        (scan) => scan.channel === channel
    );

    return { channel, scans };
}

export default function ChannelRoute() {
    const { channel, scans } = useLoaderData<typeof clientLoader>();
    return <ChannelScansPage channel={channel} scans={scans} />;
}
