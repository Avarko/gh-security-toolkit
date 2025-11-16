import {
    Links,
    Meta,
    Outlet,
    Scripts,
    ScrollRestoration,
    Link as RemixLink,
} from "@remix-run/react";
import { createTheme, ThemeProvider, CssBaseline, Box, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Toolbar, AppBar, Typography } from "@mui/material";
import { Security as SecurityIcon } from "@mui/icons-material";

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

const DRAWER_WIDTH = 240;

// HydrateFallback for client-only mode (ssr: false)
export function HydrateFallback() {
    return (
        <html lang="en">
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <Meta />
                <Links />
                <link
                    rel="stylesheet"
                    href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap"
                />
            </head>
            <body>
                <Scripts />
            </body>
        </html>
    );
}

export default function App() {
    return (
        <html lang="en">
            <head>
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
                    <Box sx={{ display: 'flex' }}>
                        {/* AppBar */}
                        <AppBar
                            position="fixed"
                            sx={{
                                width: `calc(100% - ${DRAWER_WIDTH}px)`,
                                ml: `${DRAWER_WIDTH}px`,
                                bgcolor: 'background.paper',
                            }}
                        >
                            <Toolbar>
                                <Typography variant="h6" noWrap component="div">
                                    Security Scan Dashboard
                                </Typography>
                            </Toolbar>
                        </AppBar>

                        {/* Sidebar */}
                        <Drawer
                            sx={{
                                width: DRAWER_WIDTH,
                                flexShrink: 0,
                                '& .MuiDrawer-paper': {
                                    width: DRAWER_WIDTH,
                                    boxSizing: 'border-box',
                                    bgcolor: 'background.default',
                                    borderRight: '1px solid rgba(63, 81, 181, 0.12)',
                                },
                            }}
                            variant="permanent"
                            anchor="left"
                        >
                            <Toolbar>
                                <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
                                    Menu
                                </Typography>
                            </Toolbar>
                            <List>
                                <ListItem disablePadding>
                                    <ListItemButton component={RemixLink} to="/" selected>
                                        <ListItemIcon>
                                            <SecurityIcon sx={{ color: 'primary.main' }} />
                                        </ListItemIcon>
                                        <ListItemText
                                            primary="Security Scans"
                                            primaryTypographyProps={{
                                                fontWeight: 500
                                            }}
                                        />
                                    </ListItemButton>
                                </ListItem>
                            </List>
                        </Drawer>

                        {/* Main content */}
                        <Box
                            component="main"
                            sx={{
                                flexGrow: 1,
                                bgcolor: 'background.default',
                                p: 3,
                                minHeight: '100vh',
                            }}
                        >
                            <Toolbar /> {/* Spacer for AppBar */}
                            <Outlet />
                        </Box>
                    </Box>
                </ThemeProvider>
                <ScrollRestoration />
                <Scripts />
            </body>
        </html>
    );
}
