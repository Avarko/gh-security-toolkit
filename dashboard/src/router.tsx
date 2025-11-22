// src/router.tsx
/**
 * Main router entry point.
 *
 * Single-tenant mode only - GitHub Pages deployment.
 */
import { createSingleTenantRouter } from "./router/singleTenantRouter";

export const router = createSingleTenantRouter();
