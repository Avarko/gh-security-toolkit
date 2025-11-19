/**
 * Main scan overview page component.
 * Displays all channels with their scan history, charts, and tables.
 */

import { useMemo } from "react";
import { Link as RouterLink, useParams } from "react-router-dom";
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
    Breadcrumbs,
    Link,
} from "@mui/material";
import HomeIcon from "@mui/icons-material/Home";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import ReactECharts from "echarts-for-react";
import type { ScanHistory, ScanMetadata } from "../model/historyTypes";
import { buildChannelChartOption } from "../charts/channelHistoryOptions";
import { severityToChipColor } from "./severity";

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
        Object.keys(groups).forEach((channel) => {
            groups[channel].sort(
                (a, b) =>
                    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
        });
        return groups;
    }, [history?.scans]);

    return (
        <Box sx={{ p: 3 }}>
            {/* Hero Section */}
            <Box
                sx={{
                    background: "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)",
                    borderRadius: 2,
                    p: 4,
                    mb: 3,
                    display: "flex",
                    alignItems: "center",
                    gap: 3,
                }}
            >
                <Box
                    sx={{
                        width: 48,
                        height: 48,
                        borderRadius: "50%",
                        background: "rgba(255, 255, 255, 0.2)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 24,
                    }}
                >
                    🔍
                </Box>
                <Box>
                    <Typography variant="h3" sx={{ color: "white", fontWeight: 600, mb: 0.5 }}>
                        Security Scan Reports
                    </Typography>
                    <Typography variant="h6" sx={{ color: "rgba(255, 255, 255, 0.9)" }}>
                        Comprehensive vulnerability analysis and code quality insights
                    </Typography>
                </Box>
            </Box>

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

            {/* Channel Groups */}
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
                    <Paper key={channel} sx={{ p: 3, mb: 3 }}>
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
                                    {scans.length} total scans
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Latest: {scans[0]?.timestamp ? new Date(scans[0].timestamp).toLocaleString() : "N/A"}
                                </Typography>
                                <Link
                                    component={RouterLink}
                                    to={`${securityScansBasePath}/channel/${channel}`}
                                    underline="hover"
                                >
                                    View All →
                                </Link>
                            </Box>
                        </Box>

                        {/* Chart */}
                        <Box sx={{ mb: 3 }}>
                            <ReactECharts
                                option={buildChannelChartOption(scans)}
                                style={{ height: 300 }}
                                theme="dark"
                            />
                        </Box>

                        {/* Table */}
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
                                    {scans.slice(0, 5).map((scan) => (
                                        <TableRow key={`${channel}-${scan.timestamp}`} hover>
                                            <TableCell sx={{ whiteSpace: "nowrap" }}>
                                                <Link
                                                    component={RouterLink}
                                                    to={`${securityScansBasePath}/channel/${channel}/run/${scan.timestamp}`}
                                                    underline="hover"
                                                >
                                                    {new Date(scan.timestamp).toLocaleString()}
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
                    </Paper>
                ))
            )}
        </Box>
    );
}
