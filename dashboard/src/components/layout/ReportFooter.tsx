// src/components/layout/ReportFooter.tsx
import { Box, Link, Typography } from "@mui/material";
import type { ScanRunMetadata } from "../../features/scans/types/scanRun";

export type ReportFooterProps = {
    scanMetadata?: ScanRunMetadata;
    channel?: string;
    dataBasePath?: string; // e.g., "/data/org/app/repo/runs/channel/timestamp"
};

export function ReportFooter({ scanMetadata, channel, dataBasePath }: ReportFooterProps) {
    const metadata = scanMetadata?.metadata;
    const timestamp = scanMetadata?.timestamp;

    return (
        <Box
            sx={{
                position: "fixed",
                bottom: 0,
                left: 0,
                width: "100%",
                bgcolor: "rgba(19, 47, 76, 0.95)",
                color: "#ecf0f1",
                fontSize: "0.75rem",
                px: 2,
                py: 0.5,
                boxShadow: "0 -2px 10px rgba(0,0,0,0.3)",
                transition: "all 0.3s ease",
                overflow: "hidden",
                maxHeight: "2.5rem",
                zIndex: 1200,
                backdropFilter: "blur(5px)",
                "&:hover": {
                    maxHeight: "20rem",
                    py: 1.5,
                    fontSize: "0.8rem",
                },
            }}
        >

            {/* Git Info */}
            {metadata && (
                <Box sx={{ mb: 0.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    <Typography component="span" variant="caption">
                        {metadata.repository && (
                            <>
                                Git repo:{" "}
                                <Link
                                    href={`https://github.com/${metadata.repository}`}
                                    target="_git_repo"
                                    underline="hover"
                                    sx={{ color: "#5dade2" }}
                                >
                                    {metadata.repository}
                                </Link>
                            </>
                        )}
                        {metadata.branch && metadata.repository && (
                            <>
                                {" | "}
                                Branch:{" "}
                                <Link
                                    href={`https://github.com/${metadata.repository}/tree/${metadata.branch}`}
                                    target="_git_branch"
                                    underline="hover"
                                    sx={{ color: "#5dade2" }}
                                >
                                    {metadata.branch}
                                </Link>
                            </>
                        )}
                        {metadata.commit && metadata.repository && (
                            <>
                                {" | "}
                                Commit:{" "}
                                <Link
                                    href={`https://github.com/${metadata.repository}/commit/${metadata.commit}`}
                                    target="_git_commit"
                                    underline="hover"
                                    sx={{ color: "#5dade2" }}
                                >
                                    {metadata.commit.substring(0, 7)}
                                </Link>
                            </>
                        )}
                        {timestamp && <> • Built at: {timestamp}</>}
                    </Typography>
                </Box>
            )}

            {/* Raw Data Links */}
            {dataBasePath && (
                <Box sx={{ mb: 0.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    <Typography component="span" variant="caption">
                        Raw data:{" "}
                        <Link href={`${dataBasePath}/trivy-fs-results.json`} target="_json_fs" underline="hover" sx={{ color: "#5dade2" }}>
                            📄 Trivy FS
                        </Link>
                        {" | "}
                        <Link href={`${dataBasePath}/trivy-image-results.json`} target="_json_image" underline="hover" sx={{ color: "#5dade2" }}>
                            📄 Trivy Image
                        </Link>
                        {" | "}
                        <Link href={`${dataBasePath}/semgrep-results.json`} target="_json_semgrep" underline="hover" sx={{ color: "#5dade2" }}>
                            📄 Semgrep
                        </Link>
                        {" | "}
                        <Link href={`${dataBasePath}/scan-metadata.json`} target="_json_metadata" underline="hover" sx={{ color: "#5dade2" }}>
                            📄 Metadata
                        </Link>
                    </Typography>
                </Box>
            )}
        </Box>
    );
}
