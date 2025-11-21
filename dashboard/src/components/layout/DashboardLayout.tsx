/**
 * Reusable dashboard layout with sidebar navigation and app bar.
 * Can be used across multiple routes for consistent UI.
 */

import type { ReactNode } from "react";
import { Link as RouterLink, useLocation, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
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
import { isMultiTenant, findTenantByGitHub, type MultiTenantEntry } from "../../config/tenantMode";

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
    const { orgSlug, repoSlug } = useParams<{
        orgSlug?: string;
        repoSlug?: string;
    }>();

    const [tenant, setTenant] = useState<MultiTenantEntry | null>(null);

    useEffect(() => {
        if (orgSlug && repoSlug && isMultiTenant()) {
            const found = findTenantByGitHub(orgSlug, repoSlug);
            setTenant(found || null);
        }
    }, [orgSlug, repoSlug]);

    const basePath =
        orgSlug && repoSlug
            ? `/org/${orgSlug}/repo/${repoSlug}`
            : null;

    // Build title with display names and GitHub links
    const renderTitle = () => {
        if (!orgSlug || !repoSlug) {
            return "Security scan dashboard";
        }

        const orgDisplayName = tenant?.org_display_name;
        const repoDisplayName = tenant?.display_name;
        const logoUrl = tenant?.logo_url;

        return (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                {/* Logo if available */}
                {logoUrl && (
                    <img
                        src={logoUrl}
                        alt={orgDisplayName || orgSlug}
                        style={{
                            height: "32px",
                            width: "auto",
                            objectFit: "contain",
                        }}
                    />
                )}

                {/* Org display name or GitHub org */}
                {orgDisplayName ? (
                    <>
                        <span>{orgDisplayName}</span>
                        <span style={{ color: "#656d76" }}>(</span>
                        <a
                            href={`https://github.com/${orgSlug}`}
                            target="_ghorg"
                            style={{ color: "#0969da", textDecoration: "none" }}
                            onMouseOver={(e) => (e.currentTarget.style.textDecoration = "underline")}
                            onMouseOut={(e) => (e.currentTarget.style.textDecoration = "none")}
                        >
                            {orgSlug}
                        </a>
                        <span style={{ color: "#656d76" }}>)</span>
                    </>
                ) : (
                    <a
                        href={`https://github.com/${orgSlug}`}
                        target="_ghorg"
                        style={{ color: "#0969da", textDecoration: "none" }}
                        onMouseOver={(e) => (e.currentTarget.style.textDecoration = "underline")}
                        onMouseOut={(e) => (e.currentTarget.style.textDecoration = "none")}
                    >
                        {orgSlug}
                    </a>
                )}

                <span style={{ color: "#656d76" }}>/</span>

                {/* Repo display name or GitHub repo */}
                {repoDisplayName ? (
                    <>
                        <span>{repoDisplayName}</span>
                        <span style={{ color: "#656d76" }}>(</span>
                        <a
                            href={`https://github.com/${orgSlug}/${repoSlug}`}
                            target="_ghrepo"
                            style={{ color: "#0969da", textDecoration: "none" }}
                            onMouseOver={(e) => (e.currentTarget.style.textDecoration = "underline")}
                            onMouseOut={(e) => (e.currentTarget.style.textDecoration = "none")}
                        >
                            {repoSlug}
                        </a>
                        <span style={{ color: "#656d76" }}>)</span>
                    </>
                ) : (
                    <a
                        href={`https://github.com/${orgSlug}/${repoSlug}`}
                        target="_ghrepo"
                        style={{ color: "#0969da", textDecoration: "none" }}
                        onMouseOver={(e) => (e.currentTarget.style.textDecoration = "underline")}
                        onMouseOut={(e) => (e.currentTarget.style.textDecoration = "none")}
                    >
                        {repoSlug}
                    </a>
                )}

                <span style={{ color: "#656d76" }}>–</span>
                <span>Security dashboard</span>
            </Box>
        );
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
                        const to = basePath ? `${basePath}/${item.path}` : "/";

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
