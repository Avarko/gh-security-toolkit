import {
    Links,
    Meta,
    Outlet,
    Scripts,
    ScrollRestoration,
} from "@remix-run/react";
import { createTheme, ThemeProvider, CssBaseline } from "@mui/material";

const theme = createTheme({
    palette: {
        mode: 'dark',
        primary: {
            main: '#3f51b5',
        },
        secondary: {
            main: '#f50057',
        },
        background: {
            default: '#0a1929',
            paper: '#132f4c',
        },
        error: {
            main: '#ef5350',
        },
        warning: {
            main: '#ff9800',
        },
        success: {
            main: '#66bb6a',
        },
    },
    typography: {
        fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    },
});

export default function App() {
    return (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
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
                    <Outlet />
                </ThemeProvider>
                <ScrollRestoration />
                <Scripts />
            </body>
        </html>
    );
}
