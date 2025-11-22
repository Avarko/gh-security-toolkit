/**
 * Reusable dashboard layout with sidebar navigation and app bar.
 * Can be used across multiple routes for consistent UI.
 *
 * In single-tenant mode (GitHub Pages): Simple layout with static title.
 * In multi-tenant mode: Title shows tenant branding from multi-tenant config.
 */

import type { ReactNode } from "react";
import { Link as RouterLink, useLocation, useParams } from "react-router-dom";
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
import { Security as SecurityIcon, Science as ScienceIcon } from "@mui/icons-material";
import { ReportFooter } from "./ReportFooter";
import {
    isSingleTenant,
    isMultiTenant,
    findTenantByUrlPath,
    type MultiTenantEntry,
} from "../../config/tenantMode";

const DRAWER_WIDTH = 240;

type DashboardLayoutProps = {
    children: ReactNode;
};

type NavItem = {
    label: string;
    path: string;
    icon: ReactNode;
};

const NAV_ITEMS: NavItem[] = [
    {
        label: "Security scans",
        path: "security-scans",
        icon: <SecurityIcon />,
    },
    {
        label: "Test reports",
        path: "test-reports",
        icon: <ScienceIcon />,
    },
];

export function DashboardLayout({ children }: DashboardLayoutProps) {
    const location = useLocation();
    const { tenantPath } = useParams<{ tenantPath?: string }>();

    // Resolve tenant info in multi-tenant mode
    let tenant: MultiTenantEntry | undefined;
    if (isMultiTenant() && tenantPath) {
        tenant = findTenantByUrlPath(tenantPath);
    }

    // Build base path for navigation links
    const basePath = isMultiTenant() && tenantPath ? `/${tenantPath}` : "";

    // Build title based on tenant mode
    const renderTitle = () => {
        if (isSingleTenant()) {
            return "Security dashboard";
        }

        // Multi-tenant mode: show tenant branding if available
        if (tenant) {
            const { org_display_name, display_name, logo_url, github_org, github_repo } = tenant;

            return (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    {/* Logo if available */}
                    {logo_url && (
                        <img
                            src={logo_url}
                            alt={org_display_name || github_org}
                            style={{
                                height: "32px",
                                width: "auto",
                                objectFit: "contain",
                            }}
                        />
                    )}

                    {/* Org display name or GitHub org */}
                    {org_display_name ? (
                        <>
                            <span>{org_display_name}</span>
                            <span style={{ color: "#656d76" }}>(</span>
                            <a
                                href={`https://github.com/${github_org}`}
                                target="_ghorg"
                                style={{ color: "#0969da", textDecoration: "none" }}
                                onMouseOver={(e) => (e.currentTarget.style.textDecoration = "underline")}
                                onMouseOut={(e) => (e.currentTarget.style.textDecoration = "none")}
                            >
                                {github_org}
                            </a>
                            <span style={{ color: "#656d76" }}>)</span>
                        </>
                    ) : (
                        <a
                            href={`https://github.com/${github_org}`}
                            target="_ghorg"
                            style={{ color: "#0969da", textDecoration: "none" }}
                            onMouseOver={(e) => (e.currentTarget.style.textDecoration = "underline")}
                            onMouseOut={(e) => (e.currentTarget.style.textDecoration = "none")}
                        >
                            {github_org}
                        </a>
                    )}

                    <span style={{ color: "#656d76" }}>/</span>

                    {/* Repo display name or GitHub repo */}
                    {display_name ? (
                        <>
                            <span>{display_name}</span>
                            <span style={{ color: "#656d76" }}>(</span>
                            <a
                                href={`https://github.com/${github_org}/${github_repo}`}
                                target="_ghrepo"
                                style={{ color: "#0969da", textDecoration: "none" }}
                                onMouseOver={(e) => (e.currentTarget.style.textDecoration = "underline")}
                                onMouseOut={(e) => (e.currentTarget.style.textDecoration = "none")}
                            >
                                {github_repo}
                            </a>
                            <span style={{ color: "#656d76" }}>)</span>
                        </>
                    ) : (
                        <a
                            href={`https://github.com/${github_org}/${github_repo}`}
                            target="_ghrepo"
                            style={{ color: "#0969da", textDecoration: "none" }}
                            onMouseOver={(e) => (e.currentTarget.style.textDecoration = "underline")}
                            onMouseOut={(e) => (e.currentTarget.style.textDecoration = "none")}
                        >
                            {github_repo}
                        </a>
                    )}

                    <span style={{ color: "#656d76" }}>–</span>
                    <span>Security dashboard</span>
                </Box>
            );
        }

        // Multi-tenant mode but no tenant found
        return "Security dashboard";
    };

    return (
        <Box sx={{ display: "flex" }}>
            {/* AppBar */}
            <AppBar
                position="fixed"
                elevation={0}
                sx={{
                    width: `calc(100% - ${DRAWER_WIDTH}px)`,
                    ml: `${DRAWER_WIDTH}px`,
                    bgcolor: "#ffffff",
                    borderBottom: "1px solid #d0d7de",
                }}
            >
                <Toolbar>
                    <Typography
                        variant="h6"
                        noWrap
                        component="div"
                        sx={{
                            color: "text.primary",
                            fontWeight: 600,
                        }}
                    >
                        {renderTitle()}
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
                        bgcolor: "#f6f8fa",
                        borderRight: "1px solid #d0d7de",
                    },
                }}
                variant="permanent"
                anchor="left"
            >
                <Toolbar>
                    <Typography
                        variant="h6"
                        sx={{ fontWeight: 600, color: "text.primary" }}
                    >
                        Menu
                    </Typography>
                </Toolbar>
                <List>
                    {NAV_ITEMS.map((item) => {
                        const to = basePath ? `${basePath}/${item.path}` : `/${item.path}`;

                        const isActive =
                            location.pathname === to ||
                            location.pathname.startsWith(`${to}/`);

                        return (
                            <ListItem key={item.label} disablePadding>
                                <ListItemButton
                                    component={RouterLink}
                                    to={to}
                                    selected={isActive}
                                >
                                    <ListItemIcon
                                        sx={{
                                            color: isActive ? "primary.main" : "inherit",
                                        }}
                                    >
                                        {item.icon}
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={item.label}
                                        slotProps={{
                                            primary: {
                                                sx: {
                                                    fontWeight: isActive ? 600 : 500,
                                                },
                                            },
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
                    bgcolor: "#ffffff",
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
