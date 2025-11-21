// src/routes/org/app/test-reports/TestReportsIndexRoute.tsx

/**
 * Index route for Test Reports.
 * Fetches test report history and renders the TestReportsOverviewPage component.
 */

import type { LoaderFunctionArgs } from "react-router-dom";
import { useLoaderData } from "react-router-dom";
import { Box, Container, Typography, Alert } from "@mui/material";

import {
    fetchTestReportHistory,
    type TestReportHistoryLoadResult,
} from "../../../../features/testReports/api/testReportsClient";
import { TestReportsOverviewPage } from "../../../../features/testReports/components/TestReportsOverviewPage";
import { MissingTenantParamsError } from "../../../../errors/MissingTenantParamsError";
import { loadTenantRegistry, findTenantByGitHub } from "../../../../lib/tenantRegistry";

type LoaderData = {
    result: TestReportHistoryLoadResult;
    tenantId: string;
};

export async function loader(args: LoaderFunctionArgs): Promise<LoaderData> {
    const { orgSlug, repoSlug } = args.params;

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
        const result = await fetchTestReportHistory({
            githubOrg: orgSlug,
            githubRepo: repoSlug,
            registry,
        });

        if (!result.success) {
            console.error(
                "Failed to load test report history:",
                result.error,
                result.details,
            );
        }

        return { result, tenantId: tenant.id } as const;
    } catch (error) {
        console.error("Unexpected error during loader:", error);

        if (error instanceof MissingTenantParamsError) {
            throw error;
        }

        return {
            result: {
                success: false,
                error: "Unexpected error",
                details: error,
            },
            tenantId: tenant.id,
        };
    }
}

export default function TestReportsIndexRoute() {
    const { result, tenantId } = useLoaderData() as LoaderData;

    if (result.success && "data" in result) {
        return <TestReportsOverviewPage history={result.data} tenantId={tenantId} />;
    } else {
        return (
            <Container maxWidth="lg" sx={{ mt: 4 }}>
                <Alert severity="error" sx={{ mb: 2 }}>
                    <Typography variant="body1" fontWeight={500}>
                        Failed to load test report history
                    </Typography>
                    <Typography variant="body2">
                        {result.error}
                    </Typography>
                </Alert>
                <Box sx={{ mt: 3 }}>
                    <Typography variant="body2" color="text.secondary">
                        The application will continue to function, but test report data is
                        currently unavailable.
                    </Typography>
                </Box>
            </Container>
        );
    }
}
