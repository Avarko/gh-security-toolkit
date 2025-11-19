// src/routes/org/app/security-scans/ChannelScansRoute.tsx

/**
 * Channel-specific route.
 * Loads all scans for a single channel and displays them in ChannelScansPage.
 *
 * Route path:
 * /org/:orgSlug/repo/:repoSlug/security-scans/channel/:channel
 */

import type { LoaderFunctionArgs } from "react-router-dom";
import { useLoaderData } from "react-router-dom";

import type { ScanMetadata } from "../../../../features/scans/model/historyTypes";
import { fetchScanHistory } from "../../../../features/scans/api/historyClient";
import { ChannelScansPage } from "../../../../features/scans/components/ChannelScansPage";
import { MissingTenantParamsError } from "../../../../errors/MissingTenantParamsError";
import { loadTenantRegistry } from "../../../../lib/tenantRegistry";

type LoaderData = {
    channel: string;
    scans: ScanMetadata[];
};

export async function loader(args: LoaderFunctionArgs): Promise<LoaderData> {
    const { params } = args;
    const { orgSlug, repoSlug, channel } = params;

    // Load tenant registry
    const registry = await loadTenantRegistry();

    // In the GUID-based system, orgSlug is the GitHub org and repoSlug is the GitHub repo
    if (!orgSlug || !repoSlug) {
        throw new MissingTenantParamsError(
            `GitHub org and repo are required in URL: /org/<org>/repo/<repo>`
        );
    }

    try {
        if (!channel) {
            throw new Error("Channel parameter is missing");
        }

        const result = await fetchScanHistory({
            githubOrg: orgSlug,
            githubRepo: repoSlug,
            registry,
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
