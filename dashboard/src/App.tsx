// src/App.tsx
import React from "react";
import { Outlet } from "react-router-dom";
import { ThemeProvider, CssBaseline } from "@mui/material";

import { theme } from "./theme";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { TenantProvider } from "./context/TenantContext";

export function AppShell() {
    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <TenantProvider tenant={{ dataRoot: "/data" }}>
                <DashboardLayout>
                    <Outlet />
                </DashboardLayout>
            </TenantProvider>
        </ThemeProvider>
    );
}
