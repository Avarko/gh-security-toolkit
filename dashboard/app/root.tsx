// app/root.tsx
import type { MetaFunction, LinksFunction } from "@remix-run/node";
import {
    Links,
    Meta,
    Outlet,
    Scripts,
    ScrollRestoration,
} from "@remix-run/react";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { theme } from "./theme";
import { DashboardLayout } from "./components/layout/DashboardLayout";

export const meta: MetaFunction = () => [
    { title: "Security Scan Dashboard" },
    { name: "viewport", content: "width=device-width,initial-scale=1" },
];

export const links: LinksFunction = () => [
    {
        rel: "stylesheet",
        href:
            "https://fonts.googleapis.com/css2?" +
            "family=Roboto:wght@300;400;500;700&display=swap",
    },
];

function Document({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <Meta />
                <Links />
            </head>
            <body>
                {children}
                <ScrollRestoration />
                <Scripts />
            </body>
        </html>
    );
}

export default function App() {
    return (
        <Document>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                <DashboardLayout>
                    <Outlet />
                </DashboardLayout>
            </ThemeProvider>
        </Document>
    );
}

export function HydrateFallback() {
    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <DashboardLayout>
                <main style={{ padding: 24 }}>
                    <p>Loading Security Scan Dashboard&hellip;</p>
                </main>
            </DashboardLayout>
        </ThemeProvider>
    );
}
