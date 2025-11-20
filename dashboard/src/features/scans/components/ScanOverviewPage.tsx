/**
 * Main scan overview page component.
 * Displays all channels with their scan history, charts, and tables.
 */

import { useMemo } from "react";
import { Link as RouterLink, useParams } from "react-router-dom";
import {
    Box,
    Typography,
    Breadcrumbs,
    Link,
    Paper,
} from "@mui/material";
import HomeIcon from "@mui/icons-material/Home";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import type { ScanHistory, ScanMetadata } from "../model/historyTypes";
import { ChannelTable } from "./ChannelTable";
import { parseTimestamp } from "../../../lib/formatTimestamp";

interface ScanOverviewPageProps {
    history: ScanHistory;
}

export function ScanOverviewPage({ history }: ScanOverviewPageProps) {
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
        : "/"; // fallback, if params are missing

    // Group scans by channel and sort each channel's scans by timestamp (newest first)
    const channelGroups = useMemo(() => {
        const groups: { [channel: string]: ScanMetadata[] } = {};
        if (!history?.scans) {
            return groups;
        }
        history.scans.forEach((scan) => {
            if (!groups[scan.channel]) {
                groups[scan.channel] = [];
            }
            groups[scan.channel].push(scan);
        });
        // Sort each channel's scans by timestamp (newest first)
        Object.keys(groups).forEach((channel) => {
            groups[channel].sort((a, b) => {
                const dateA = parseTimestamp(a.timestamp);
                const dateB = parseTimestamp(b.timestamp);
                if (!dateA || !dateB) return 0;
                return dateB.getTime() - dateA.getTime();
            });
        });
        return groups;
    }, [history?.scans]);

    return (
        <Box>
            {/* Breadcrumbs */}
            <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} sx={{ mb: 3 }}>
                <Link
                    component={RouterLink}
                    to="/"
                    underline="hover"
                    sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
                    color="inherit"
                >
                    <HomeIcon fontSize="small" />
                    Home
                </Link>
                <Typography color="text.primary">Security Scans</Typography>
            </Breadcrumbs>

            {/* Channel Tables */}
            {Object.keys(channelGroups).length === 0 ? (
                <Paper sx={{ p: 4, textAlign: "center" }}>
                    <Typography variant="h6" color="text.secondary">
                        No scan data available
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Scan history will appear here once data is available.
                    </Typography>
                </Paper>
            ) : (
                Object.entries(channelGroups).map(([channel, scans]) => (
                    <ChannelTable
                        key={channel}
                        channel={channel}
                        scans={scans}
                        securityScansBasePath={securityScansBasePath}
                        maxRows={5}
                        showChart={true}
                        viewAllLink={`${securityScansBasePath}/channel/${channel}`}
                    />
                ))
            )}
        </Box>
    );
}
