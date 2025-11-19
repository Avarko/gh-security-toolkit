/**
 * Reusable channel table component with chart and table.
 * Used in both overview page (multiple channels with row limit)
 * and channel detail page (single channel with all rows).
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
    Chip,
    Link,
} from "@mui/material";
import ReactECharts from "echarts-for-react";
import type { ScanMetadata } from "../model/historyTypes";
import { buildChannelChartOption } from "../charts/channelHistoryOptions";
import { severityToChipColor } from "./severity";
import { formatTimestamp } from "../../../lib/formatTimestamp";

export interface ChannelTableProps {
    /** Channel name for display */
    channel: string;
    /** Array of scan metadata for this channel */
    scans: ScanMetadata[];
    /** Base path for security scans (e.g., /org/foo/repo/bar/security-scans) */
    securityScansBasePath: string;
    /** Maximum number of rows to display in table. If undefined, shows all rows. */
    maxRows?: number;
    /** Whether to show the chart. Default: true */
    showChart?: boolean;
    /** Link to view all scans for this channel. If provided, shows "View All →" link */
    viewAllLink?: string;
}

export function ChannelTable({
    channel,
    scans,
    securityScansBasePath,
    maxRows,
    showChart = true,
    viewAllLink,
}: ChannelTableProps) {
    // Display the most recent scans (limited by maxRows if specified)
    const displayScans = maxRows ? scans.slice(0, maxRows) : scans;

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
                        borderBottom: "3px solid #2196f3",
                        display: "inline-block",
                        pb: 0.5,
                    }}
                >
                    {channel}
                </Typography>
                <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
                    <Typography variant="body2" color="text.secondary">
                        {scans.length} total scan{scans.length !== 1 ? "s" : ""}
                    </Typography>
                    {scans[0] && (
                        <Typography variant="body2" color="text.secondary">
                            Latest: {formatTimestamp(scans[0].timestamp)}
                        </Typography>
                    )}
                    {viewAllLink && (
                        <Link component={RouterLink} to={viewAllLink} underline="hover">
                            View All →
                        </Link>
                    )}
                </Box>
            </Box>

            {/* Chart */}
            {showChart && scans.length > 0 && (
                <Box sx={{ mb: 3 }}>
                    <ReactECharts
                        option={buildChannelChartOption(scans)}
                        style={{ height: 300 }}
                        theme="dark"
                    />
                </Box>
            )}

            {/* Table */}
            {displayScans.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 3 }}>
                    No scan data available
                </Typography>
            ) : (
                <TableContainer sx={{ maxHeight: 600 }}>
                    <Table size="small" stickyHeader>
                        <TableHead>
                            <TableRow>
                                <TableCell rowSpan={2} sx={{ fontWeight: 600 }}>
                                    Timestamp
                                </TableCell>
                                <TableCell rowSpan={2} sx={{ fontWeight: 600 }}>
                                    Branch & Commit
                                </TableCell>
                                <TableCell
                                    colSpan={4}
                                    align="center"
                                    sx={{
                                        fontWeight: 600,
                                        borderBottom: "1px solid rgba(255,255,255,0.1)",
                                    }}
                                >
                                    Trivy FS Vulnerabilities
                                </TableCell>
                                <TableCell
                                    colSpan={4}
                                    align="center"
                                    sx={{
                                        fontWeight: 600,
                                        borderBottom: "1px solid rgba(255,255,255,0.1)",
                                    }}
                                >
                                    Trivy Image Vulnerabilities
                                </TableCell>
                                <TableCell
                                    colSpan={3}
                                    align="center"
                                    sx={{
                                        fontWeight: 600,
                                        borderBottom: "1px solid rgba(255,255,255,0.1)",
                                    }}
                                >
                                    Semgrep
                                </TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell align="center" sx={{ fontSize: "0.75rem" }}>
                                    C
                                </TableCell>
                                <TableCell align="center" sx={{ fontSize: "0.75rem" }}>
                                    H
                                </TableCell>
                                <TableCell align="center" sx={{ fontSize: "0.75rem" }}>
                                    M
                                </TableCell>
                                <TableCell align="center" sx={{ fontSize: "0.75rem" }}>
                                    L
                                </TableCell>
                                <TableCell align="center" sx={{ fontSize: "0.75rem" }}>
                                    C
                                </TableCell>
                                <TableCell align="center" sx={{ fontSize: "0.75rem" }}>
                                    H
                                </TableCell>
                                <TableCell align="center" sx={{ fontSize: "0.75rem" }}>
                                    M
                                </TableCell>
                                <TableCell align="center" sx={{ fontSize: "0.75rem" }}>
                                    L
                                </TableCell>
                                <TableCell align="center" sx={{ fontSize: "0.75rem" }}>
                                    E
                                </TableCell>
                                <TableCell align="center" sx={{ fontSize: "0.75rem" }}>
                                    W
                                </TableCell>
                                <TableCell align="center" sx={{ fontSize: "0.75rem" }}>
                                    I
                                </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {displayScans.map((scan) => (
                                <TableRow key={`${channel}-${scan.timestamp}`} hover>
                                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                                        <Link
                                            component={RouterLink}
                                            to={`${securityScansBasePath}/channel/${channel}/run/${scan.timestamp}`}
                                            underline="hover"
                                        >
                                            {formatTimestamp(scan.timestamp)}
                                        </Link>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                                            {scan.metadata?.branch}
                                        </Typography>
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            sx={{ fontFamily: "monospace" }}
                                        >
                                            {scan.metadata?.commit?.substring(0, 7)}
                                        </Typography>
                                    </TableCell>
                                    {/* Trivy FS */}
                                    <TableCell align="center">
                                        <Chip
                                            label={
                                                scan.trivyFsResults?.totalVulnerabilities?.CRITICAL || 0
                                            }
                                            color={severityToChipColor(
                                                "CRITICAL",
                                                scan.trivyFsResults?.totalVulnerabilities?.CRITICAL || 0
                                            )}
                                            size="small"
                                        />
                                    </TableCell>
                                    <TableCell align="center">
                                        <Chip
                                            label={scan.trivyFsResults?.totalVulnerabilities?.HIGH || 0}
                                            color={severityToChipColor(
                                                "HIGH",
                                                scan.trivyFsResults?.totalVulnerabilities?.HIGH || 0
                                            )}
                                            size="small"
                                        />
                                    </TableCell>
                                    <TableCell align="center">
                                        <Chip
                                            label={
                                                scan.trivyFsResults?.totalVulnerabilities?.MEDIUM || 0
                                            }
                                            color={severityToChipColor(
                                                "MEDIUM",
                                                scan.trivyFsResults?.totalVulnerabilities?.MEDIUM || 0
                                            )}
                                            size="small"
                                        />
                                    </TableCell>
                                    <TableCell align="center">
                                        <Chip
                                            label={scan.trivyFsResults?.totalVulnerabilities?.LOW || 0}
                                            color={severityToChipColor(
                                                "LOW",
                                                scan.trivyFsResults?.totalVulnerabilities?.LOW || 0
                                            )}
                                            size="small"
                                        />
                                    </TableCell>
                                    {/* Trivy Image */}
                                    <TableCell align="center">
                                        <Chip
                                            label={
                                                scan.trivyImageResults?.totalVulnerabilities
                                                    ?.CRITICAL || 0
                                            }
                                            color={severityToChipColor(
                                                "CRITICAL",
                                                scan.trivyImageResults?.totalVulnerabilities
                                                    ?.CRITICAL || 0
                                            )}
                                            size="small"
                                        />
                                    </TableCell>
                                    <TableCell align="center">
                                        <Chip
                                            label={
                                                scan.trivyImageResults?.totalVulnerabilities?.HIGH || 0
                                            }
                                            color={severityToChipColor(
                                                "HIGH",
                                                scan.trivyImageResults?.totalVulnerabilities?.HIGH || 0
                                            )}
                                            size="small"
                                        />
                                    </TableCell>
                                    <TableCell align="center">
                                        <Chip
                                            label={
                                                scan.trivyImageResults?.totalVulnerabilities?.MEDIUM ||
                                                0
                                            }
                                            color={severityToChipColor(
                                                "MEDIUM",
                                                scan.trivyImageResults?.totalVulnerabilities?.MEDIUM ||
                                                0
                                            )}
                                            size="small"
                                        />
                                    </TableCell>
                                    <TableCell align="center">
                                        <Chip
                                            label={
                                                scan.trivyImageResults?.totalVulnerabilities?.LOW || 0
                                            }
                                            color={severityToChipColor(
                                                "LOW",
                                                scan.trivyImageResults?.totalVulnerabilities?.LOW || 0
                                            )}
                                            size="small"
                                        />
                                    </TableCell>
                                    {/* Semgrep */}
                                    <TableCell align="center">
                                        <Chip
                                            label={scan.semgrepResults?.totalErrors || 0}
                                            color={severityToChipColor(
                                                "ERROR",
                                                scan.semgrepResults?.totalErrors || 0
                                            )}
                                            size="small"
                                        />
                                    </TableCell>
                                    <TableCell align="center">
                                        <Chip
                                            label={scan.semgrepResults?.totalWarnings || 0}
                                            color={severityToChipColor(
                                                "WARNING",
                                                scan.semgrepResults?.totalWarnings || 0
                                            )}
                                            size="small"
                                        />
                                    </TableCell>
                                    <TableCell align="center">
                                        <Chip
                                            label={scan.semgrepResults?.totalInfos || 0}
                                            color={severityToChipColor(
                                                "INFO",
                                                scan.semgrepResults?.totalInfos || 0
                                            )}
                                            size="small"
                                        />
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
