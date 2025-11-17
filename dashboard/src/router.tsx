import React from "react";
import { createBrowserRouter } from "react-router-dom";

import { OrgLayout } from "./layouts/OrgLayout";
import { AppLayout } from "./layouts/AppLayout";
import { RepoLayout } from "./layouts/RepoLayout";

import OrgOverviewPage from "./routes/org/OrgOverviewPage";
import AppOverviewPage from "./routes/org/app/AppOverviewPage";

import SecurityScansLayout from "./layouts/SecurityScansLayout";
import SecurityScanOverviewPage from "./routes/org/app/security-scans/SecurityScanOverviewPage";

import ChannelScansRoute, {
    loader as channelScansLoader,
} from "./routes/org/app/security-scans/ChannelScansRoute";

import ChannelScanRunDetailRoute, {
    loader as channelScanRunDetailLoader,
} from "./routes/org/app/security-scans/ChannelScanRunDetailRoute";

// Placeholder pages for other content areas
const TestReportsPage = () => <div>TODO: Test Reports</div>;
const CloudFindingsPage = () => <div>TODO: Cloud Findings</div>;

export const router = createBrowserRouter([
    {
        path: "/org/:orgSlug",
        element: <OrgLayout />,
        children: [
            {
                index: true,
                element: <OrgOverviewPage />,
            },
            {
                path: "app/:appSlug",
                element: <AppLayout />,
                children: [
                    {
                        index: true,
                        element: <AppOverviewPage />,
                    },

                    // Optional repo section
                    {
                        path: "repo/:repoSlug",
                        element: <RepoLayout />,
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
                                        element: <SecurityScanOverviewPage />,
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
                            { path: "test-reports", element: <TestReportsPage /> },
                            { path: "cloud-findings", element: <CloudFindingsPage /> },
                        ],
                    },

                    // Content areas without repoSlug
                    {
                        path: "security-scans",
                        element: <SecurityScansLayout />,
                        children: [
                            {
                                index: true,
                                element: <SecurityScanOverviewPage />,
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
                    { path: "test-reports", element: <TestReportsPage /> },
                    { path: "cloud-findings", element: <CloudFindingsPage /> },
                ],
            },
        ],
    },
]);
