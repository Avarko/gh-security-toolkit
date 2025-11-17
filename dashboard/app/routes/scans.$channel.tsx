/**
 * Channel-specific route.
 * Loads all scans for a single channel and displays them in ChannelScansPage.
 *
 * Route path: /scans/:channel
 */

import type { ClientLoaderFunctionArgs } from "@remix-run/react";
import { useLoaderData } from "@remix-run/react";

import type { ScanMetadata } from "~/features/scans/model/historyTypes";
import { fetchScanHistory } from "~/features/scans/api/historyClient";
import { ChannelScansPage } from "~/features/scans/components/ChannelScansPage";

type LoaderData = {
    channel: string;
    scans: ScanMetadata[];
};

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
    const channel = params.channel;
    if (!channel) {
        throw new Error("Channel parameter is missing");
    }

    // Hyödynnetään samaa historia-APIa kuin etusivulla
    const result = await fetchScanHistory();

    if (!result.success) {
        // Tässä kanavakohtaisessa näkymässä voidaan toistaiseksi pitää virhe fataalina
        // ja antaa Remix error boundaryn hoitaa renderöinti.
        throw new Error(result.error ?? "Failed to load scan history");
    }

    const scans: ScanMetadata[] = result.data.scans.filter(
        (scan) => scan.channel === channel
    );

    const data: LoaderData = {
        channel,
        scans,
    };

    return data;
}

export default function ChannelRoute() {
    const { channel, scans } = useLoaderData<typeof clientLoader>();
    return <ChannelScansPage channel={channel} scans={scans} />;
}
