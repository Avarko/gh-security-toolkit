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
                        <table class="scan-table">
                            <thead>
                                <tr>
                                    <th rowspan="2">Timestamp</th>
                                    <th rowspan="2">Branch & Commit</th>
                                    <th colspan="4">Trivy FS Vulnerabilities</th>
                                    <th colspan="4">Trivy FS Misconfig</th>
                                    <th colspan="4">Trivy Image Vulnerabilities</th>
                                    <th colspan="4">Trivy Image Misconfig</th>
                                    <th colspan="3">Semgrep</th>
                                </tr>
                                <tr>
                                    <th class="severity-c">C</th>
                                    <th class="severity-h">H</th>
                                    <th class="severity-m">M</th>
                                    <th class="severity-l">L</th>
                                    <th class="severity-c">C</th>
                                    <th class="severity-h">H</th>
                                    <th class="severity-m">M</th>
                                    <th class="severity-l">L</th>
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
                                <#list scans as s>
                                    <tr>
                                        <td class="timestamp-cell"><a
                                                href="${s.timestamp}/index.html">${s.timestampHuman}</a></td>
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
                                        <#-- Trivy FS Misconfig -->
                                        <#if !s.stats.trivyFsMisconfig.scanned>
                                            <td class="not-scanned" colspan="4">✗</td>
                                        <#else>
                                            <td class="count <#if s.stats.trivyFsMisconfig.critical gt 0>severity-critical</#if>">
                                                ${s.stats.trivyFsMisconfig.critical!'-'}</td>
                                            <td class="count <#if s.stats.trivyFsMisconfig.high gt 0>severity-high</#if>">
                                                ${s.stats.trivyFsMisconfig.high!'-'}</td>
                                            <td class="count <#if s.stats.trivyFsMisconfig.medium gt 0>severity-medium</#if>">
                                                ${s.stats.trivyFsMisconfig.medium!'-'}</td>
                                            <td class="count <#if s.stats.trivyFsMisconfig.low gt 0>severity-low</#if>">
                                                ${s.stats.trivyFsMisconfig.low!'-'}</td>
                                        </#if>
                                        <#-- Trivy Image Vulns -->
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
                                        <#-- Trivy Image Misconfig -->
                                        <#if !s.stats.trivyImageMisconfig.scanned>
                                            <td class="not-scanned" colspan="4">✗</td>
                                        <#else>
                                            <td class="count <#if s.stats.trivyImageMisconfig.critical gt 0>severity-critical</#if>">
                                                ${s.stats.trivyImageMisconfig.critical!'-'}</td>
                                            <td class="count <#if s.stats.trivyImageMisconfig.high gt 0>severity-high</#if>">
                                                ${s.stats.trivyImageMisconfig.high!'-'}</td>
                                            <td class="count <#if s.stats.trivyImageMisconfig.medium gt 0>severity-medium</#if>">
                                                ${s.stats.trivyImageMisconfig.medium!'-'}</td>
                                            <td class="count <#if s.stats.trivyImageMisconfig.low gt 0>severity-low</#if>">
                                                ${s.stats.trivyImageMisconfig.low!'-'}</td>
                                        </#if>
                                                        <td
                                                            class="count <#if s.stats.semgrepErrors gt 0>severity-error</#if>">
                                                            ${s.stats.semgrepErrors!'-'}</td>
                                                        <td
                                                            class="count <#if s.stats.semgrepWarnings gt 0>severity-warn</#if>">
                                                            ${s.stats.semgrepWarnings!'-'}</td>
                                                        <td
                                                            class="count <#if s.stats.semgrepInfo gt 0>severity-info</#if>">
                                                            ${s.stats.semgrepInfo!'-'}</td>
                                    </tr>
                                </#list>
                            </tbody>
                        </table>
                    </div>
            </#if>
        </section>
    </main>
</body>

</html>