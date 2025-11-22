// app/theme.ts
import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
    palette: {
        mode: "light",
        primary: {
            main: "#0969da", // GitHub blue
        },
        secondary: {
            main: "#8250df", // GitHub purple
        },
        background: {
            default: "#ffffff",
            paper: "#f6f8fa", // GitHub subtle gray
        },
        error: {
            main: "#cf222e", // GitHub red - matches CRITICAL/ERROR severity
        },
        warning: {
            main: "#FF6A00", // Orange - matches HIGH/WARNING severity
        },
        success: {
            main: "#1a7f37", // GitHub green
        },
        text: {
            primary: "#1f2328", // GitHub dark text
            secondary: "#656d76", // GitHub muted text
        },
    },
    typography: {
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif',
        body1: {
            lineHeight: 1.5,
            fontSize: "14px",
        },
        h6: {
            fontSize: "16px",
            fontWeight: 600,
        },
    },
    components: {
        // Vastaavat vanhan CSS:n reset + body padding-bottom + linkkityyliä
        MuiCssBaseline: {
            styleOverrides: {
                "*, *::before, *::after": {
                    boxSizing: "border-box",
                },
                body: {
                    margin: 0,
                    paddingBottom: "5rem", // tila sticky-footerille
                },
                a: {
                    color: "#0969da",
                    textDecoration: "none",
                },
                "a:hover": {
                    textDecoration: "underline",
                },
            },
        },
        // GitHub-style cards
        MuiPaper: {
            styleOverrides: {
                root: {
                    borderRadius: 6,
                    border: "1px solid #d0d7de",
                },
            },
        },
        // GitHub-style tables
        MuiTableCell: {
            styleOverrides: {
                head: {
                    fontWeight: 600,
                    fontSize: "12px",
                    color: "#656d76",
                    borderBottom: "1px solid #d0d7de",
                },
                body: {
                    fontSize: "14px",
                    borderBottom: "1px solid #d0d7de",
                },
            },
        },
        MuiTable: {
            styleOverrides: {
                root: {
                    borderCollapse: "separate",
                },
            },
        },
        // Custom chip styling for severity levels
        MuiChip: {
            styleOverrides: {
                // Override default chip color for LOW severity (gray with dark text)
                colorDefault: {
                    backgroundColor: "#B7B2AA",
                    color: "#000000",
                },
            },
        },
    },
});
