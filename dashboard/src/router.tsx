// src/router.tsx
import React from "react";
import { createBrowserRouter } from "react-router-dom";

import { AppShell } from "./App";

import RootIndex, {
    loader as rootIndexLoader,
} from "./routes/RootIndex";

import { OrgLayout } from "./layouts/OrgLayout";
import AppOverviewPage from "./routes/org/app/AppOverviewPage";
import OrgOverviewPage from "./routes/org/OrgOverviewPage";
import SecurityScansIndexRoute, {
    loader as securityScansIndexLoader,
} from "./routes/org/app/security-scans/SecurityScansIndexRoute";
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
                        path: "app/:appSlug",
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
                                            },
                                        ],
                                    },
                                    // TODO add later test-reports, cloud-findings etc.
                                ],
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
