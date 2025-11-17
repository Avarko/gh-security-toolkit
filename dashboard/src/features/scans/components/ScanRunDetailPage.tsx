// features/scans/components/ScanRunDetailPage.tsx
import { Link as RouterLink } from "react-router-dom";
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
import { severityToHexColor } from "./severity";

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
};

export function ScanRunDetailPage({
    channel,
    metadata,
    trivyData,
    semgrepData,
}: ScanRunDetailPageProps) {
    const trivyVulns: TrivyVulnerability[] =
        trivyData.Results?.flatMap((r) => r.Vulnerabilities ?? []) ?? [];

    const semgrepFindings: SemgrepFinding[] = semgrepData.results ?? [];

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
                    to="/"
                    underline="hover"
                    color="inherit"
                >
                    Security Scans
                </MuiLink>
                <MuiLink
                    component={RouterLink}
                    to={`/scans/${channel}`}
                    underline="hover"
                    color="inherit"
                >
                    {channel}
                </MuiLink>
                <Typography color="text.primary">
                    {new Date(metadata.timestamp).toLocaleString()}
                </Typography>
            </Breadcrumbs>

            {/* Perustiedot */}
            <Box sx={{ mb: 3 }}>
                <Typography variant="h4" sx={{ mb: 1, fontWeight: 600 }}>
                    Scan Details
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
                            {new Date(metadata.timestamp).toLocaleString()}
                        </Typography>

                        <Typography variant="subtitle2">Repository</Typography>
                        <Typography variant="body2">{metadata.repository}</Typography>

                        <Typography variant="subtitle2">Branch</Typography>
                        <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                            {metadata.branch}
                        </Typography>

                        <Typography variant="subtitle2">Commit</Typography>
                        <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                            {metadata.commitSha}
                        </Typography>
                    </Box>
                </Paper>
            </Box>

            {/* Trivy-vulnerabiliteetit */}
            <Box sx={{ mb: 4 }}>
                <Typography variant="h5" sx={{ mb: 1.5 }}>
                    Trivy Vulnerabilities ({trivyVulns.length})
                </Typography>

                {trivyVulns.length === 0 ? (
                    <Typography variant="body2">No Trivy vulnerabilities found.</Typography>
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
                                                    sx={{
                                                        bgcolor: severityToHexColor(v.Severity),
                                                        color: "#fff",
                                                    }}
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
                    Semgrep Findings ({semgrepFindings.length})
                </Typography>

                {semgrepFindings.length === 0 ? (
                    <Typography variant="body2">No Semgrep findings.</Typography>
                ) : (
                    <Paper sx={{ p: 2 }}>
                        <TableContainer sx={{ maxHeight: 600 }}>
                            <Table size="small" stickyHeader>
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 600 }}>Rule</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Path</TableCell>
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
                                                {f.path}
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={f.extra.severity}
                                                    size="small"
                                                    sx={{
                                                        bgcolor: severityToHexColor(f.extra.severity),
                                                        color: "#fff",
                                                    }}
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
        </Box>
    );
}
