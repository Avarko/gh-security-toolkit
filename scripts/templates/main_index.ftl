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
                            <table class="scan-table scan-table-compact">
                                <thead>
                                    <tr>
                                        <th>Timestamp</th>
                                        <th>Branch & Commit</th>
                                        <th colspan="4">Trivy FS Vuln</th>
                                        <th colspan="4">Trivy Image Vuln</th>
                                        <th colspan="3">Semgrep</th>
                                    </tr>
                                    <tr class="subheader">
                                        <th></th>
                                        <th></th>
                                        <th class="severity-c">C</th>
                                        <th class="severity-h">H</th>
                                        <th class="severity-m">M</th>
                                        <th class="severity-l">L</th>
                                        <th class="severity-c">C</th>
                                        <th class="severity-h">H</th>
                                        <th class="severity-m">M</th>
                                        <th class="severity-l">L</th>
                                        <th class="severity-error">E</th>
                                        <th class="severity-warn">W</th>
                                        <th class="severity-info">I</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <#list ch.recent as s>
                                        <tr>
                                            <td class="timestamp-cell"><a
                                                    href="${s.path}/index.html">${s.timestampHuman}</a></td>
                                            <td class="metadata-cell">
                                                <#if s.branch??>
                                                    <div class="branch">${s.branch}</div>
                                                </#if>
                                                <#if s.commit??>
                                                    <#assign short=(s.commit?length>= 7)?then(s.commit?substring(0,7), s.commit)>
                                                    <#if s.repository??>
                                                        <div class="commit"><a
                                                                href="https://github.com/${s.repository}/commit/${s.commit}"
                                                                target="_blank" rel="noopener">${short}</a></div>
                                                    <#else>
                                                        <div class="commit">${short}</div>
                                                    </#if>
                                                </#if>
                                                <#if !(s.branch??) && !(s.commit??)>-</#if>
                                            </td>
                                            <#if !s.stats.trivyFs.scanned>
                                                <td class="not-scanned" colspan="4">✗</td>
                                            <#else>
                                                <td class="count <#if s.stats.trivyFs.critical gt 0>severity-critical</#if>">
                                                    ${s.stats.trivyFs.critical!'-'}</td>
                                                <td class="count <#if s.stats.trivyFs.high gt 0>severity-high</#if>">
                                                    ${s.stats.trivyFs.high!'-'}</td>
                                                <td class="count <#if s.stats.trivyFs.medium gt 0>severity-medium</#if>">
                                                    ${s.stats.trivyFs.medium!'-'}</td>
                                                <td class="count <#if s.stats.trivyFs.low gt 0>severity-low</#if>">
                                                    ${s.stats.trivyFs.low!'-'}</td>
                                            </#if>

                                            <#if !s.stats.trivyImage.scanned>
                                                <td class="not-scanned" colspan="4">✗</td>
                                            <#else>
                                                <td class="count <#if s.stats.trivyImage.critical gt 0>severity-critical</#if>">
                                                    ${s.stats.trivyImage.critical!'-'}</td>
                                                <td class="count <#if s.stats.trivyImage.high gt 0>severity-high</#if>">
                                                    ${s.stats.trivyImage.high!'-'}</td>
                                                <td class="count <#if s.stats.trivyImage.medium gt 0>severity-medium</#if>">
                                                    ${s.stats.trivyImage.medium!'-'}</td>
                                                <td class="count <#if s.stats.trivyImage.low gt 0>severity-low</#if>">
                                                    ${s.stats.trivyImage.low!'-'}</td>
                                            </#if>

                                            <td class="count <#if s.stats.semgrepErrors gt 0>severity-error</#if>">
                                                ${s.stats.semgrepErrors!'-'}</td>
                                            <td class="count <#if s.stats.semgrepWarnings gt 0>severity-warn</#if>">
                                                ${s.stats.semgrepWarnings!'-'}</td>
                                            <td class="count <#if s.stats.semgrepInfo gt 0>severity-info</#if>">
                                                ${s.stats.semgrepInfo!'-'}</td>
                                        </tr>
                                    </#list>
                                </tbody>
                            </table>
                        </div>
                    </section>
                </#list>
        </#if>
    </main>
</body>

</html>