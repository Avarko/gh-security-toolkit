import { Box, Typography, Button } from "@mui/material";
import { Link, useRouteError } from "react-router-dom";

export default function ScanRunDetailErrorPage() {
    const error = useRouteError();
    let message = "Failed to load scan run details.";
    if (error instanceof Error) {
        message = error.message;
    } else if (typeof error === "string") {
        message = error;
    }
    return (
        <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="60vh" gap={2}>
            <Typography variant="h4" color="error" gutterBottom>
                Scan Run Not Found
            </Typography>
            <Typography variant="body1" color="text.secondary">
                {message}
            </Typography>
            <Button variant="contained" component={Link} to="../..">
                Back to Channel Scans
            </Button>
        </Box>
    );
}
