import { useLoaderData } from "@remix-run/react";
import {
    Container,
    Typography,
    Card,
    CardContent,
    CardHeader,
    Chip,
    Grid,
    Box,
    Stack,
    Link,
} from "@mui/material";
import {
    Error as ErrorIcon,
    Warning as WarningIcon,
    CheckCircle as CheckCircleIcon,
    BugReport as BugReportIcon,
} from "@mui/icons-material";
import ReactECharts from "echarts-for-react";
import { useMemo } from "react";

export async function clientLoader() {
    const response = await fetch("/data/hist/scan-history.json");
    const history = await response.json();
    return { history };
}

interface ScanEntry {
    channel: string;
    timestamp: string;
    metadata?: {
        branch?: string;
        commitSha?: string;
    };
    stats?: {
        trivy?: {
            critical?: number;
            high?: number;
        };
        semgrep?: {
            error?: number;
            warning?: number;
        };
    };
}

export default function Index() {
    const { history } = useLoaderData<typeof clientLoader>();

    const hasIssues = (entry: ScanEntry) => {
        return (
            (entry.stats?.trivy?.critical || 0) > 0 ||
            (entry.stats?.trivy?.high || 0) > 0 ||
            (entry.stats?.semgrep?.error || 0) > 0 ||
            (entry.stats?.semgrep?.warning || 0) > 0
        );
    };

    const chartOption = useMemo(() => {
        if (!history.entries || history.entries.length === 0) return null;

        // Group data by channel
        const channelData: Record<string, ScanEntry[]> = {};
        history.entries.forEach((entry: ScanEntry) => {
            if (!channelData[entry.channel]) {
                channelData[entry.channel] = [];
            }
            channelData[entry.channel].push(entry);
        });

        // Sort entries by timestamp within each channel
        Object.keys(channelData).forEach(channel => {
            channelData[channel].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
        });

        const channels = Object.keys(channelData);
        const allTimestamps = Array.from(
            new Set(history.entries.map((e: ScanEntry) => e.timestamp))
        ).sort();

        // Create series for each severity type per channel
        const series: any[] = [];

        channels.forEach(channel => {
            const channelEntries = channelData[channel];

            // Critical vulnerabilities
            series.push({
                name: `${channel} - Critical`,
                type: 'line',
                data: allTimestamps.map(ts => {
                    const entry = channelEntries.find(e => e.timestamp === ts);
                    return entry?.stats?.trivy?.critical || 0;
                }),
                smooth: true,
                itemStyle: { color: '#ef5350' },
                lineStyle: { width: 2 },
            });

            // High vulnerabilities
            series.push({
                name: `${channel} - High`,
                type: 'line',
                data: allTimestamps.map(ts => {
                    const entry = channelEntries.find(e => e.timestamp === ts);
                    return entry?.stats?.trivy?.high || 0;
                }),
                smooth: true,
                itemStyle: { color: '#ff9800' },
                lineStyle: { width: 2 },
            });

            // Semgrep errors
            series.push({
                name: `${channel} - Errors`,
                type: 'line',
                data: allTimestamps.map(ts => {
                    const entry = channelEntries.find(e => e.timestamp === ts);
                    return entry?.stats?.semgrep?.error || 0;
                }),
                smooth: true,
                itemStyle: { color: '#f50057' },
                lineStyle: { width: 2, type: 'dashed' },
            });

            // Semgrep warnings
            series.push({
                name: `${channel} - Warnings`,
                type: 'line',
                data: allTimestamps.map(ts => {
                    const entry = channelEntries.find(e => e.timestamp === ts);
                    return entry?.stats?.semgrep?.warning || 0;
                }),
                smooth: true,
                itemStyle: { color: '#ffa726' },
                lineStyle: { width: 2, type: 'dashed' },
            });
        });

        return {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'axis',
                backgroundColor: 'rgba(19, 47, 76, 0.95)',
                borderColor: '#3f51b5',
                textStyle: { color: '#fff' },
            },
            legend: {
                data: series.map(s => s.name),
                textStyle: { color: '#fff' },
                top: 10,
                type: 'scroll',
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '10%',
                top: '15%',
                containLabel: true,
            },
            xAxis: {
                type: 'category',
                boundaryGap: false,
                data: allTimestamps,
                axisLabel: {
                    color: '#aaa',
                    rotate: 45,
                    formatter: (value: string) => {
                        // Format: 2025-11-15-202945Z -> 11/15 20:29
                        const match = value.match(/(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})/);
                        if (match) {
                            return `${match[2]}/${match[3]} ${match[4]}:${match[5]}`;
                        }
                        return value;
                    },
                },
                axisLine: { lineStyle: { color: '#555' } },
            },
            yAxis: {
                type: 'value',
                name: 'Count',
                nameTextStyle: { color: '#aaa' },
                axisLabel: { color: '#aaa' },
                axisLine: { lineStyle: { color: '#555' } },
                splitLine: { lineStyle: { color: '#333' } },
            },
            series,
        };
    }, [history.entries]);

    return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
            <Box mb={4}>
                <Typography variant="h3" component="h1" gutterBottom fontWeight="bold">
                    Security Scan Dashboard
                </Typography>
                <Typography variant="subtitle1" color="text.secondary">
                    Version {history.version} • {history.entries?.length || 0} total scans
                </Typography>
            </Box>

            {history.entries && history.entries.length > 0 ? (
                <Stack spacing={4}>
                    {chartOption && (
                        <Card variant="outlined">
                            <CardHeader
                                title={
                                    <Typography variant="h5" fontWeight="600">
                                        Security Trends - All Channels
                                    </Typography>
                                }
                                subheader="Vulnerability and code issue trends over time"
                            />
                            <CardContent>
                                <ReactECharts
                                    option={chartOption}
                                    style={{ height: '500px' }}
                                    theme="dark"
                                />
                                <Box mt={2}>
                                    <Typography variant="caption" color="text.secondary">
                                        • Solid lines: Trivy vulnerabilities (Critical, High)
                                        <br />
                                        • Dashed lines: Semgrep code issues (Errors, Warnings)
                                    </Typography>
                                </Box>
                            </CardContent>
                        </Card>
                    )}

                    <Box>
                        <Typography variant="h5" gutterBottom fontWeight="600" mb={2}>
                            Recent Scans
                        </Typography>
                        <Stack spacing={2}>
                            {history.entries.slice(0, 10).map((entry: ScanEntry) => (
                                <Card
                                    key={`${entry.channel}-${entry.timestamp}`}
                                    variant="outlined"
                                    sx={{
                                        transition: 'all 0.2s',
                                        '&:hover': {
                                            boxShadow: 4,
                                            borderColor: 'primary.main',
                                        },
                                    }}
                                >
                                    <CardHeader
                                        title={
                                            <Typography variant="h6" component="div">
                                                {entry.channel}
                                            </Typography>
                                        }
                                        subheader={entry.timestamp}
                                        action={
                                            <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="flex-end">
                                                {(entry.stats?.trivy?.critical || 0) > 0 && (
                                                    <Chip
                                                        icon={<ErrorIcon />}
                                                        label={`${entry.stats.trivy.critical} Critical`}
                                                        color="error"
                                                        size="small"
                                                    />
                                                )}
                                                {(entry.stats?.trivy?.high || 0) > 0 && (
                                                    <Chip
                                                        icon={<WarningIcon />}
                                                        label={`${entry.stats.trivy.high} High`}
                                                        sx={{ bgcolor: 'warning.dark', color: 'white' }}
                                                        size="small"
                                                    />
                                                )}
                                                {(entry.stats?.semgrep?.error || 0) > 0 && (
                                                    <Chip
                                                        icon={<BugReportIcon />}
                                                        label={`${entry.stats.semgrep.error} Errors`}
                                                        color="error"
                                                        size="small"
                                                    />
                                                )}
                                                {(entry.stats?.semgrep?.warning || 0) > 0 && (
                                                    <Chip
                                                        icon={<WarningIcon />}
                                                        label={`${entry.stats.semgrep.warning} Warnings`}
                                                        color="warning"
                                                        size="small"
                                                    />
                                                )}
                                                {!hasIssues(entry) && (
                                                    <Chip
                                                        icon={<CheckCircleIcon />}
                                                        label="Clean"
                                                        color="success"
                                                        size="small"
                                                    />
                                                )}
                                            </Stack>
                                        }
                                    />
                                    <CardContent>
                                        <Stack direction="row" spacing={3}>
                                            <Box>
                                                <Typography variant="caption" color="text.secondary">
                                                    Branch
                                                </Typography>
                                                <Typography
                                                    variant="body2"
                                                    fontFamily="monospace"
                                                    sx={{
                                                        bgcolor: 'background.default',
                                                        px: 1,
                                                        py: 0.5,
                                                        borderRadius: 1,
                                                        display: 'inline-block',
                                                    }}
                                                >
                                                    {entry.metadata?.branch || "unknown"}
                                                </Typography>
                                            </Box>
                                            <Box>
                                                <Typography variant="caption" color="text.secondary">
                                                    Commit
                                                </Typography>
                                                <Typography
                                                    variant="body2"
                                                    fontFamily="monospace"
                                                    sx={{
                                                        bgcolor: 'background.default',
                                                        px: 1,
                                                        py: 0.5,
                                                        borderRadius: 1,
                                                        display: 'inline-block',
                                                    }}
                                                >
                                                    {entry.metadata?.commitSha?.substring(0, 7) || "unknown"}
                                                </Typography>
                                            </Box>
                                        </Stack>
                                    </CardContent>
                                </Card>
                            ))}
                        </Stack>
                    </Box>

                    <Box>
                        <Typography variant="h5" gutterBottom fontWeight="600" mb={2}>
                            Channels
                        </Typography>
                        <Grid container spacing={2}>
                            {Array.from(new Set(history.entries?.map((e: ScanEntry) => e.channel) || [])).map(
                                (channel: string) => {
                                    const channelScans = history.entries.filter(
                                        (e: ScanEntry) => e.channel === channel
                                    );
                                    return (
                                        <Grid item xs={12} sm={6} md={4} key={channel}>
                                            <Link
                                                href={`/data/channels/${channel}`}
                                                underline="none"
                                                sx={{ display: 'block', height: '100%' }}
                                            >
                                                <Card
                                                    variant="outlined"
                                                    sx={{
                                                        height: '100%',
                                                        transition: 'all 0.2s',
                                                        '&:hover': {
                                                            boxShadow: 4,
                                                            borderColor: 'primary.main',
                                                            transform: 'translateY(-2px)',
                                                        },
                                                    }}
                                                >
                                                    <CardContent>
                                                        <Typography variant="h6" color="primary" gutterBottom>
                                                            {channel}
                                                        </Typography>
                                                        <Typography variant="body2" color="text.secondary">
                                                            {channelScans.length} scan{channelScans.length !== 1 ? 's' : ''}
                                                        </Typography>
                                                    </CardContent>
                                                </Card>
                                            </Link>
                                        </Grid>
                                    );
                                }
                            )}
                        </Grid>
                    </Box>
                </Stack>
            ) : (
                <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center', py: 6 }}>
                        <Typography variant="h6" color="text.secondary">
                            No Data Available
                        </Typography>
                        <Typography variant="body2" color="text.secondary" mt={1}>
                            No scan data has been collected yet.
                        </Typography>
                    </CardContent>
                </Card>
            )}
        </Container>
    );
}
