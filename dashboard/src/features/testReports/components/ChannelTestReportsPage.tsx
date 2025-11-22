/**
 * Channel-specific test reports page component.
 * Displays all test reports for a single channel.
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
import type { TestReportEntry } from "../model/testReportTypes";
import { ChannelTable } from "./ChannelTable";
import { parseTimestamp } from "../../../lib/formatTimestamp";

type ChannelTestReportsPageProps = {
    channel: string;
    reports: TestReportEntry[];
};

export function ChannelTestReportsPage({ channel, reports }: ChannelTestReportsPageProps) {
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

    // Sort reports by timestamp (newest first)
    const sorted = [...reports].sort((a, b) => {
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
                    to={testReportsBasePath}
                    underline="hover"
                    color="inherit"
                >
                    Test Reports
                </MuiLink>
                <Typography color="text.primary">{channel}</Typography>
            </Breadcrumbs>

            {/* Channel Table with all reports (no row limit) */}
            <ChannelTable
                channel={channel}
                reports={sorted}
                testReportsBasePath={testReportsBasePath}
            />
        </Box>
    );
}
