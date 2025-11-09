<#-- Expects: findings list in variable "findings" (must be set before including this template) -->
    <#if findings?has_content>
        <table class="scan-table findings-table">
            <thead>
                <tr>
                    <th>Type</th>
                    <th>Target</th>
                    <th>Package/Type</th>
                    <th>ID</th>
                    <th>Severity</th>
                    <th>Title</th>
                    <th>Installed</th>
                    <th>Fixed</th>
                </tr>
            </thead>
            <tbody>
                <#list findings as f>
                    <tr>
                        <td>${f.type}</td>
                        <td class="target-cell">${f.target}</td>
                        <td>${f.pkg}</td>
                        <td class="id-cell">
                            ${f.id}
                            <#if f.id?starts_with("CVE-")>
                                <br>
                                <span style="font-size: 0.85em; white-space: nowrap;">
                                    [<a href="https://osv.dev/vulnerability/${f.id}" target="_osv_${f.id}"
                                        rel="noopener" style="text-decoration: none;">osv</a>
                                    | <a href="https://nvd.nist.gov/vuln/detail/${f.id}" target="_nvd_${f.id}"
                                        rel="noopener" style="text-decoration: none;">nvd</a>
                                    | <a href="https://www.cve.org/CVERecord?id=${f.id}" target="_cve_${f.id}"
                                        rel="noopener" style="text-decoration: none;">cve.org</a>]
                                </span>
                            </#if>
                        </td>
                        <td class="${f.cssClass}">${f.severityText}</td>
                        <td class="title-cell">${f.title}</td>
                        <td>${f.installedVersion}</td>
                        <td>${f.fixedVersion}</td>
                    </tr>
                </#list>
            </tbody>
        </table>
        <#else>
            <p>No findings data available.</p>
    </#if>