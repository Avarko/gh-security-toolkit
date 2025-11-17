// src/routes/org/app/security-scans/SecurityScansIndexRoute.tsx

/**
 * Security scans -alueen "index route".
 * Fetchaa scan-historian ja renderöi ScanOverviewPage-komponentin.
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

type LoaderData = {
    result: ScanHistoryLoadResult;
};

export async function loader(_args: LoaderFunctionArgs): Promise<LoaderData> {
    try {
        const result = await fetchScanHistory();
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
        return {
            result: {
                success: false,
                error: "Unexpected error",
                details: null,
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
