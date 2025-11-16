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
    },
});
