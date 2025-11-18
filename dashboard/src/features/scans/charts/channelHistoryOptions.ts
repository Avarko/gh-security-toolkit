/**
 * ECharts configuration builder for channel history charts.
 */

import type { ScanMetadata } from "../model/historyTypes";

export function buildChannelChartOption(scans: ScanMetadata[]) {
    const sortedScans = [...scans].sort(
        (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return {
        backgroundColor: "transparent",
        animation: false,
        tooltip: {
            trigger: "axis",
            backgroundColor: "#1e1e1e",
            borderColor: "#333",
            textStyle: { color: "#fff" },
        },
        legend: {
            data: ["Critical", "High", "Errors", "Warnings"],
            textStyle: { color: "#fff" },
            top: 10,
        },
        grid: {
            left: "3%",
            right: "4%",
            bottom: "3%",
            top: 60,
            containLabel: true,
        },
        xAxis: {
            type: "category",
            boundaryGap: false,
            data: sortedScans.map((s) =>
                new Date(s.timestamp).toLocaleDateString()
            ),
            axisLine: { lineStyle: { color: "#444" } },
            axisLabel: { color: "#aaa" },
        },
        yAxis: {
            type: "value",
            axisLine: { lineStyle: { color: "#444" } },
            axisLabel: { color: "#aaa" },
            splitLine: { lineStyle: { color: "#333" } },
        },
        series: [
            {
                name: "Critical",
                type: "line",
                data: sortedScans.map(
                    (s) =>
                        (s.trivyFsResults?.totalVulnerabilities?.CRITICAL || 0) +
                        (s.trivyImageResults?.totalVulnerabilities?.CRITICAL || 0)
                ),
                smooth: true,
                lineStyle: { color: "#f44336", width: 2 },
                itemStyle: { color: "#f44336" },
            },
            {
                name: "High",
                type: "line",
                data: sortedScans.map(
                    (s) =>
                        (s.trivyFsResults?.totalVulnerabilities?.HIGH || 0) +
                        (s.trivyImageResults?.totalVulnerabilities?.HIGH || 0)
                ),
                smooth: true,
                lineStyle: { color: "#ff9800", width: 2 },
                itemStyle: { color: "#ff9800" },
            },
            {
                name: "Errors",
                type: "line",
                data: sortedScans.map((s) => s.semgrepResults?.totalErrors || 0),
                smooth: true,
                lineStyle: { color: "#e91e63", width: 2 },
                itemStyle: { color: "#e91e63" },
            },
            {
                name: "Warnings",
                type: "line",
                data: sortedScans.map((s) => s.semgrepResults?.totalWarnings || 0),
                smooth: true,
                lineStyle: { color: "#ffc107", width: 2 },
                itemStyle: { color: "#ffc107" },
            },
        ],
    };
}
