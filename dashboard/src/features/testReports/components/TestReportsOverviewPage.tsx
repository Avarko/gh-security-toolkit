/**
 * Main test reports overview page component.
 * Displays all channels with their test report history.
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
import type { TestReportHistory, TestReportEntry } from "../model/testReportTypes";
import { ChannelTable } from "./ChannelTable";
import { parseTimestamp } from "../../../lib/formatTimestamp";

interface TestReportsOverviewPageProps {
    history: TestReportHistory;
    tenantId: string;
}

export function TestReportsOverviewPage({ history, tenantId }: TestReportsOverviewPageProps) {
    const { orgSlug, repoSlug } = useParams<{
        orgSlug: string;
        repoSlug: string;
    }>();

    const basePath =
        orgSlug && repoSlug
            ? `/org/${orgSlug}/repo/${repoSlug}`
            : "";

    const testReportsBasePath = basePath
        ? `${basePath}/test-reports`
        : "/";

    // Group reports by channel and sort each channel's reports by timestamp (newest first)
    const channelGroups = useMemo(() => {
        const groups: { [channel: string]: TestReportEntry[] } = {};
        if (!history?.reports) {
            return groups;
        }
        history.reports.forEach((report) => {
            const ch = report.channel;
            if (!groups[ch]) {
                groups[ch] = [];
            }
            groups[ch]!.push(report);
        });
        // Sort each channel's reports by timestamp (newest first)
        Object.keys(groups).forEach((channel) => {
            groups[channel]!.sort((a, b) => {
                const dateA = parseTimestamp(a.timestamp);
                const dateB = parseTimestamp(b.timestamp);
                if (!dateA || !dateB) return 0;
                return dateB.getTime() - dateA.getTime();
            });
        });
        return groups;
    }, [history?.reports]);

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
                <Typography color="text.primary">Test Reports</Typography>
            </Breadcrumbs>

            {/* Channel Tables */}
            {Object.keys(channelGroups).length === 0 ? (
                <Paper sx={{ p: 4, textAlign: "center" }}>
                    <Typography variant="h6" color="text.secondary">
                        No test report data available
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Test report history will appear here once data is available.
                    </Typography>
                </Paper>
            ) : (
                Object.entries(channelGroups).map(([channel, reports]) => (
                    <ChannelTable
                        key={channel}
                        channel={channel}
                        reports={reports}
                        tenantId={tenantId}
                        testReportsBasePath={testReportsBasePath}
                        maxRows={5}
                        viewAllLink={`${testReportsBasePath}/channel/${channel}`}
                    />
                ))
            )}
        </Box>
    );
}
