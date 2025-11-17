/**
 * Reusable dashboard layout with sidebar navigation and app bar.
 * Can be used across multiple routes for consistent UI.
 */

import type { ReactNode } from "react";
import { Link as RemixLink, useLocation } from "@remix-run/react";
import {
    AppBar,
    Box,
    Container,
    Drawer,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Toolbar,
    Typography,
} from "@mui/material";
import { Security as SecurityIcon } from "@mui/icons-material";
import { ReportFooter } from "./ReportFooter";

const DRAWER_WIDTH = 240;

type DashboardLayoutProps = {
    children: ReactNode;
};

type NavItem = {
    label: string;
    to: string;
    icon: ReactNode;
    // Future: could add "section" or "group" for categorization
};

const NAV_ITEMS: NavItem[] = [
    {
        label: "Security Scans",
        to: "/",
        icon: <SecurityIcon />,
    },
    // Future navigation items:
    // { label: "Test Runs", to: "/tests", icon: <ScienceIcon /> },
];

export function DashboardLayout({ children }: DashboardLayoutProps) {
    const location = useLocation();

    return (
        <Box sx={{ display: "flex" }}>
            {/* AppBar */}
            <AppBar
                position="fixed"
                sx={{
                    width: `calc(100% - ${DRAWER_WIDTH}px)`,
                    ml: `${DRAWER_WIDTH}px`,
                    bgcolor: "background.paper",
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
                    "& .MuiDrawer-paper": {
                        width: DRAWER_WIDTH,
                        boxSizing: "border-box",
                        bgcolor: "background.default",
                        borderRight: "1px solid rgba(63, 81, 181, 0.12)",
                    },
                }}
                variant="permanent"
                anchor="left"
            >
                <Toolbar>
                    <Typography
                        variant="h6"
                        sx={{ fontWeight: 700, color: "primary.main" }}
                    >
                        Menu
                    </Typography>
                </Toolbar>
                <List>
                    {NAV_ITEMS.map((item) => {
                        const isActive =
                            location.pathname === item.to ||
                            (item.to !== "/" && location.pathname.startsWith(item.to));

                        return (
                            <ListItem key={item.to} disablePadding>
                                <ListItemButton
                                    component={RemixLink}
                                    to={item.to}
                                    selected={isActive}
                                >
                                    <ListItemIcon sx={{ color: isActive ? "primary.main" : "inherit" }}>
                                        {item.icon}
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={item.label}
                                        primaryTypographyProps={{
                                            fontWeight: isActive ? 600 : 500,
                                        }}
                                    />
                                </ListItemButton>
                            </ListItem>
                        );
                    })}
                </List>
            </Drawer>

            {/* Main content */}
            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    bgcolor: "background.default",
                    p: 3,
                    minHeight: "100vh",
                }}
            >
                {/* Spacer for AppBar */}
                <Toolbar />
                <Container maxWidth="lg" sx={{ maxWidth: 1200 }}>
                    {children}
                </Container>
                <ReportFooter />
            </Box>
        </Box>
    );
}

