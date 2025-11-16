// app/root.tsx
import type { MetaFunction } from "@remix-run/react";
import {
    Links,
    Meta,
    Outlet,
    Scripts,
    ScrollRestoration,
} from "@remix-run/react";
import { ThemeProvider, CssBaseline } from "@mui/material";

import { theme } from "~/theme";
import { DashboardLayout } from "~/components/layout/DashboardLayout";

export const meta: MetaFunction = () => ([
    { charSet: "utf-8" },
    { title: "Security Scan Dashboard" },
    { name: "viewport", content: "width=device-width, initial-scale=1" },
]);

export default function App() {
    return (
        <html lang="en">
            <head>
                <Meta />
                <Links />
                <link
                    rel="stylesheet"
                    href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap"
                />
            </head>
            <body>
                <ThemeProvider theme={theme}>
                    <CssBaseline />
                    <DashboardLayout>
                        <Outlet />
                    </DashboardLayout>
                </ThemeProvider>
                <ScrollRestoration />
                <Scripts />
            </body>
        </html>
    );
}

