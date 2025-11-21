// src/routes/multiTenant/index.ts
/**
 * Multi-tenant route exports.
 *
 * These routes are used when TENANT_MODE=multi-tenant (S3/CDN deployment).
 * They require tenant resolution via URL path and fetch data from /data/<uuid>/.
 */
export { default as RootIndex, loader as rootIndexLoader } from "./RootIndex";
export { default as TenantLayout, loader as tenantLayoutLoader, useTenant } from "./TenantLayout";
export { default as SecurityScansIndexRoute, loader as securityScansIndexLoader } from "./SecurityScansIndexRoute";
export { default as ChannelScansRoute, loader as channelScansLoader } from "./ChannelScansRoute";
export { default as ChannelScanRunDetailRoute, loader as channelScanRunDetailLoader } from "./ChannelScanRunDetailRoute";
export { default as TestReportsIndexRoute, loader as testReportsLoader } from "./TestReportsIndexRoute";
export { default as ChannelTestReportsRoute, loader as channelTestReportsLoader } from "./ChannelTestReportsRoute";
