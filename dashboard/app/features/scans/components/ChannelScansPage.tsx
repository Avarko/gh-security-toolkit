/**
 * Channel-specific scans page component.
 * Displays all scans for a single channel with detailed table.
 */

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
import type { ScanMetadata } from "~/features/scans/model/historyTypes";

type ChannelScansPageProps = {
    channel: string;
    scans: ScanMetadata[];
};

function getSeverityColor(
    severity: string,
    count: number
): "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning" {
    if (count === 0) return "success";
    switch (severity.toUpperCase()) {
        case "CRITICAL":
        case "ERROR":
            return "error";
        case "HIGH":
        case "WARNING":
            return "warning";
        case "MEDIUM":
            return "info";
        case "LOW":
        case "INFO":
        default:
            return "default";
    }
}

export function ChannelScansPage({ channel, scans }: ChannelScansPageProps) {
    const sorted = [...scans].sort(
        (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    const latest = sorted[0];

    return (
        <Box sx={{ p: 3 }}>
            {/* Breadcrumbs */}
            <Breadcrumbs
                separator={<NavigateNextIcon fontSize="small" />}
                sx={{ mb: 2 }}
            >
                <MuiLink
                    underline="hover"
                    sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
                    color="inherit"
                    href="/"
                >
                    <HomeIcon fontSize="small" />
                    Home
                </MuiLink>
                <Typography color="text.primary">Security Scans</Typography>
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
                            {new Date(latest.timestamp).toLocaleString()}
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
                    <TableContainer>
                        <Table size="small">
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
                                    const fsCrit =
                                        scan.trivyFsResults?.totalVulnerabilities?.CRITICAL || 0;
                                    const fsHigh =
                                        scan.trivyFsResults?.totalVulnerabilities?.HIGH || 0;
                                    const imgCrit =
                                        scan.trivyImageResults?.totalVulnerabilities?.CRITICAL ||
                                        0;
                                    const imgHigh =
                                        scan.trivyImageResults?.totalVulnerabilities?.HIGH || 0;
                                    const semErr = scan.semgrepResults?.totalErrors || 0;
                                    const semWarn = scan.semgrepResults?.totalWarnings || 0;

                                    return (
                                        <TableRow key={scan.timestamp} hover>
                                            <TableCell>
                                                <MuiLink
                                                    href={`/data/runs/${channel}/${scan.timestamp}`}
                                                    underline="hover"
                                                >
                                                    {new Date(scan.timestamp).toLocaleString()}
                                                </MuiLink>
                                            </TableCell>
                                            <TableCell>
                                                <Typography
                                                    variant="body2"
                                                    sx={{ fontFamily: "monospace" }}
                                                >
                                                    {scan.branch}
                                                </Typography>
                                                <Typography
                                                    variant="caption"
                                                    color="text.secondary"
                                                    sx={{ fontFamily: "monospace" }}
                                                >
                                                    {scan.commit?.substring(0, 7) ?? ""}
                                                </Typography>
                                            </TableCell>
                                            <TableCell align="right">
                                                <Chip
                                                    label={fsCrit}
                                                    color={getSeverityColor("CRITICAL", fsCrit)}
                                                    size="small"
                                                />
                                            </TableCell>
                                            <TableCell align="right">
                                                <Chip
                                                    label={fsHigh}
                                                    color={getSeverityColor("HIGH", fsHigh)}
                                                    size="small"
                                                />
                                            </TableCell>
                                            <TableCell align="right">
                                                <Chip
                                                    label={imgCrit}
                                                    color={getSeverityColor("CRITICAL", imgCrit)}
                                                    size="small"
                                                />
                                            </TableCell>
                                            <TableCell align="right">
                                                <Chip
                                                    label={imgHigh}
                                                    color={getSeverityColor("HIGH", imgHigh)}
                                                    size="small"
                                                />
                                            </TableCell>
                                            <TableCell align="right">
                                                <Chip
                                                    label={semErr}
                                                    color={getSeverityColor("ERROR", semErr)}
                                                    size="small"
                                                />
                                            </TableCell>
                                            <TableCell align="right">
                                                <Chip
                                                    label={semWarn}
                                                    color={getSeverityColor("WARNING", semWarn)}
                                                    size="small"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <MuiLink
                                                    href={`/data/runs/${channel}/${scan.timestamp}`}
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
