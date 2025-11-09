<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <link rel="stylesheet" href="${rootCss}">
</head>

<body>
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
                <section class="channel">
                        <h2>${ch.name}</h2>
                        <p class="channel-info"><strong>Total scans:</strong> ${ch.total} | <strong>Latest:</strong>
                            ${ch.latestHuman} | <a href="${ch.viewAllHref}">View All →</a></p>
                        <div class="table-wrapper">
                            <#assign scans=ch.recent>
                            <#assign compact=true>
                            <#include "_scan_table.ftl">
                        </div>
                    </section>
                </#list>
        </#if>
    </main>
</body>

</html>