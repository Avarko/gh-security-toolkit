/**
 * Channel-specific scans page component.
 * Displays all scans for a single channel with detailed table.
 */

import { Link as RouterLink, useParams } from "react-router-dom";
import {
    Box,
    Typography,
    Breadcrumbs,
    Link as MuiLink,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
} from "@mui/material";
import HomeIcon from "@mui/icons-material/Home";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import type { ScanMetadata } from "../model/historyTypes";
import { severityToChipColor } from "./severity";
import { formatTimestamp, parseTimestamp } from "../../../lib/formatTimestamp";

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
    const sorted = [...scans].sort((a, b) => {
        const dateA = parseTimestamp(a.timestamp);
        const dateB = parseTimestamp(b.timestamp);
        if (!dateA || !dateB) return 0;
        return dateB.getTime() - dateA.getTime();
    });

    const latest = sorted[0];

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

            {/* Header + Summary */}
            <Box sx={{ mb: 3 }}>
                <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
                    Channel: {channel}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    Total scans: {sorted.length}
                    {latest && (
                        <>
                            {" • Latest run: "}
                            {formatTimestamp(latest.timestamp)}
                        </>
                    )}
                </Typography>
            </Box>

            {sorted.length === 0 ? (
                <Typography variant="body1">
                    No scans found for this channel.
                </Typography>
            ) : (
                <Paper sx={{ p: 2 }}>
                    <TableContainer sx={{ maxHeight: 600 }}>
                        <Table size="small" stickyHeader>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 600 }}>Timestamp</TableCell>
                                    <TableCell sx={{ fontWeight: 600 }}>
                                        Branch &amp; Commit
                                    </TableCell>
                                    <TableCell
                                        align="right"
                                        sx={{ fontWeight: 600 }}
                                    >
                                        Trivy FS Critical
                                    </TableCell>
                                    <TableCell
                                        align="right"
                                        sx={{ fontWeight: 600 }}
                                    >
                                        Trivy FS High
                                    </TableCell>
                                    <TableCell
                                        align="right"
                                        sx={{ fontWeight: 600 }}
                                    >
                                        Trivy Image Critical
                                    </TableCell>
                                    <TableCell
                                        align="right"
                                        sx={{ fontWeight: 600 }}
                                    >
                                        Trivy Image High
                                    </TableCell>
                                    <TableCell
                                        align="right"
                                        sx={{ fontWeight: 600 }}
                                    >
                                        Semgrep Errors
                                    </TableCell>
                                    <TableCell
                                        align="right"
                                        sx={{ fontWeight: 600 }}
                                    >
                                        Semgrep Warnings
                                    </TableCell>
                                    <TableCell sx={{ fontWeight: 600 }}>Details</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {sorted.map((scan) => {
                                    const hasStats = !!(scan.trivyFsResults || scan.trivyImageResults || scan.semgrepResults);
                                    const fsCrit = scan.trivyFsResults?.totalVulnerabilities?.CRITICAL;
                                    const fsHigh = scan.trivyFsResults?.totalVulnerabilities?.HIGH;
                                    const imgCrit = scan.trivyImageResults?.totalVulnerabilities?.CRITICAL;
                                    const imgHigh = scan.trivyImageResults?.totalVulnerabilities?.HIGH;
                                    const semErr = scan.semgrepResults?.totalErrors;
                                    const semWarn = scan.semgrepResults?.totalWarnings;

                                    const detailPath = `${securityScansBasePath}/channel/${channel}/run/${scan.timestamp}`;

                                    return (
                                        <TableRow
                                            key={scan.timestamp}
                                            hover
                                            sx={!hasStats ? { backgroundColor: '#444', opacity: 0.7 } : {}}
                                        >
                                            <TableCell>
                                                <MuiLink
                                                    component={RouterLink}
                                                    to={detailPath}
                                                    underline="hover"
                                                >
                                                    {formatTimestamp(scan.timestamp)}
                                                </MuiLink>
                                            </TableCell>
                                            <TableCell>
                                                <Typography
                                                    variant="body2"
                                                    sx={{ fontFamily: "monospace" }}
                                                >
                                                    {scan.metadata?.branch}
                                                </Typography>
                                                <Typography
                                                    variant="caption"
                                                    color="text.secondary"
                                                    sx={{ fontFamily: "monospace" }}
                                                >
                                                    {scan.metadata?.commit?.substring(0, 7) ?? ""}
                                                </Typography>
                                            </TableCell>
                                            <TableCell align="right">
                                                {hasStats && fsCrit !== undefined ? (
                                                    <Chip label={fsCrit} color={severityToChipColor("CRITICAL", fsCrit)} size="small" />
                                                ) : (
                                                    <Chip label="-" size="small" sx={{ bgcolor: '#666', color: '#fff', opacity: 0.7 }} />
                                                )}
                                            </TableCell>
                                            <TableCell align="right">
                                                {hasStats && fsHigh !== undefined ? (
                                                    <Chip label={fsHigh} color={severityToChipColor("HIGH", fsHigh)} size="small" />
                                                ) : (
                                                    <Chip label="-" size="small" sx={{ bgcolor: '#666', color: '#fff', opacity: 0.7 }} />
                                                )}
                                            </TableCell>
                                            <TableCell align="right">
                                                {hasStats && imgCrit !== undefined ? (
                                                    <Chip label={imgCrit} color={severityToChipColor("CRITICAL", imgCrit)} size="small" />
                                                ) : (
                                                    <Chip label="-" size="small" sx={{ bgcolor: '#666', color: '#fff', opacity: 0.7 }} />
                                                )}
                                            </TableCell>
                                            <TableCell align="right">
                                                {hasStats && imgHigh !== undefined ? (
                                                    <Chip label={imgHigh} color={severityToChipColor("HIGH", imgHigh)} size="small" />
                                                ) : (
                                                    <Chip label="-" size="small" sx={{ bgcolor: '#666', color: '#fff', opacity: 0.7 }} />
                                                )}
                                            </TableCell>
                                            <TableCell align="right">
                                                {hasStats && semErr !== undefined ? (
                                                    <Chip label={semErr} color={severityToChipColor("ERROR", semErr)} size="small" />
                                                ) : (
                                                    <Chip label="-" size="small" sx={{ bgcolor: '#666', color: '#fff', opacity: 0.7 }} />
                                                )}
                                            </TableCell>
                                            <TableCell align="right">
                                                {hasStats && semWarn !== undefined ? (
                                                    <Chip label={semWarn} color={severityToChipColor("WARNING", semWarn)} size="small" />
                                                ) : (
                                                    <Chip label="-" size="small" sx={{ bgcolor: '#666', color: '#fff', opacity: 0.7 }} />
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <MuiLink
                                                    component={RouterLink}
                                                    to={detailPath}
                                                    underline="hover"
                                                >
                                                    View →
                                                </MuiLink>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>
            )}
        </Box>
    );
}
