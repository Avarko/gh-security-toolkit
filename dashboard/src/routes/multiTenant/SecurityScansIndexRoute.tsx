// src/routes/multiTenant/SecurityScansIndexRoute.tsx
/**
 * Security scans index route for multi-tenant mode.
 *
 * URL: /:tenantPath/security-scans
 */
import type { LoaderFunctionArgs } from "react-router-dom";
import { useLoaderData } from "react-router-dom";
import { Box, Container, Typography } from "@mui/material";

import {
    fetchScanHistoryMultiTenant,
    type ScanHistoryLoadResult,
} from "../../features/scans/api/historyClient";
import { ScanOverviewPage } from "../../features/scans/components/ScanOverviewPage";
import { ValidationErrorDisplay } from "../../features/scans/components/ValidationErrorDisplay";
import { findTenantByUrlPath } from "../../config/tenantMode";

type LoaderData = {
    result: ScanHistoryLoadResult;
};

export async function loader(args: LoaderFunctionArgs): Promise<LoaderData> {
    const { tenantPath } = args.params;

    if (!tenantPath) {
        return {
            result: {
                success: false,
                error: "Tenant path is required",
            },
        };
    }

    const tenant = findTenantByUrlPath(tenantPath);

    if (!tenant) {
        return {
            result: {
                success: false,
                error: `Tenant not found: ${tenantPath}`,
            },
        };
    }

    const result = await fetchScanHistoryMultiTenant(tenant.id);

    if (!result.success) {
        console.error(
            "Failed to load scan history:",
            result.error,
            result.details
        );
    }

    return { result };
}

export default function SecurityScansIndexRoute() {
    const { result } = useLoaderData() as LoaderData;

    if (result.success && "data" in result) {
        return <ScanOverviewPage history={result.data} />;
    }

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
