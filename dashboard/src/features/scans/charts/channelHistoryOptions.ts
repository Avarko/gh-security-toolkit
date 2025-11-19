/**
 * ECharts configuration builder for channel history charts.
 */

import type { ScanMetadata } from "../model/historyTypes";

export function buildChannelChartOption(scans: ScanMetadata[]) {
    const sortedScans = [...scans].sort(
        (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Format timestamp as 'DD/MM/YYYY, HH:mm:ss'
    function formatDateTime(ts: string) {
        const d = new Date(ts);
        return d.toLocaleDateString() + ", " + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
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
    const errorsData = sortedScans.map((s) =>
        isMissingStats(s) ? null : s.semgrepResults?.totalErrors || 0
    );
    const warningsData = sortedScans.map((s) =>
        isMissingStats(s) ? null : s.semgrepResults?.totalWarnings || 0
    );

    // X-axis labels: show date and time
    const xLabels = sortedScans.map((s) => formatDateTime(s.timestamp));

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
            data: xLabels,
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
                data: criticalData,
                smooth: true,
                lineStyle: { color: "#f44336", width: 2 },
                itemStyle: { color: "#f44336" },
                markPoint: { data: markPoints },
            },
            {
                name: "High",
                type: "line",
                data: highData,
                smooth: true,
                lineStyle: { color: "#ff9800", width: 2 },
                itemStyle: { color: "#ff9800" },
            },
            {
                name: "Errors",
                type: "line",
                data: errorsData,
                smooth: true,
                lineStyle: { color: "#e91e63", width: 2 },
                itemStyle: { color: "#e91e63" },
            },
            {
                name: "Warnings",
                type: "line",
                data: warningsData,
                smooth: true,
                lineStyle: { color: "#ffc107", width: 2 },
                itemStyle: { color: "#ffc107" },
            },
        ],
    };
}
