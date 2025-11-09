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
        <h1>🔍 Security Scans - ${channel}</h1>
        <nav><a href="${linkAllChannels}">← All Channels</a></nav>
    </header>
    <main>
        <section class="scan-list">
            <h2>Scan History (${scans?size} scans)</h2>
            <#if scans?size==0>
                <p class="no-scans">No scans available yet.</p>
            <#else>
                <div class="table-wrapper">
                    <#include "_scan_table.ftl">
                </div>
            </#if>
        </section>
    </main>
</body>

</html>