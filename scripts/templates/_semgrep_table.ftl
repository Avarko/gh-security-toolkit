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
                <td class="${f.cssClass}">${f.severityText}</td>
                <td class="path-cell">${f.path}</td>
                <td class="line-cell">${f.lineDisplay}</td>
                <td class="message-cell">${f.message}</td>
            </tr>
        </#list>
    </tbody>
</table>