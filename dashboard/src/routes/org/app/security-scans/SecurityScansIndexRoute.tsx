// src/routes/org/app/security-scans/SecurityScansIndexRoute.tsx

/**
 * Index route for Security scans.
 * Fetches scan history and renders the ScanOverviewPage component.
 */

import type { LoaderFunctionArgs } from "react-router-dom";
import { useLoaderData } from "react-router-dom";
import { Box, Container, Typography } from "@mui/material";

import {
    fetchScanHistory,
    type ScanHistoryLoadResult,
} from "../../../../features/scans/api/historyClient";
import { ScanOverviewPage } from "../../../../features/scans/components/ScanOverviewPage";
import { ValidationErrorDisplay } from "../../../../features/scans/components/ValidationErrorDisplay";
import { MissingTenantParamsError } from "../../../../errors/MissingTenantParamsError";
import { loadTenantRegistry } from "../../../../lib/tenantRegistry";

type LoaderData = {
    result: ScanHistoryLoadResult;
};

export async function loader(args: LoaderFunctionArgs): Promise<LoaderData> {
    const { orgSlug, repoSlug } = args.params;

    // Load tenant registry
    const registry = await loadTenantRegistry();

    // In the GUID-based system, orgSlug is the GitHub org and repoSlug is the GitHub repo
    if (!orgSlug || !repoSlug) {
        throw new MissingTenantParamsError(
            `GitHub org and repo are required in URL: /org/<org>/repo/<repo>`
        );
    }

    try {
        const result = await fetchScanHistory({
            githubOrg: orgSlug,
            githubRepo: repoSlug,
            registry,
        });

        if (!result.success) {
            console.error(
                "Failed to load scan history:",
                result.error,
                result.details,
            );
        }

        return { result } as const;
    } catch (error) {
        console.error("Unexpected error during loader:", error);

        // Missing tenant parameters is a configuration error → let it bubble up
        if (error instanceof MissingTenantParamsError) {
            throw error;
        }

        return {
            result: {
                success: false,
                error: "Unexpected error",
                details: error,
            },
        };
    }
}

export default function SecurityScansIndexRoute() {
    const { result } = useLoaderData() as LoaderData;

    if (result.success && "data" in result) {
        return <ScanOverviewPage history={result.data} />;
    } else {
        return (
            <Container maxWidth="lg" sx={{ mt: 4 }}>
                <ValidationErrorDisplay
                    error={result.error}
                    details={result.details}
                />
                <Box sx={{ mt: 3 }}>
                    <Typography variant="body2" color="text.secondary">
                        The application will continue to function, but scan data is
                        currently unavailable.
                    </Typography>
                </Box>
            </Container>
        );
    }
}
