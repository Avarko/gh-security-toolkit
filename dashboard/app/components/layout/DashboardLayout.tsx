/**
 * Reusable dashboard layout with sidebar navigation and app bar.
 * Can be used across multiple routes for consistent UI.
 */

import { Link as RemixLink } from "@remix-run/react";
import {
    Box,
    Drawer,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Toolbar,
    AppBar,
    Typography,
} from "@mui/material";
import { Security as SecurityIcon } from "@mui/icons-material";
import type { ReactNode } from "react";

const DRAWER_WIDTH = 240;

interface DashboardLayoutProps {
    children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
    return (
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
                {children}
            </Box>
        </Box>
    );
}
