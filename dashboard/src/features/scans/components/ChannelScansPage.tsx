/**
 * Channel-specific scans page component.
 * Displays all scans for a single channel with detailed table and chart.
 */

import { Link as RouterLink, useParams } from "react-router-dom";
import {
    Box,
    Typography,
    Breadcrumbs,
    Link as MuiLink,
} from "@mui/material";
import HomeIcon from "@mui/icons-material/Home";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import type { ScanMetadata } from "../model/historyTypes";
import { ChannelTable } from "./ChannelTable";
import { parseTimestamp } from "../../../lib/formatTimestamp";

type ChannelScansPageProps = {
    channel: string;
    scans: ScanMetadata[];
};

export function ChannelScansPage({ channel, scans }: ChannelScansPageProps) {
    const { orgSlug, repoSlug } = useParams<{
        orgSlug: string;
        repoSlug: string;
    }>();

    const basePath =
        orgSlug && repoSlug
            ? `/org/${orgSlug}/repo/${repoSlug}`
            : "";

    const securityScansBasePath = basePath
        ? `${basePath}/security-scans`
        : "/";

    // Sort scans by timestamp (newest first)
    const sorted = [...scans].sort((a, b) => {
        const dateA = parseTimestamp(a.timestamp);
        const dateB = parseTimestamp(b.timestamp);
        if (!dateA || !dateB) return 0;
        return dateB.getTime() - dateA.getTime();
    });

    return (
        <Box sx={{ p: 3 }}>
            {/* Breadcrumbs */}
            <Breadcrumbs
                separator={<NavigateNextIcon fontSize="small" />}
                sx={{ mb: 2 }}
            >
                <MuiLink
                    component={RouterLink}
                    to="/"
                    underline="hover"
                    sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
                    color="inherit"
                >
                    <HomeIcon fontSize="small" />
                    Home
                </MuiLink>
                <MuiLink
                    component={RouterLink}
                    to={securityScansBasePath}
                    underline="hover"
                    color="inherit"
                >
                    Security Scans
                </MuiLink>
                <Typography color="text.primary">{channel}</Typography>
            </Breadcrumbs>

            {/* Channel Table with all scans (no row limit) */}
            <ChannelTable
                channel={channel}
                scans={sorted}
                securityScansBasePath={securityScansBasePath}
                showChart={true}
                // No maxRows - show all scans
                // No viewAllLink - we're already on the detail page
            />
        </Box>
    );
}
