// src/router.tsx
import React from "react";
import { createBrowserRouter } from "react-router-dom";

import { AppShell } from "./App";

// routes
import IndexPage, {
    loader as indexLoader,
} from "./routes/Index";
import ChannelScansRoute, {
    loader as channelScansLoader,
} from "./routes/scans/ChannelScansRoute";
import ChannelScanRunDetailRoute, {
    loader as channelScanRunDetailLoader,
} from "./routes/scans/ChannelScanRunDetailRoute";

export const router = createBrowserRouter([
    {
        path: "/",
        element: <AppShell />,
        children: [
            {
                index: true,
                element: <IndexPage />,
                loader: indexLoader,
            },
            {
                path: "scans/:channel",
                element: <ChannelScansRoute />,
                loader: channelScansLoader,
            },
            {
                path: "scans/:channel/:timestamp",
                element: <ChannelScanRunDetailRoute />,
                loader: channelScanRunDetailLoader,
            },
        ],
    },
]);
