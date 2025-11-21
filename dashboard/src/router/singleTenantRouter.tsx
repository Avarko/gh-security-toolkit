// src/router/singleTenantRouter.tsx
/**
 * Router configuration for single-tenant mode (GitHub Pages deployment).
 *
 * In single-tenant mode:
 * - No /org/:org/repo/:repo/ prefix in URLs
 * - Data is stored directly at /data/ (no UUID subdirectory)
 * - Root path "/" redirects directly to /security-scans
 *
 * URL structure:
 *   /                                    → Redirect to /security-scans
 *   /security-scans                      → Scan overview
 *   /security-scans/channel/:channel     → Channel history
 *   /security-scans/channel/:channel/run/:timestamp → Scan detail
 *   /test-reports                        → Test reports overview
 *   /test-reports/channel/:channel       → Channel test reports
 */
import { createBrowserRouter, Navigate } from "react-router-dom";

import { AppShell } from "../App";

// Security scans routes
import SecurityScansIndexRoute, {
    loader as securityScansIndexLoader,
} from "../routes/singleTenant/SecurityScansIndexRoute";
import ChannelScansRoute, {
    loader as channelScansLoader,
} from "../routes/singleTenant/ChannelScansRoute";
import ChannelScanRunDetailRoute, {
    loader as channelScanRunDetailLoader,
} from "../routes/singleTenant/ChannelScanRunDetailRoute";
import ScanRunDetailErrorPage from "../features/scans/components/ScanRunDetailErrorPage";

// Test reports routes
import TestReportsIndexRoute, {
    loader as testReportsLoader,
} from "../routes/singleTenant/TestReportsIndexRoute";
import ChannelTestReportsRoute, {
    loader as channelTestReportsLoader,
} from "../routes/singleTenant/ChannelTestReportsRoute";

const NotFoundPage = () => <div>404 - Page not found</div>;

export function createSingleTenantRouter() {
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

                // 404 fallback
                {
                    path: "*",
                    element: <NotFoundPage />,
                },
            ],
        },
    ]);
}
