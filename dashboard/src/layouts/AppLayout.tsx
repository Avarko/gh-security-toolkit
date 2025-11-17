import React from "react";
import { Outlet, useParams, Link as RouterLink } from "react-router-dom";
import { Box, Tabs, Tab, Toolbar, Typography } from "@mui/material";

export function AppLayout() {
    const { orgSlug, appSlug, repoSlug } = useParams();

    const base = repoSlug
        ? `/org/${orgSlug}/app/${appSlug}/repo/${repoSlug}`
        : `/org/${orgSlug}/app/${appSlug}`;

    const tabs = [
        { label: "Overview", to: base },
        { label: "Security Scans", to: `${base}/security-scans` },
        { label: "Test Reports", to: `${base}/test-reports` },
        { label: "Cloud Findings", to: `${base}/cloud-findings` },
    ];

    return (
        <Box>
            <Toolbar>
                <Typography variant="h5">
                    {appSlug}
                </Typography>
            </Toolbar>

            <Tabs value={false}>
                {tabs.map(t => (
                    <Tab
                        key={t.to}
                        label={t.label}
                        component={RouterLink}
                        to={t.to}
                    />
                ))}
            </Tabs>

            <Box sx={{ mt: 3 }}>
                <Outlet />
            </Box>
        </Box>
    );
}
