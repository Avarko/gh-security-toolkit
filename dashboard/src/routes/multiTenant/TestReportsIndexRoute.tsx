// src/routes/multiTenant/TestReportsIndexRoute.tsx
/**
 * Test reports index route for multi-tenant mode.
 *
 * URL: /:tenantPath/test-reports
 */
import type { LoaderFunctionArgs } from "react-router-dom";
import { useLoaderData } from "react-router-dom";
import { Container } from "@mui/material";

import {
    fetchTestReportsMultiTenant,
    type TestReportsLoadResult,
} from "../../features/testReports/api/testReportsClient";
import { TestReportsOverviewPage } from "../../features/testReports/components/TestReportsOverviewPage";
import { ValidationErrorDisplay } from "../../features/scans/components/ValidationErrorDisplay";
import { findTenantByUrlPath } from "../../config/tenantMode";

type LoaderData = {
    result: TestReportsLoadResult;
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

    const result = await fetchTestReportsMultiTenant(tenant.id);

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
