/**
 * Main route entry for security scan overview.
 * Fetches scan history with Zod validation and renders ScanOverviewPage.
 */

import type { ClientLoaderFunctionArgs } from "@remix-run/react";
import { useLoaderData } from "@remix-run/react";
import { Box, Container, Typography } from "@mui/material";
import { fetchScanHistory } from "~/features/scans/api/historyClient";
import { ScanOverviewPage } from "~/features/scans/components/ScanOverviewPage";
import { ValidationErrorDisplay } from "~/features/scans/components/ValidationErrorDisplay";

export async function clientLoader(_args: ClientLoaderFunctionArgs) {
    const result = await fetchScanHistory();
    return { result };
}

export default function IndexRoute() {
    const { result } = useLoaderData<typeof clientLoader>();

    // Handle validation errors gracefully
    if (!result.success) {
        return (
            <Container maxWidth="lg" sx={{ mt: 4 }}>
                <ValidationErrorDisplay
                    error={result.error}
                    details={result.details}
                />
                <Box sx={{ mt: 3 }}>
                    <Typography variant="body2" color="text.secondary">
                        The application will continue to function, but scan data is currently unavailable.
                    </Typography>
                </Box>
            </Container>
        );
    }

    return <ScanOverviewPage history={result.data} />;
}

