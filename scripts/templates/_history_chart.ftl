<#-- Shared chart renderer for main/channel index pages. -->
<#if historyJsonPath?? && historyJsonPath?has_content>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.6/dist/chart.umd.min.js"></script>
<#noparse>
<script>
( () => {
  const historyPath = document.body?.dataset?.historyJson;
  if (!historyPath) {
    return;
  }
  const metricDefs = [
    { key: 'stats.trivyFs.critical', label: 'Trivy FS Vulns (Critical)', color: '#c0392b', defaultVisible: true },
    { key: 'stats.trivyFs.high', label: 'Trivy FS Vulns (High)', color: '#e67e22', defaultVisible: true },
    { key: 'stats.trivyFs.medium', label: 'Trivy FS Vulns (Medium)', color: '#f1c40f' },
    { key: 'stats.trivyFs.low', label: 'Trivy FS Vulns (Low)', color: '#95a5a6' },
    { key: 'stats.trivyFsMisconfig.critical', label: 'Trivy FS Misconfig (Critical)', color: '#8e0000', defaultVisible: true },
    { key: 'stats.trivyFsMisconfig.high', label: 'Trivy FS Misconfig (High)', color: '#d35400', defaultVisible: true },
    { key: 'stats.trivyFsMisconfig.medium', label: 'Trivy FS Misconfig (Medium)', color: '#f39c12' },
    { key: 'stats.trivyFsMisconfig.low', label: 'Trivy FS Misconfig (Low)', color: '#7f8c8d' },
    { key: 'stats.trivyImage.critical', label: 'Trivy Image Vulns (Critical)', color: '#b71c1c', defaultVisible: true },
    { key: 'stats.trivyImage.high', label: 'Trivy Image Vulns (High)', color: '#ff7043', defaultVisible: true },
    { key: 'stats.trivyImage.medium', label: 'Trivy Image Vulns (Medium)', color: '#ffca28' },
    { key: 'stats.trivyImage.low', label: 'Trivy Image Vulns (Low)', color: '#bdbdbd' },
    { key: 'stats.trivyImageMisconfig.critical', label: 'Trivy Image Misconfig (Critical)', color: '#6d1b7b', defaultVisible: true },
    { key: 'stats.trivyImageMisconfig.high', label: 'Trivy Image Misconfig (High)', color: '#8e24aa', defaultVisible: true },
    { key: 'stats.trivyImageMisconfig.medium', label: 'Trivy Image Misconfig (Medium)', color: '#ab47bc' },
    { key: 'stats.trivyImageMisconfig.low', label: 'Trivy Image Misconfig (Low)', color: '#ce93d8' },
    { key: 'stats.semgrep.errors', label: 'Semgrep Errors', color: '#512da8', defaultVisible: true },
    { key: 'stats.semgrep.warnings', label: 'Semgrep Warnings', color: '#ffb300' },
    { key: 'stats.semgrep.info', label: 'Semgrep Info', color: '#1976d2' }
  ];

  let historyPromise;
  function fetchHistory() {
    if (!historyPromise) {
      historyPromise = fetch(historyPath, { cache: 'no-store' })
        .then(resp => resp.ok ? resp.json() : null)
        .catch(() => null);
    }
    return historyPromise;
  }

  function parseTimestamp(raw) {
    if (!raw || typeof raw !== 'string') {
      return null;
    }
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})(\d{2})(Z|[+-].+)$/);
    if (!match) {
      return null;
    }
    return new Date(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}${match[7]}`);
  }

  function formatLabel(dateObj, fallback) {
    if (!(dateObj instanceof Date) || Number.isNaN(dateObj.valueOf())) {
      return fallback || '';
    }
    return dateObj.toISOString().replace('T', ' ').replace('Z', ' UTC');
  }

  function pick(obj, path) {
    return path.split('.').reduce((acc, key) => (acc && acc[key] != null) ? acc[key] : null, obj) ?? 0;
  }

  function ensureWidth(canvas, points) {
    const width = Math.max(points * 70, 900);
    canvas.width = width;
    canvas.style.width = `${width}px`;
  }

  async function renderSection(section) {
    const channel = section.dataset.chartChannel;
    const canvas = section.querySelector('canvas');
    const emptyState = section.querySelector('.chart-empty');
    if (!channel || !canvas) {
      return;
    }
    const history = await fetchHistory();
    if (!history || !Array.isArray(history.scans)) {
      emptyState?.removeAttribute('hidden');
      return;
    }
    const series = history.scans.filter(entry => entry.channel === channel);
    if (!series.length) {
      emptyState?.removeAttribute('hidden');
      return;
    }
    series.sort((a, b) => {
      const da = parseTimestamp(a.timestamp) ?? new Date(a.timestamp);
      const db = parseTimestamp(b.timestamp) ?? new Date(b.timestamp);
      return da - db;
    });
    const labels = series.map(entry => formatLabel(parseTimestamp(entry.timestamp), entry.timestamp));
    const datasets = metricDefs.map(def => ({
      label: def.label,
      data: series.map(entry => Number(pick(entry, def.key)) || 0),
      borderColor: def.color,
      backgroundColor: def.color,
      tension: 0.3,
      borderWidth: 2,
      pointRadius: 2,
      fill: false,
      spanGaps: true,
      hidden: def.defaultVisible === true ? false : true
    })).filter(ds => ds.data.some(v => v && v !== 0));

    if (!datasets.length) {
      emptyState?.removeAttribute('hidden');
      return;
    }

    ensureWidth(canvas, labels.length);
    if (!window.Chart) {
      return;
    }

    new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'bottom' },
          tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.formattedValue}` } }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { precision: 0 }
          }
        }
      }
    });
    emptyState?.setAttribute('hidden', 'hidden');
  }

  function initCharts() {
    const sections = document.querySelectorAll('[data-chart-channel]');
    sections.forEach(renderSection);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCharts);
  } else {
    initCharts();
  }
} )();
</script>
</#noparse>
</#if>
