// src/router.tsx
/**
 * Main router entry point.
 *
 * Creates router based on build-time tenant mode configuration.
 */
import { createRouter } from "./router/createRouter";

export const router = createRouter();
