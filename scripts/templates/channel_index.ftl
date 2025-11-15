<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <link rel="stylesheet" href="${rootCss}">
</head>

<body data-history-json="${historyJsonPath!}">
    <header>
        <h1>🔍 Security Scans - ${channel}</h1>
        <nav><a href="${linkAllChannels}">← All Channels</a></nav>
    </header>
    <main>
        <section class="scan-list" data-chart-channel="${channel}">
            <h2>Scan History (${scans?size} scans)</h2>
            <#if scans?size==0>
                <p class="no-scans">No scans available yet.</p>
            <#else>
                <div class="chart-wrapper" aria-live="polite">
                    <div class="chart-scroll">
                        <canvas id="chart-${channel?lower_case?replace("[^a-z0-9]+", "-", "r")}" height="300"></canvas>
                    </div>
                    <p class="chart-empty" hidden>No timeline data available yet.</p>
                </div>
                <div class="table-wrapper">
                    <#include "_scan_table.ftl">
                </div>
            </#if>
        </section>
    </main>
    <#include "_history_chart.ftl">
</body>

</html>