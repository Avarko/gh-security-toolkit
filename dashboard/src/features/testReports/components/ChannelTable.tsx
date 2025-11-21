/**
 * Reusable channel table component for test reports.
 * Displays timestamp, repository info, and links to JaCoCo/Surefire reports.
 */

import { Link as RouterLink } from "react-router-dom";
import {
    Box,
    Typography,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Link,
    Button,
} from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import BarChartIcon from "@mui/icons-material/BarChart";
import ScienceIcon from "@mui/icons-material/Science";
import type { TestReportEntry } from "../model/testReportTypes";
import { formatTimestamp } from "../../../lib/formatTimestamp";

export interface ChannelTableProps {
    /** Channel name for display */
    channel: string;
    /** Array of test report entries for this channel */
    reports: TestReportEntry[];
    /** Tenant ID (UUID) for building report URLs */
    tenantId: string;
    /** Base path for test reports routing (e.g., /org/foo/repo/bar/test-reports) */
    testReportsBasePath: string;
    /** Maximum number of rows to display in table. If undefined, shows all rows. */
    maxRows?: number;
    /** Link to view all reports for this channel. If provided, shows "View All" link */
    viewAllLink?: string;
}

export function ChannelTable({
    channel,
    reports,
    tenantId,
    testReportsBasePath,
    maxRows,
    viewAllLink,
}: ChannelTableProps) {
    // Display the most recent reports (limited by maxRows if specified)
    const displayReports = maxRows ? reports.slice(0, maxRows) : reports;

    // Build the base URL for report files
    const getReportUrl = (timestamp: string, reportType: "coverage" | "tests") => {
        return `/data/${tenantId}/runs/${channel}/${timestamp}/${reportType}/index.html`;
    };

    return (
        <Paper sx={{ p: 3, mb: 3 }}>
            {/* Header */}
            <Box
                sx={{
                    mb: 2,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}
            >
                <Typography
                    variant="h4"
                    sx={{
                        fontWeight: 500,
                        borderBottom: "3px solid #4caf50",
                        display: "inline-block",
                        pb: 0.5,
                    }}
                >
                    {channel}
                </Typography>
                <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
                    <Typography variant="body2" color="text.secondary">
                        {reports.length} total report{reports.length !== 1 ? "s" : ""}
                    </Typography>
                    {reports[0] && (
                        <Typography variant="body2" color="text.secondary">
                            Latest: {formatTimestamp(reports[0].timestamp)}
                        </Typography>
                    )}
                    {viewAllLink && (
                        <Link component={RouterLink} to={viewAllLink} underline="hover">
                            View All
                        </Link>
                    )}
                </Box>
            </Box>

            {/* Table */}
            {displayReports.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 3 }}>
                    No test report data available
                </Typography>
            ) : (
                <TableContainer sx={{ maxHeight: 600 }}>
                    <Table size="small" stickyHeader>
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 600 }}>Timestamp</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>Repository / Branch</TableCell>
                                <TableCell sx={{ fontWeight: 600 }} align="center">
                                    JaCoCo Coverage
                                </TableCell>
                                <TableCell sx={{ fontWeight: 600 }} align="center">
                                    Surefire Tests
                                </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {displayReports.map((report) => (
                                <TableRow key={`${channel}-${report.timestamp}`} hover>
                                    {/* Timestamp */}
                                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                                        {formatTimestamp(report.timestamp)}
                                    </TableCell>

                                    {/* Repository / Branch / Commit */}
                                    <TableCell>
                                        {report.metadata?.repository && (
                                            <Link
                                                href={`https://github.com/${report.metadata.repository}`}
                                                target="_ghlink"
                                                underline="hover"
                                                sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}
                                            >
                                                {report.metadata.repository}
                                            </Link>
                                        )}
                                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
                                            {report.metadata?.branch && (
                                                <Link
                                                    href={report.metadata?.repository
                                                        ? `https://github.com/${report.metadata.repository}/tree/${report.metadata.branch}`
                                                        : undefined}
                                                    target="_ghlink"
                                                    underline="hover"
                                                    sx={{ fontFamily: "monospace", fontSize: "0.85rem" }}
                                                >
                                                    {report.metadata.branch}
                                                </Link>
                                            )}
                                            {report.metadata?.commit && (
                                                <Link
                                                    href={report.metadata?.repository
                                                        ? `https://github.com/${report.metadata.repository}/commit/${report.metadata.commit}`
                                                        : undefined}
                                                    target="_ghlink"
                                                    underline="hover"
                                                    sx={{
                                                        fontFamily: "monospace",
                                                        fontSize: "0.75rem",
                                                        color: "text.secondary",
                                                    }}
                                                >
                                                    {report.metadata.commit.substring(0, 7)}
                                                </Link>
                                            )}
                                        </Box>
                                    </TableCell>

                                    {/* JaCoCo Coverage Report */}
                                    <TableCell align="center">
                                        {report.hasJacoco ? (
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                color="primary"
                                                startIcon={<BarChartIcon />}
                                                endIcon={<OpenInNewIcon fontSize="small" />}
                                                href={getReportUrl(report.timestamp, "coverage")}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                sx={{ textTransform: "none" }}
                                            >
                                                Coverage
                                            </Button>
                                        ) : (
                                            <Typography variant="body2" color="text.disabled">
                                                -
                                            </Typography>
                                        )}
                                    </TableCell>

                                    {/* Surefire Test Report */}
                                    <TableCell align="center">
                                        {report.hasSurefire ? (
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                color="success"
                                                startIcon={<ScienceIcon />}
                                                endIcon={<OpenInNewIcon fontSize="small" />}
                                                href={getReportUrl(report.timestamp, "tests")}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                sx={{ textTransform: "none" }}
                                            >
                                                Tests
                                            </Button>
                                        ) : (
                                            <Typography variant="body2" color="text.disabled">
                                                -
                                            </Typography>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Paper>
    );
}
