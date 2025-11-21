// src/routes/singleTenant/index.ts
/**
 * Single-tenant route exports.
 *
 * These routes are used when TENANT_MODE=single-tenant (GitHub Pages deployment).
 * They do not require tenant resolution and fetch data directly from /data/.
 */
export { default as SecurityScansIndexRoute, loader as securityScansIndexLoader } from "./SecurityScansIndexRoute";
export { default as ChannelScansRoute, loader as channelScansLoader } from "./ChannelScansRoute";
export { default as ChannelScanRunDetailRoute, loader as channelScanRunDetailLoader } from "./ChannelScanRunDetailRoute";
export { default as TestReportsIndexRoute, loader as testReportsLoader } from "./TestReportsIndexRoute";
export { default as ChannelTestReportsRoute, loader as channelTestReportsLoader } from "./ChannelTestReportsRoute";
