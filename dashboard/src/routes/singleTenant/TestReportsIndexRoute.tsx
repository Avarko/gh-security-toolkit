// src/routes/singleTenant/TestReportsIndexRoute.tsx
/**
 * Test reports index route.
 *
 * URL: /test-reports
 */
import type { LoaderFunctionArgs } from "react-router-dom";
import { useLoaderData } from "react-router-dom";
import { Container } from "@mui/material";

import {
    fetchTestReports,
    type TestReportsLoadResult,
} from "../../features/testReports/api/testReportsClient";
import { TestReportsOverviewPage } from "../../features/testReports/components/TestReportsOverviewPage";
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

export default function TestReportsIndexRoute() {
    const { result } = useLoaderData() as LoaderData;

    if (result.success && "data" in result) {
        return <TestReportsOverviewPage reports={result.data} />;
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
