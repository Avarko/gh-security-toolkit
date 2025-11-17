// src/App.tsx
import React from "react";
import { Outlet } from "react-router-dom";
import { ThemeProvider, CssBaseline } from "@mui/material";

import { theme } from "./theme";
import { DashboardLayout } from "./components/layout/DashboardLayout";

export function AppShell() {
    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <DashboardLayout>
                <Outlet />
            </DashboardLayout>
        </ThemeProvider>
    );
}
