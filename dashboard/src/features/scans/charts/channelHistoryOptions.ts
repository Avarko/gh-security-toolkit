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


    // For each series, use null for missing stats
    const criticalData = sortedScans.map((s) =>
        isMissingStats(s)
            ? null
            : (s.trivyFsResults?.totalVulnerabilities?.CRITICAL || 0) +
            (s.trivyImageResults?.totalVulnerabilities?.CRITICAL || 0)
    );
    const highData = sortedScans.map((s) =>
        isMissingStats(s)
            ? null
            : (s.trivyFsResults?.totalVulnerabilities?.HIGH || 0) +
            (s.trivyImageResults?.totalVulnerabilities?.HIGH || 0)
    );
    const mediumData = sortedScans.map((s) =>
        isMissingStats(s)
            ? null
            : (s.trivyFsResults?.totalVulnerabilities?.MEDIUM || 0) +
            (s.trivyImageResults?.totalVulnerabilities?.MEDIUM || 0)
    );
    const lowData = sortedScans.map((s) =>
        isMissingStats(s)
            ? null
            : (s.trivyFsResults?.totalVulnerabilities?.LOW || 0) +
            (s.trivyImageResults?.totalVulnerabilities?.LOW || 0)
    );
    const errorsData = sortedScans.map((s) =>
        isMissingStats(s) ? null : s.semgrepResults?.totalErrors || 0
    );
    const warningsData = sortedScans.map((s) =>
        isMissingStats(s) ? null : s.semgrepResults?.totalWarnings || 0
    );

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
            data: ["Critical", "High", "Medium", "Low", "Errors", "Warnings"],
            textStyle: { color: "#000000" },
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
            data: xLabels,
            axisLine: { lineStyle: { color: "#444" } },
            axisLabel: {
                color: "#aaa",
                fontSize: 11,
                formatter: function (value: string) { return value; },
            },
        },
        yAxis: {
            type: "value",
            axisLine: { lineStyle: { color: "#444" } },
            axisLabel: { color: "#aaa" },
            splitLine: { lineStyle: { color: "#e5e5e5" } },
        },
        series: [
            {
                name: "Critical",
                type: "line",
                data: criticalData,
                smooth: true,
                lineStyle: { color: "#cf222e", width: 2 },
                itemStyle: { color: "#cf222e" },
                markPoint: { data: markPoints },
            },
            {
                name: "High",
                type: "line",
                data: highData,
                smooth: true,
                lineStyle: { color: "#FF6A00", width: 2 },
                itemStyle: { color: "#FF6A00" },
            },
            {
                name: "Medium",
                type: "line",
                data: mediumData,
                smooth: true,
                lineStyle: { color: "#FFDE5E", width: 2 },
                itemStyle: { color: "#FFDE5E" },
            },
            {
                name: "Low",
                type: "line",
                data: lowData,
                smooth: true,
                lineStyle: { color: "#B7B2AA", width: 2 },
                itemStyle: { color: "#B7B2AA" },
            },
            {
                name: "Errors",
                type: "line",
                data: errorsData,
                smooth: true,
                lineStyle: { color: "#cf222e", width: 2 },
                itemStyle: { color: "#cf222e" },
            },
            {
                name: "Warnings",
                type: "line",
                data: warningsData,
                smooth: true,
                lineStyle: { color: "#FF6A00", width: 2 },
                itemStyle: { color: "#FF6A00" },
            },
        ],
    };
}
