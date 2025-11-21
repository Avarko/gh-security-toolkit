// src/router.tsx
import React from "react";
import { createBrowserRouter } from "react-router-dom";

import { AppShell } from "./App";

import RootIndex, {
    loader as rootIndexLoader,
} from "./routes/RootIndex";

import SecurityScansIndexRoute, {
    loader as securityScansIndexLoader,
} from "./routes/org/app/security-scans/SecurityScansIndexRoute";
import ChannelScansRoute, {
    loader as channelScansLoader,
} from "./routes/org/app/security-scans/ChannelScansRoute";
import ChannelScanRunDetailRoute, {
    loader as channelScanRunDetailLoader,
} from "./routes/org/app/security-scans/ChannelScanRunDetailRoute";
import ScanRunDetailErrorPage from "./features/scans/components/ScanRunDetailErrorPage";
import TestReportsIndexRoute, {
    loader as testReportsLoader,
} from "./routes/org/app/test-reports/TestReportsIndexRoute";

const CloudFindingsPage = () => <div>TODO: Cloud findings</div>;
const NotFoundPage = () => <div>404 – Page not found</div>;

export const router = createBrowserRouter([
    {
        path: "/",
        element: <AppShell />,
        children: [
            {
                index: true,
                element: <RootIndex />,
                loader: rootIndexLoader,
            },

            {
                path: "org/:orgSlug",
                children: [
                    {
                        path: "repo/:repoSlug",
                        children: [
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
                            {
                                path: "test-reports",
                                element: <TestReportsIndexRoute />,
                                loader: testReportsLoader,
                            },
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
