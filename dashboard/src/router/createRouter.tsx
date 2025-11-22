// src/router/createRouter.tsx
/**
 * Unified router factory for single and multi-tenant modes.
 *
 * Single-tenant (GitHub Pages):
 *   /security-scans
 *   /security-scans/channel/:channel
 *   /security-scans/channel/:channel/run/:timestamp
 *   /test-reports
 *   /test-reports/channel/:channel
 *
 * Multi-tenant (S3/CDN):
 *   /:tenantPath/security-scans
 *   /:tenantPath/security-scans/channel/:channel
 *   /:tenantPath/security-scans/channel/:channel/run/:timestamp
 *   /:tenantPath/test-reports
 *   /:tenantPath/test-reports/channel/:channel
 */
import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import type { RouteObject } from "react-router-dom";

import { AppShell } from "../App";
import { isSingleTenant, getAllTenants } from "../config/tenantMode";

// Routes (shared between modes)
import {
    SecurityScansIndexRoute,
    securityScansIndexLoader,
    ChannelScansRoute,
    channelScansLoader,
    ChannelScanRunDetailRoute,
    channelScanRunDetailLoader,
    TestReportsIndexRoute,
    testReportsLoader,
    ChannelTestReportsRoute,
    channelTestReportsLoader,
} from "../routes";
import ScanRunDetailErrorPage from "../features/scans/components/ScanRunDetailErrorPage";

const NotFoundPage = () => <div>404 - Page not found</div>;

/**
 * Shared route definitions (used in both modes).
 */
function getSharedRoutes(): RouteObject[] {
    return [
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
    ];
}

/**
 * Tenant selector page (multi-tenant root).
 */
function TenantSelectorPage() {
    const tenants = getAllTenants();

    if (tenants.length === 0) {
        return <div>No tenants configured</div>;
    }

    return (
        <div style={{ padding: 20 }}>
            <h1>Select Tenant</h1>
            <ul>
                {tenants.map((t) => (
                    <li key={t.id}>
                        <a href={`/${t.url_path}/security-scans`}>
                            {t.display_name}
                        </a>
                    </li>
                ))}
            </ul>
        </div>
    );
}

/**
 * Create router based on tenant mode.
 */
export function createRouter() {
    if (isSingleTenant()) {
        return createSingleTenantRouter();
    }
    return createMultiTenantRouter();
}

function createSingleTenantRouter() {
    return createBrowserRouter([
        {
            path: "/",
            element: <AppShell />,
            children: [
                // Root redirects to security scans
                {
                    index: true,
                    element: <Navigate to="/security-scans" replace />,
                },
                ...getSharedRoutes(),
                // 404 fallback
                {
                    path: "*",
                    element: <NotFoundPage />,
                },
            ],
        },
    ]);
}

function createMultiTenantRouter() {
    return createBrowserRouter([
        {
            path: "/",
            element: <AppShell />,
            children: [
                // Root: tenant selector
                {
                    index: true,
                    element: <TenantSelectorPage />,
                },
                // Tenant-scoped routes
                {
                    path: ":tenantPath",
                    element: <Outlet />,
                    children: [
                        // Redirect /:tenantPath to /:tenantPath/security-scans
                        {
                            index: true,
                            element: <Navigate to="security-scans" replace />,
                        },
                        ...getSharedRoutes(),
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
