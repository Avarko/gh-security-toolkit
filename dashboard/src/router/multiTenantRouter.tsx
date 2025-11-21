// src/router/multiTenantRouter.tsx
/**
 * Router configuration for multi-tenant mode (S3/CDN deployment).
 *
 * In multi-tenant mode:
 * - URLs are prefixed with /:tenantPath/ (admin-defined, human-readable)
 * - Data is stored at /data/<uuid>/ per tenant
 * - Root path "/" shows tenant selector or 404
 *
 * URL structure:
 *   /                                              → Tenant selector / 404
 *   /:tenantPath/security-scans                    → Scan overview
 *   /:tenantPath/security-scans/channel/:channel   → Channel history
 *   /:tenantPath/security-scans/channel/:channel/run/:timestamp → Scan detail
 *   /:tenantPath/test-reports                      → Test reports overview
 *   /:tenantPath/test-reports/channel/:channel     → Channel test reports
 *
 * The tenantPath is admin-defined and human-readable (e.g., "fr-ciam" instead of a GUID).
 * It maps to a tenant entry in the multi-tenant config, which contains the GUID for data access.
 */
import { createBrowserRouter } from "react-router-dom";

import { AppShell } from "../App";

// Multi-tenant specific routes
import MultiTenantRootIndex, {
    loader as rootIndexLoader,
} from "../routes/multiTenant/RootIndex";
import TenantLayout, {
    loader as tenantLayoutLoader,
} from "../routes/multiTenant/TenantLayout";

// Security scans routes (multi-tenant versions)
import SecurityScansIndexRoute, {
    loader as securityScansIndexLoader,
} from "../routes/multiTenant/SecurityScansIndexRoute";
import ChannelScansRoute, {
    loader as channelScansLoader,
} from "../routes/multiTenant/ChannelScansRoute";
import ChannelScanRunDetailRoute, {
    loader as channelScanRunDetailLoader,
} from "../routes/multiTenant/ChannelScanRunDetailRoute";
import ScanRunDetailErrorPage from "../features/scans/components/ScanRunDetailErrorPage";

// Test reports routes (multi-tenant versions)
import TestReportsIndexRoute, {
    loader as testReportsLoader,
} from "../routes/multiTenant/TestReportsIndexRoute";
import ChannelTestReportsRoute, {
    loader as channelTestReportsLoader,
} from "../routes/multiTenant/ChannelTestReportsRoute";

const NotFoundPage = () => <div>404 - Page not found</div>;

export function createMultiTenantRouter() {
    return createBrowserRouter([
        {
            path: "/",
            element: <AppShell />,
            children: [
                // Root: tenant selector or 404
                {
                    index: true,
                    element: <MultiTenantRootIndex />,
                    loader: rootIndexLoader,
                },

                // Tenant-scoped routes
                {
                    path: ":tenantPath",
                    element: <TenantLayout />,
                    loader: tenantLayoutLoader,
                    children: [
                        // Security scans section
                        {
                            path: "security-scans",
                            children: [
                                {
                                    index: true,
                                    element: <SecurityScansIndexRoute />,
                                    loader: securityScansIndexLoader,
                                },
                                {
                                    path: "channel/:channel",
                                    element: <ChannelScansRoute />,
                                    loader: channelScansLoader,
                                },
                                {
                                    path: "channel/:channel/run/:timestamp",
                                    element: <ChannelScanRunDetailRoute />,
                                    loader: channelScanRunDetailLoader,
                                    errorElement: <ScanRunDetailErrorPage />,
                                },
                            ],
                        },

                        // Test reports section
                        {
                            path: "test-reports",
                            children: [
                                {
                                    index: true,
                                    element: <TestReportsIndexRoute />,
                                    loader: testReportsLoader,
                                },
                                {
                                    path: "channel/:channel",
                                    element: <ChannelTestReportsRoute />,
                                    loader: channelTestReportsLoader,
                                },
                            ],
                        },
                    ],
                },

                // 404 fallback
                {
                    path: "*",
                    element: <NotFoundPage />,
                },
            ],
        },
    ]);
}
