import { Box, Typography } from "@mui/material";

export default function AppOverviewPage() {
    return (
        <Box>
            <Typography variant="h4">Application overview</Typography>
            <Typography variant="body1" sx={{ mt: 2 }}>
                TODO: Show app repositories, latest scan summaries, test stats, cloud posture.
            </Typography>
        </Box>
    );
}
