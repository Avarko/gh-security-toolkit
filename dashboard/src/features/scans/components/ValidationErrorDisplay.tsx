/**
 * Error display component for validation errors
 * Shows user-friendly messages and optional technical details
 */

import { Alert, AlertTitle, Box, Collapse, Typography, IconButton } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useState } from 'react';

interface ValidationErrorDisplayProps {
    error: string;
    details?: unknown;
    severity?: 'error' | 'warning' | 'info';
}

export function ValidationErrorDisplay({ error, details, severity = 'error' }: ValidationErrorDisplayProps) {
    const [showDetails, setShowDetails] = useState(false);

    return (
        <Alert
            severity={severity}
            action={
                details ? (
                    <IconButton
                        aria-label="show details"
                        color="inherit"
                        size="small"
                        onClick={() => setShowDetails(!showDetails)}
                        sx={{
                            transform: showDetails ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.3s',
                        }}
                    >
                        <ExpandMoreIcon />
                    </IconButton>
                ) : undefined
            }
        >
            <AlertTitle>Data validation error</AlertTitle>
            <Typography variant="body2" sx={{ mb: details ? 1 : 0 }}>
                {error}
            </Typography>

            {details ? (
                <Collapse in={showDetails}>
                    <Box
                        sx={{
                            mt: 2,
                            p: 2,
                            bgcolor: 'rgba(0, 0, 0, 0.1)',
                            borderRadius: 1,
                            fontFamily: 'monospace',
                            fontSize: '0.75rem',
                            maxHeight: 300,
                            overflow: 'auto',
                        }}
                    >
                        <Typography variant="caption" component="div" sx={{ mb: 1, fontWeight: 'bold' }}>
                            Technical details:
                        </Typography>
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {JSON.stringify(details, null, 2)}
                        </pre>
                    </Box>
                </Collapse>
            ) : null}
        </Alert>
    );
}
