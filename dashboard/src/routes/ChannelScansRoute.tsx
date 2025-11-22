// src/routes/ChannelScansRoute.tsx
/**
 * Channel scans route.
 * URL: /security-scans/channel/:channel
 */
import type { LoaderFunctionArgs } from "react-router-dom";
import { useLoaderData, useParams } from "react-router-dom";
import { Container, Typography } from "@mui/material";

import {
    fetchScanHistory,
    type ScanHistoryLoadResult,
} from "../features/scans/api/historyClient";
import { ChannelScansPage } from "../features/scans/components/ChannelScansPage";
import { ValidationErrorDisplay } from "../features/scans/components/ValidationErrorDisplay";
import { getDataRootFromParams } from "./loaderHelpers";

type LoaderData = {
    result: ScanHistoryLoadResult;
};

export async function loader({ params }: LoaderFunctionArgs): Promise<LoaderData> {
    const dataRoot = getDataRootFromParams(params);
    const result = await fetchScanHistory(dataRoot);

    if (!result.success) {
        console.error("Failed to load scan history:", result.error, result.details);
    }

    return { result };
}

export default function ChannelScansRoute() {
    const { result } = useLoaderData() as LoaderData;
    const { channel } = useParams<{ channel: string }>();

    if (!channel) {
        return (
            <Container maxWidth="lg" sx={{ mt: 4 }}>
                <Typography color="error">Channel parameter is required</Typography>
            </Container>
        );
    }

    if (result.success && "data" in result) {
        return <ChannelScansPage history={result.data} channel={channel} />;
    }

    return (
        <Container maxWidth="lg" sx={{ mt: 4 }}>
            <ValidationErrorDisplay
                error={result.error}
                details={result.details}
            />
        </Container>
    );
}
