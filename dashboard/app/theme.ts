// app/theme.ts
import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
    palette: {
        mode: "dark",
        primary: {
            main: "#3f51b5",
        },
        secondary: {
            main: "#f50057",
        },
        background: {
            default: "#0a1929",
            paper: "#132f4c",
        },
        error: {
            main: "#ef5350",
        },
        warning: {
            main: "#ff9800",
        },
        success: {
            main: "#66bb6a",
        },
    },
    typography: {
        fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
        body1: {
            lineHeight: 1.6,
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
                    color: "#3498db",
                    textDecoration: "none",
                },
                "a:hover": {
                    textDecoration: "underline",
                },
            },
        },
        // Korttien border-radius (vanhan section-kortin hengessä)
        MuiPaper: {
            styleOverrides: {
                root: {
                    borderRadius: 8,
                },
            },
        },
        // Taulukoiden perusfonttikoko ja head-soluja hieman korostetaan
        MuiTableCell: {
            styleOverrides: {
                head: {
                    fontWeight: 600,
                },
                body: {
                    fontSize: "0.9rem",
                },
            },
        },
    },
});
