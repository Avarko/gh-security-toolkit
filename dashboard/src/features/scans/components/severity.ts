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

    if (severityUpper === "CRITICAL" || severityUpper === "ERROR") return "#cf222e";
    if (severityUpper === "HIGH" || severityUpper === "WARNING") return "#FF6A00";
    if (severityUpper === "MEDIUM") return "#FFDE5E";
    if (severityUpper === "LOW") return "#B7B2AA";
    if (severityUpper === "INFO") return "#3498db";

    return "#B7B2AA"; // default to LOW color
}

/**
 * Returns chip styling (background and text color) for a severity level.
 * Used for custom-styled severity chips with specific colors and text contrast.
 *
 * @param severity - The severity level (CRITICAL, HIGH, MEDIUM, LOW, INFO, etc.)
 * @returns Object with backgroundColor and color properties for sx prop
 */
export function severityToChipStyle(severity: string) {
    const severityUpper = severity.toUpperCase();

    if (severityUpper === "CRITICAL" || severityUpper === "ERROR") {
        return { backgroundColor: "#cf222e", color: "#ffffff" };
    }
    if (severityUpper === "HIGH" || severityUpper === "WARNING") {
        return { backgroundColor: "#FF6A00", color: "#ffffff" };
    }
    if (severityUpper === "MEDIUM") {
        return { backgroundColor: "#FFDE5E", color: "#000000" };
    }
    if (severityUpper === "LOW") {
        return { backgroundColor: "#B7B2AA", color: "#000000" };
    }
    if (severityUpper === "INFO") {
        return { backgroundColor: "#3498db", color: "#ffffff" };
    }

    return { backgroundColor: "#B7B2AA", color: "#000000" }; // default to LOW styling
}
