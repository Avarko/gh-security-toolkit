// src/routes/singleTenant/ChannelTestReportsRoute.tsx
/**
 * Channel test reports route.
 *
 * URL: /test-reports/channel/:channel
 */
import type { LoaderFunctionArgs } from "react-router-dom";
import { useLoaderData, useParams } from "react-router-dom";
import { Container, Typography } from "@mui/material";

import {
    fetchTestReports,
    type TestReportsLoadResult,
} from "../../features/testReports/api/testReportsClient";
import { ChannelTestReportsPage } from "../../features/testReports/components/ChannelTestReportsPage";
import { ValidationErrorDisplay } from "../../features/scans/components/ValidationErrorDisplay";

type LoaderData = {
    result: TestReportsLoadResult;
};

export async function loader(_args: LoaderFunctionArgs): Promise<LoaderData> {
    const result = await fetchTestReports();

    if (!result.success) {
        console.error(
            "Failed to load test reports:",
            result.error,
            result.details
        );
    }

    return { result };
}

export default function ChannelTestReportsRoute() {
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
        return <ChannelTestReportsPage reports={result.data} channel={channel} />;
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
