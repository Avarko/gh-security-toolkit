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
        <h1>🔍 Security Scan Reports</h1>
        <p class="subtitle">Automated security scanning results</p>
    </header>
    <main>
        <#if channels?size==0>
            <section class="no-scans">
                <p>No security scans available yet.</p>
            </section>
        <#else>
            <#list channels as ch>
                <#assign chartId = "chart-" + ch.name?lower_case?replace("[^a-z0-9]+", "-", "r")>
                <section class="channel" data-chart-channel="${ch.name}">
                    <h2>${ch.name}</h2>
                    <p class="channel-info"><strong>Total scans:</strong> ${ch.total} | <strong>Latest:</strong>
                        ${ch.latestHuman} | <a href="${ch.viewAllHref}">View All →</a></p>
                    <div class="chart-wrapper" aria-live="polite">
                        <div class="chart-scroll">
                            <canvas id="${chartId}" height="280"></canvas>
                        </div>
                        <p class="chart-empty" hidden>No timeline data available yet.</p>
                    </div>
                    <div class="table-wrapper">
                        <#assign scans=ch.recent>
                        <#assign compact=true>
                        <#include "_scan_table.ftl">
                    </div>
                </section>
            </#list>
        </#if>
    </main>
    <#include "_history_chart.ftl">
</body>

</html>