import type { LoaderFunctionArgs } from "react-router-dom";
import { useLoaderData } from "react-router-dom";
import {
    Box,
    Typography,
    Card,
    CardContent,
    CardActions,
    Button,
    Grid,
    Alert,
} from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ScienceIcon from "@mui/icons-material/Science";
import BarChartIcon from "@mui/icons-material/BarChart";

import { loadTenantRegistry, findTenantByGitHub } from "../../../../lib/tenantRegistry";
import { MissingTenantParamsError } from "../../../../errors/MissingTenantParamsError";

interface LoaderData {
    tenantId: string;
    basePath: string;
    orgSlug: string;
    repoSlug: string;
}

export async function loader({ params }: LoaderFunctionArgs): Promise<LoaderData> {
    const { orgSlug, repoSlug } = params;

    if (!orgSlug || !repoSlug) {
        throw new MissingTenantParamsError(
            "GitHub org and repo are required in URL: /org/<org>/repo/<repo>"
        );
    }

    const registry = await loadTenantRegistry();
    const tenant = findTenantByGitHub(registry, orgSlug, repoSlug);

    if (!tenant) {
        throw new Error(`Tenant not found for ${orgSlug}/${repoSlug}`);
    }

    return {
        tenantId: tenant.id,
        basePath: `/data/${tenant.id}/runs`,
        orgSlug,
        repoSlug,
    };
}

export default function TestReportsIndexRoute() {
    const { basePath } = useLoaderData() as LoaderData;

    return (
        <Box>
            <Typography variant="h4" gutterBottom>
                Test reports
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
                Code coverage and test execution reports from CI/CD pipelines.
            </Typography>

            <Alert severity="info" sx={{ mb: 3 }}>
                Test reports are published separately from security scans. JaCoCo coverage
                and Surefire test reports open in a new browser tab to preserve their
                original formatting.
            </Alert>

            <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 6 }}>
                    <Card>
                        <CardContent>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                                <BarChartIcon color="primary" />
                                <Typography variant="h6">
                                    JaCoCo coverage report
                                </Typography>
                            </Box>
                            <Typography variant="body2" color="text.secondary">
                                Line, branch, and method coverage metrics for your codebase.
                                Shows which code paths are covered by tests.
                            </Typography>
                        </CardContent>
                        <CardActions>
                            <Button
                                size="small"
                                endIcon={<OpenInNewIcon />}
                                href={`${basePath}/master/latest/coverage/index.html`}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Open coverage report
                            </Button>
                        </CardActions>
                    </Card>
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                    <Card>
                        <CardContent>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                                <ScienceIcon color="success" />
                                <Typography variant="h6">
                                    Surefire test report
                                </Typography>
                            </Box>
                            <Typography variant="body2" color="text.secondary">
                                Test execution results showing passed, failed, and skipped tests
                                with execution times.
                            </Typography>
                        </CardContent>
                        <CardActions>
                            <Button
                                size="small"
                                endIcon={<OpenInNewIcon />}
                                href={`${basePath}/master/latest/tests/index.html`}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Open test report
                            </Button>
                        </CardActions>
                    </Card>
                </Grid>
            </Grid>

            <Typography variant="body2" color="text.secondary" sx={{ mt: 4 }}>
                Note: Test reports open in a new browser tab to preserve their original
                formatting and navigation.
            </Typography>
        </Box>
    );
}
