<table class="scan-table findings-table">
    <thead>
        <tr>
            <th>Rule ID</th>
            <th>Severity</th>
            <th>File</th>
            <th>Line</th>
            <th>Message</th>
        </tr>
    </thead>
    <tbody>
        <#list semgrepFindings as f>
            <tr>
                <td class="rule-cell">${f.ruleId}</td>
                <td class="severity-${f.severity?lower_case}">${f.severity}</td>
                <td class="path-cell">${f.path}</td>
                <td class="line-cell">
                    <#if f.line gt 0>${f.line}<#else>—</#if>
                </td>
                <td class="message-cell">${f.message}</td>
            </tr>
        </#list>
    </tbody>
</table>