// src/routes/index.ts
/**
 * Route exports for both single and multi-tenant modes.
 */
export { default as SecurityScansIndexRoute, loader as securityScansIndexLoader } from "./SecurityScansIndexRoute";
export { default as ChannelScansRoute, loader as channelScansLoader } from "./ChannelScansRoute";
export { default as ChannelScanRunDetailRoute, loader as channelScanRunDetailLoader } from "./ChannelScanRunDetailRoute";
export { default as TestReportsIndexRoute, loader as testReportsLoader } from "./TestReportsIndexRoute";
export { default as ChannelTestReportsRoute, loader as channelTestReportsLoader } from "./ChannelTestReportsRoute";
export { getDataRootFromParams } from "./loaderHelpers";
