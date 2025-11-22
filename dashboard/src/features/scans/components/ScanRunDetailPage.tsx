// features/scans/components/ScanRunDetailPage.tsx
import { Link as RouterLink, useParams } from "react-router-dom";
import {
    Box,
    Breadcrumbs,
    Link as MuiLink,
    Typography,
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
import { severityToChipStyle } from "./severity";
import { ReportFooter } from "../../../components/layout/ReportFooter";
import { formatTimestamp } from "../../../lib/formatTimestamp";

import type {
    ScanRunMetadata,
    TrivyScan,
    TrivyVulnerability,
    SemgrepScan,
    SemgrepFinding,
} from "../types/scanRun";

type ScanRunDetailPageProps = {
    channel: string;
    metadata: ScanRunMetadata;
    trivyData: TrivyScan;
    semgrepData: SemgrepScan;
    dataBasePath: string;
};

export function ScanRunDetailPage({
    channel,
    metadata,
    trivyData,
    semgrepData,
    dataBasePath,
}: ScanRunDetailPageProps) {
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
        : "/security-scans";

    const channelPath = `${securityScansBasePath}/channel/${channel}`;

    // Define severity order for sorting (Critical first, then High, Medium, Low, Unknown)
    const severityOrder: { [key: string]: number } = {
        'CRITICAL': 0,
        'HIGH': 1,
        'MEDIUM': 2,
        'LOW': 3,
        'UNKNOWN': 4,
    };

    // Get and sort Trivy vulnerabilities by severity
    const trivyVulns: TrivyVulnerability[] =
        (trivyData.Results?.flatMap((r) => r.Vulnerabilities ?? []) ?? [])
            .sort((a, b) => {
                const severityA = severityOrder[a.Severity?.toUpperCase() ?? 'UNKNOWN'] ?? 999;
                const severityB = severityOrder[b.Severity?.toUpperCase() ?? 'UNKNOWN'] ?? 999;
                return severityA - severityB;
            });

    // Get and sort Semgrep findings by severity (ERROR, WARNING, INFO)
    const semgrepSeverityOrder: { [key: string]: number } = {
        'ERROR': 0,
        'WARNING': 1,
        'INFO': 2,
    };

    const semgrepFindings: SemgrepFinding[] =
        (semgrepData.results ?? [])
            .sort((a, b) => {
                const severityA = semgrepSeverityOrder[a.extra?.severity?.toUpperCase() ?? 'INFO'] ?? 999;
                const severityB = semgrepSeverityOrder[b.extra?.severity?.toUpperCase() ?? 'INFO'] ?? 999;
                return severityA - severityB;
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
                    Security scans
                </MuiLink>
                <MuiLink
                    component={RouterLink}
                    to={channelPath}
                    underline="hover"
                    color="inherit"
                >
                    {channel}
                </MuiLink>
                <Typography color="text.primary">
                    {formatTimestamp(metadata.timestamp)}
                </Typography>
            </Breadcrumbs>
            {/* Perustiedot */}
            <Box sx={{ mb: 3 }}>
                <Typography variant="h4" sx={{ mb: 1, fontWeight: 600 }}>
                    Scan details
                </Typography>
                <Paper sx={{ p: 2 }}>
                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: { xs: "1fr", sm: "160px 1fr" },
                            rowGap: 1,
                            columnGap: 2,
                        }}
                    >
                        <Typography variant="subtitle2">Timestamp</Typography>
                        <Typography variant="body2">
                            {formatTimestamp(metadata.timestamp)}
                        </Typography>

                        <Typography variant="subtitle2">Repository</Typography>
                        <Typography variant="body2">{metadata.metadata?.repository}</Typography>

                        <Typography variant="subtitle2">Branch</Typography>
                        <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                            {metadata.metadata?.branch}
                        </Typography>

                        <Typography variant="subtitle2">Commit</Typography>
                        <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                            {metadata.metadata?.commit}
                        </Typography>
                    </Box>
                </Paper>
            </Box>

            {/* Trivy-vulnerabiliteetit */}
            <Box sx={{ mb: 4 }}>
                <Typography variant="h5" sx={{ mb: 1.5 }}>
                    Trivy vulnerabilities ({trivyVulns.length})
                </Typography>

                {trivyVulns.length === 0 ? (
                    <Typography variant="body2">No Trivy vulnerabilities found</Typography>
                ) : (
                    <Paper sx={{ p: 2 }}>
                        <TableContainer sx={{ maxHeight: 600 }}>
                            <Table size="small" stickyHeader>
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 600 }}>ID</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Package</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Severity</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Title</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {trivyVulns.slice(0, 100).map((v, idx) => (
                                        <TableRow key={`${v.VulnerabilityID}-${idx}`} hover>
                                            <TableCell sx={{ fontFamily: "monospace" }}>
                                                {v.PrimaryURL ? (
                                                    <MuiLink
                                                        href={v.PrimaryURL}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        underline="hover"
                                                    >
                                                        {v.VulnerabilityID}
                                                    </MuiLink>
                                                ) : (
                                                    v.VulnerabilityID
                                                )}
                                            </TableCell>
                                            <TableCell>{v.PkgName}</TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={v.Severity}
                                                    size="small"
                                                    sx={severityToChipStyle(v.Severity)}
                                                />
                                            </TableCell>
                                            <TableCell>{v.Title}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Paper>
                )}
            </Box>

            {/* Semgrep-löydökset */}
            <Box sx={{ mb: 2 }}>
                <Typography variant="h5" sx={{ mb: 1.5 }}>
                    Semgrep findings ({semgrepFindings.length})
                </Typography>

                {semgrepFindings.length === 0 ? (
                    <Typography variant="body2">No Semgrep findings</Typography>
                ) : (
                    <Paper sx={{ p: 2 }}>
                        <TableContainer sx={{ maxHeight: 600 }}>
                            <Table size="small" stickyHeader>
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 600 }}>Rule</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Location</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Severity</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Message</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {semgrepFindings.slice(0, 100).map((f, idx) => (
                                        <TableRow key={`${f.check_id}-${idx}`} hover>
                                            <TableCell
                                                sx={{
                                                    fontFamily: "monospace",
                                                    fontSize: "0.85rem",
                                                }}
                                            >
                                                {f.check_id}
                                            </TableCell>
                                            <TableCell
                                                sx={{
                                                    fontFamily: "monospace",
                                                    fontSize: "0.85rem",
                                                }}
                                            >
                                                {f.path}{f.start?.line ? `:${f.start.line}` : ""}
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={f.extra.severity}
                                                    size="small"
                                                    sx={severityToChipStyle(f.extra.severity)}
                                                />
                                            </TableCell>
                                            <TableCell>{f.extra.message}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Paper>
                )}
            </Box>

            {/* Footer with metadata */}
            <ReportFooter
                scanMetadata={metadata}
                channel={channel}
                dataBasePath={dataBasePath}
            />
        </Box>
    );
}
