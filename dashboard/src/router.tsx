// src/router.tsx
/**
 * Main router entry point.
 *
 * Selects the appropriate router based on build-time TENANT_MODE:
 * - single-tenant: GitHub Pages deployment, no tenant routing
 * - multi-tenant: S3/CDN deployment, tenant-aware routing
 *
 * The router is selected at BUILD TIME via Vite's define configuration,
 * ensuring predictable behavior and tree-shaking of unused code.
 */
import { isSingleTenant } from "./config/tenantMode";
import { createSingleTenantRouter } from "./router/singleTenantRouter";
import { createMultiTenantRouter } from "./router/multiTenantRouter";

export const router = isSingleTenant()
    ? createSingleTenantRouter()
    : createMultiTenantRouter();
