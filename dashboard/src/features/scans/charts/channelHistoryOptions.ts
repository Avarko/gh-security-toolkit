/**
 * ECharts configuration builder for channel history charts.
 */

import type { ScanMetadata } from "../model/historyTypes";
import { parseTimestamp } from "../../../lib/formatTimestamp";

export function buildChannelChartOption(scans: ScanMetadata[]) {
    const sortedScans = [...scans].sort((a, b) => {
        const dateA = parseTimestamp(a.timestamp);
        const dateB = parseTimestamp(b.timestamp);
        if (!dateA || !dateB) return 0;
        return dateA.getTime() - dateB.getTime();
    });

    // Format timestamp as 'DD/MM/YYYY, HH:mm:ss' for tooltip
    function formatDateTime(ts: string) {
        const d = parseTimestamp(ts);
        if (!d) return "Invalid Date";
        return d.toLocaleDateString() + ", " + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    // Format date only for x-axis
    function formatDate(ts: string) {
        const d = parseTimestamp(ts);
        if (!d) return "Invalid Date";
        return d.toLocaleDateString();
    }

    // Helper: is scan missing all stats?
    function isMissingStats(s: ScanMetadata) {
        return !s.trivyFsResults && !s.trivyImageResults && !s.semgrepResults;
    }

    // Aggregate data: combine Trivy Critical + Semgrep Errors, Trivy High + Semgrep Warnings
    const aggregatedData: {
        criticalErrors: number[];  // Trivy Critical + Semgrep Errors
        highWarnings: number[];    // Trivy High + Semgrep Warnings
        medium: number[];          // Trivy Medium only
    } = {
        criticalErrors: [],
        highWarnings: [],
        medium: [],
    };

    sortedScans.forEach(scan => {
        const { trivyFsResults, trivyImageResults, semgrepResults } = scan;

        // Critical + Errors (red line)
        aggregatedData.criticalErrors.push(
            (trivyFsResults?.totalVulnerabilities?.CRITICAL || 0) +
            (trivyImageResults?.totalVulnerabilities?.CRITICAL || 0) +
            (semgrepResults?.totalErrors || 0)
        );

        // High + Warnings (orange line)
        aggregatedData.highWarnings.push(
            (trivyFsResults?.totalVulnerabilities?.HIGH || 0) +
            (trivyImageResults?.totalVulnerabilities?.HIGH || 0) +
            (semgrepResults?.totalWarnings || 0)
        );

        // Medium (yellow line)
        aggregatedData.medium.push(
            (trivyFsResults?.totalVulnerabilities?.MEDIUM || 0) +
            (trivyImageResults?.totalVulnerabilities?.MEDIUM || 0)
        );
    });

    // X-axis labels: show only date
    const xLabels = sortedScans.map((s) => formatDate(s.timestamp));

    // Optionally: mark incomplete scans with an exclamation mark
    const markPoints = sortedScans
        .map((s, i) =>
            isMissingStats(s)
                ? {
                    name: "incomplete",
                    value: "!",
                    xAxis: i,
                    yAxis: 0,
                    symbol: "circle",
                    symbolSize: 18,
                    itemStyle: { color: "#888" },
                    label: { show: true, formatter: "!", color: "#fff" },
                }
                : null
        )
        .filter(Boolean);

    return {
        backgroundColor: "transparent",
        animation: false,
        tooltip: {
            trigger: "axis",
            backgroundColor: "#1e1e1e",
            borderColor: "#333",
            textStyle: { color: "#fff" },
            axisPointer: { type: "line" },
            formatter: function (params: any[]) {
                // params is an array of series data for this x
                const idx = params[0]?.dataIndex ?? 0;
                const scan = sortedScans[idx];
                let s = scan ? `<b>${formatDateTime(scan.timestamp)}</b><br/>` : '';
                for (const p of params) {
                    s += `<span style='color:${p.color}'>●</span> ${p.seriesName} `;
                    s += (p.data == null || p.data === undefined) ? '-' : p.data;
                    s += '<br/>';
                }
                return s;
            },
        },
        legend: {
            show: false,
        },
        grid: {
            left: "3%",
            right: "4%",
            bottom: "3%",
            top: 20,
            containLabel: true,
        },
        xAxis: {
            type: "category",
            boundaryGap: false,
            data: xLabels,
            axisLine: { lineStyle: { color: "#444" } },
            axisLabel: {
                color: "#aaa",
                fontSize: 11,
                formatter: function (value: string) { return value; },
            },
        },
        yAxis: {
            type: "log",
            logBase: 10,
            name: "Vulnerabilities",
            axisLine: { lineStyle: { color: "#444" } },
            axisLabel: { color: "#aaa" },
            splitLine: { lineStyle: { color: "#e5e5e5" } },
        },
        series: [
            {
                name: "Critical + Errors",
                type: "line",
                data: aggregatedData.criticalErrors,
                smooth: true,
                lineStyle: { color: "#cf222e", width: 2 },
                itemStyle: { color: "#cf222e" },
                markPoint: { data: markPoints },
            },
            {
                name: "High + Warnings",
                type: "line",
                data: aggregatedData.highWarnings,
                smooth: true,
                lineStyle: { color: "#FF6A00", width: 2 },
                itemStyle: { color: "#FF6A00" },
            },
            {
                name: "Medium",
                type: "line",
                data: aggregatedData.medium,
                smooth: true,
                lineStyle: { color: "#FFDE5E", width: 2 },
                itemStyle: { color: "#FFDE5E" },
            },
        ],
    };
}
