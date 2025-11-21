// src/routes/org/app/test-reports/ChannelTestReportsRoute.tsx

/**
 * Channel-specific route for test reports.
 * Loads all test reports for a single channel and displays them in ChannelTestReportsPage.
 *
 * Route path:
 * /org/:orgSlug/repo/:repoSlug/test-reports/channel/:channel
 */

import type { LoaderFunctionArgs } from "react-router-dom";
import { useLoaderData } from "react-router-dom";

import type { TestReportEntry } from "../../../../features/testReports/model/testReportTypes";
import { fetchTestReportHistory } from "../../../../features/testReports/api/testReportsClient";
import { ChannelTestReportsPage } from "../../../../features/testReports/components/ChannelTestReportsPage";
import { MissingTenantParamsError } from "../../../../errors/MissingTenantParamsError";
import { loadTenantRegistry, findTenantByGitHub } from "../../../../lib/tenantRegistry";

type LoaderData = {
    channel: string;
    reports: TestReportEntry[];
    tenantId: string;
};

export async function loader(args: LoaderFunctionArgs): Promise<LoaderData> {
    const { params } = args;
    const { orgSlug, repoSlug, channel } = params;

    // Load tenant registry
    const registry = await loadTenantRegistry();

    if (!orgSlug || !repoSlug) {
        throw new MissingTenantParamsError(
            `GitHub org and repo are required in URL: /org/<org>/repo/<repo>`
        );
    }

    // Find tenant to get the UUID
    const tenant = findTenantByGitHub(registry, orgSlug, repoSlug);
    if (!tenant) {
        throw new MissingTenantParamsError(
            `Tenant not found for ${orgSlug}/${repoSlug}`
        );
    }

    try {
        if (!channel) {
            throw new Error("Channel parameter is missing");
        }

        const result = await fetchTestReportHistory({
            githubOrg: orgSlug,
            githubRepo: repoSlug,
            registry,
        });

        if (!result.success) {
            throw new Error(result.error ?? "Failed to load test report history");
        }

        const reports: TestReportEntry[] = result.data.reports.filter(
            (report: TestReportEntry) => report.channel === channel,
        );

        return {
            channel,
            reports,
            tenantId: tenant.id,
        };
    } catch (error) {
        console.error("Unexpected error during loader:", error);

        if (error instanceof MissingTenantParamsError) {
            throw error;
        }

        throw new Error("Failed to load channel test reports");
    }
}

export default function ChannelTestReportsRoute() {
    const { channel, reports, tenantId } = useLoaderData() as LoaderData;
    return <ChannelTestReportsPage channel={channel} reports={reports} tenantId={tenantId} />;
}
