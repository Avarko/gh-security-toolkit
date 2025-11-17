// src/routes/org/app/security-scans/ChannelScansRoute.tsx

/**
 * Channel-specific route.
 * Loads all scans for a single channel and displays them in ChannelScansPage.
 *
 * Route path (either org-app- or repo-scoped):
 * /org/:orgSlug/app/:appSlug/security-scans/channel/:channel
 * /org/:orgSlug/app/:appSlug/repo/:repoSlug/security-scans/channel/:channel
 */

import type { LoaderFunctionArgs } from "react-router-dom";
import { useLoaderData } from "react-router-dom";

import type { ScanMetadata } from "../../../../features/scans/model/historyTypes";
import { fetchScanHistory } from "../../../../features/scans/api/historyClient";
import { ChannelScansPage } from "../../../../features/scans/components/ChannelScansPage";
import { MissingTenantParamsError } from "../../../../errors/MissingTenantParamsError";

type LoaderData = {
    channel: string;
    scans: ScanMetadata[];
};

export async function loader(args: LoaderFunctionArgs): Promise<LoaderData> {
    const { params } = args;
    const { orgSlug, appSlug, repoSlug, channel } = params;

    try {
        if (!channel) {
            throw new Error("Channel parameter is missing");
        }

        const result = await fetchScanHistory({
            orgSlug,
            appSlug,
            repoSlug,
        });

        if (!result.success) {
            throw new Error(result.error ?? "Failed to load scan history");
        }

        const scans: ScanMetadata[] = result.data.scans.filter(
            (scan: ScanMetadata) => scan.channel === channel,
        );

        return {
            channel,
            scans,
        };
    } catch (error) {
        console.error("Unexpected error during loader:", error);

        if (error instanceof MissingTenantParamsError) {
            // Configuration error → let it bubble up to the router's error boundary
            throw error;
        }

        throw new Error("Failed to load channel scans");
    }
}

export default function ChannelScansRoute() {
    const { channel, scans } = useLoaderData() as LoaderData;
    return <ChannelScansPage channel={channel} scans={scans} />;
}
