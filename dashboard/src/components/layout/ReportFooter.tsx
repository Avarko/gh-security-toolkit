// src/components/layout/ReportFooter.tsx
import { Box, Link, Typography } from "@mui/material";

export function ReportFooter() {
    return (
        <Box
            sx={{
                position: "fixed",
                bottom: 0,
                left: 0,
                width: "100%",
                bgcolor: "rgba(19, 47, 76, 0.95)",
                color: "#ecf0f1",
                textAlign: "center",
                fontSize: "0.8rem",
                px: 2,
                py: 0.5,
                boxShadow: "0 -2px 10px rgba(0,0,0,0.3)",
                transition: "all 0.3s ease",
                overflow: "hidden",
                maxHeight: "2rem",
                zIndex: 1200,
                backdropFilter: "blur(5px)",
                "&:hover": {
                    maxHeight: "10rem",
                    py: 1,
                    fontSize: "0.85rem",
                },
            }}
        >
            <Box
                sx={{
                    my: 0.5,
                    lineHeight: 1.6,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    "&:hover": {
                        whiteSpace: "normal",
                        overflow: "visible",
                    },
                }}
            >
                <Typography component="span">
                    Security scan history dashboard UI.&nbsp;
                    <Link
                        href="https://github.com/Avarko/gh-security-toolkit"
                        target="_blank"
                        rel="noopener noreferrer"
                        underline="hover"
                        sx={{ color: "#5dade2" }}
                    >
                        View source
                    </Link>
                </Typography>
            </Box>
        </Box>
    );
}
