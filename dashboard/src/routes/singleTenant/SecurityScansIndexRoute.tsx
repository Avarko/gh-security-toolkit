// src/routes/singleTenant/SecurityScansIndexRoute.tsx
/**
 * Security scans index route for single-tenant mode.
 *
 * In single-tenant mode:
 * - No tenant resolution needed
 * - Data is fetched directly from /data/hist/scan-history.json
 * - URL: /security-scans
 */
import type { LoaderFunctionArgs } from "react-router-dom";
import { useLoaderData } from "react-router-dom";
import { Box, Container, Typography } from "@mui/material";

import {
    fetchScanHistorySingleTenant,
    type ScanHistoryLoadResult,
} from "../../features/scans/api/historyClient";
import { ScanOverviewPage } from "../../features/scans/components/ScanOverviewPage";
import { ValidationErrorDisplay } from "../../features/scans/components/ValidationErrorDisplay";

type LoaderData = {
    result: ScanHistoryLoadResult;
};

export async function loader(_args: LoaderFunctionArgs): Promise<LoaderData> {
    const result = await fetchScanHistorySingleTenant();

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
