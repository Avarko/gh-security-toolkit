/**
 * Centralized severity color utilities.
 * Provides consistent color mapping for severity levels across all components.
 */

import type { ChipPropsColorOverrides } from "@mui/material/Chip";
import type { OverridableStringUnion } from "@mui/types";

type ChipColor = OverridableStringUnion<
    "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning",
    ChipPropsColorOverrides
>;

/**
 * Maps severity level to Material UI Chip color.
 * Used for severity chips in tables.
 *
 * @param severity - The severity level (CRITICAL, HIGH, MEDIUM, LOW, INFO, etc.)
 * @param count - Optional count value (if 0, returns "default" color)
 * @returns MUI Chip color name
 */
export function severityToChipColor(severity: string, count?: number): ChipColor {
    if (count === 0) return "default";

    const severityUpper = severity.toUpperCase();

    if (severityUpper === "CRITICAL" || severityUpper === "ERROR") return "error";
    if (severityUpper === "HIGH" || severityUpper === "WARNING") return "warning";
    if (severityUpper === "MEDIUM") return "warning";
    if (severityUpper === "LOW") return "default";
    if (severityUpper === "INFO") return "info";

    return "default";
}

/**
 * Maps severity level to hex color string.
 * Used for custom-styled severity chips with specific colors.
 *
 * @param severity - The severity level (CRITICAL, HIGH, MEDIUM, LOW, INFO, etc.)
 * @returns Hex color string
 */
export function severityToHexColor(severity: string): string {
    const severityUpper = severity.toUpperCase();

    if (severityUpper === "CRITICAL" || severityUpper === "ERROR") return "#c0392b";
    if (severityUpper === "HIGH" || severityUpper === "WARNING") return "#e67e22";
    if (severityUpper === "MEDIUM") return "#f39c12";
    if (severityUpper === "LOW") return "#95a5a6";
    if (severityUpper === "INFO") return "#3498db";

    return "#95a5a6"; // default to LOW color
}
