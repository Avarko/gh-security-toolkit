// src/router.tsx
import React from "react";
import { createBrowserRouter } from "react-router-dom";

import { AppShell } from "./App";

// UUSI:
import RootIndex, {
    loader as rootIndexLoader,
} from "./routes/RootIndex";

// Nämä oletan olevan jo olemassa:
import { OrgLayout } from "./layouts/OrgLayout";
import AppOverviewPage from "./routes/org/app/AppOverviewPage";
import OrgOverviewPage from "./routes/org/OrgOverviewPage";
import SecurityScansIndexRoute, {
    loader as securityScansIndexLoader,
} from "./routes/org/app/security-scans/SecurityScansIndexRoute";
import SecurityScansLayout from "./layouts/SecurityScansLayout";
import SecurityScanOverviewPage from "./routes/org/app/security-scans/SecurityScanOverviewPage";
import ChannelScansRoute, {
    loader as channelScansLoader,
} from "./routes/org/app/security-scans/ChannelScansRoute";
import ChannelScanRunDetailRoute, {
    loader as channelScanRunDetailLoader,
} from "./routes/org/app/security-scans/ChannelScanRunDetailRoute";


// TODO
const TestReportsPage = () => <div>TODO: Test Reports</div>;
const CloudFindingsPage = () => <div>TODO: Cloud Findings</div>;
const NotFoundPage = () => <div>404 – Page not found</div>;

export const router = createBrowserRouter([
    {
        path: "/",
        element: <AppShell />, // ThemeProvider + CssBaseline + <Outlet />
        children: [
            // Root path "/"
            {
                index: true,
                element: <RootIndex />,
                loader: rootIndexLoader,
            },
            {
                path: "org/:orgSlug",
                element: <OrgLayout />,
                children: [
                    {
                        index: true,
                        element: <OrgOverviewPage />,
                    },
                    {
                        path: "app/:appSlug",
                        children: [
                            {
                                index: true,
                                element: <AppOverviewPage />,
                            },
                            {
                                path: "security-scans",
                                element: <SecurityScansLayout />,
                                children: [
                                    {
                                        index: true,
                                        element: <SecurityScansIndexRoute />,
                                        loader: securityScansIndexLoader,
                                    },
                                    {
                                        path: "channel/:channel",
                                        loader: channelScansLoader,
                                        element: <ChannelScansRoute />,
                                    },
                                    {
                                        path: "channel/:channel/run/:timestamp",
                                        loader: channelScanRunDetailLoader,
                                        element: <ChannelScanRunDetailRoute />,
                                    },
                                ],
                            },
                            {
                                path: "test-reports",
                                element: <TestReportsPage />,
                            },
                            {
                                path: "cloud-findings",
                                element: <CloudFindingsPage />,
                            },
                            // TODO repo/:repoSlug routing
                        ],
                    },
                ],
            },
            {
                path: "*",
                element: <NotFoundPage />,
            },
        ],
    },
]);
