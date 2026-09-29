/**
 * render.js — text and JSON rendering of the analysis report.
 */
'use strict';

function pad(s, n) {
  s = String(s);
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

function renderText(report, opts = {}) {
  const out = [];
  const top = opts.top || 0;
  const limit = (arr) => (top > 0 ? arr.slice(0, top) : arr);
  const s = report.summary;

  out.push(`stackread — dependency layer report for ${report.root}`);
  out.push(`Scanned ${s.totalPackages} packages.`);

  out.push('');
  out.push('LAYER 1 (direct dependencies)');
  const directs = limit([...report.layers.direct].sort((a, b) => b.importers - a.importers || a.name.localeCompare(b.name)));
  for (const d of directs) {
    const flag = d.importers === 0 ? '   ← UNUSED' : '';
    const ver = d.installed ? d.version : 'not installed';
    out.push(`  ${pad(d.name, 24)} ${pad(ver, 12)} importers=${d.importers}${flag}`);
  }
  if (report.layers.direct.length === 0) out.push('  (no direct dependencies)');

  out.push('');
  out.push('LAYER 2+ (transitive dependencies)');
  const trans = limit(report.layers.transitive);
  for (const t of trans) {
    out.push(`  ${pad(t.name, 24)} ${pad(t.version, 12)} depth=${t.depth}`);
  }
  if (report.layers.transitive.length === 0) out.push('  (none)');

  if (report.orphans.length > 0) {
    out.push('');
    out.push('INSTALLED BUT UNREACHABLE FROM DIRECT DEPS');
    for (const o of limit(report.orphans)) out.push(`  ${o}`);
  }

  out.push('');
  out.push('DUPLICATES');
  if (report.duplicates.length === 0) out.push('  (none)');
  for (const d of limit(report.duplicates)) {
    out.push(`  ${d.name}: ${d.versions.join(', ')} (${d.versions.length} versions)`);
  }

  out.push('');
  out.push('LICENSES');
  if (report.licenses.size === 0) out.push('  (none)');
  const licSorted = [...report.licenses.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  for (const [lic, n] of licSorted) out.push(`  ${lic} (${n})`);

  if (report.missing.length > 0) {
    out.push('');
    out.push('DECLARED BUT NOT INSTALLED');
    for (const m of report.missing) out.push(`  ${m}`);
  }

  out.push('');
  out.push('SUMMARY');
  out.push(`  ${s.totalPackages} packages · max depth ${s.maxDepth} · ${s.unusedDirect} unused direct dep(s) · ${s.duplicateSets} duplicate set(s)` + (s.missing ? ` · ${s.missing} missing` : ''));
  return out.join('\n') + '\n';
}

function renderJson(report, opts = {}) {
  const payload = {
    root: report.root,
    summary: report.summary,
    direct: report.layers.direct,
    transitive: opts.maxDepth ? report.layers.transitive.filter((t) => t.depth <= opts.maxDepth) : report.layers.transitive,
    orphans: report.orphans,
    duplicates: report.duplicates,
    licenses: Object.fromEntries(report.licenses),
    licenseByPackage: Object.fromEntries(report.licenseByPkg),
    unusedDirect: report.unused,
    missing: report.missing,
    generatedAt: new Date().toISOString(),
  };
  if (opts.top) {
    payload.direct = payload.direct.slice(0, opts.top);
    payload.transitive = payload.transitive.slice(0, opts.top);
  }
  return JSON.stringify(payload, null, 2) + '\n';
}

module.exports = { renderText, renderJson };
