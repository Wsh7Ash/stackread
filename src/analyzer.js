/**
 * analyzer.js — turns a scan into a layered report:
 * layers, importer counts, duplicates, licenses, summary.
 */
'use strict';

function analyze(scan) {
  const { direct, packages, importers, missing } = scan;

  // Resolve which installed version to use per package: prefer any version
  // directly installed at the top level; if multiple, take the highest semver-ish.
  const resolved = new Map(); // name -> { version, deps }
  for (const [name, versions] of packages) {
    let best = null;
    for (const [version, deps] of versions) {
      if (!best || compareSemver(version, best.version) > 0) best = { version, deps };
    }
    resolved.set(name, best);
  }

  // Layer assignment by BFS from direct deps over resolved dep edges.
  const layer = new Map(); // name -> depth (1 = direct)
  const queue = [];
  for (const d of direct) {
    if (packages.has(d) && !layer.has(d)) {
      layer.set(d, 1);
      queue.push(d);
    }
  }
  let head = 0;
  while (head < queue.length) {
    const name = queue[head++];
    const info = resolved.get(name);
    const depth = layer.get(name);
    if (!info || depth >= 64) continue;
    for (const dep of info.deps) {
      if (packages.has(dep) && !layer.has(dep)) {
        layer.set(dep, depth + 1);
        queue.push(dep);
      }
    }
  }

  // Packages installed but unreachable from direct deps.
  const orphans = [];
  for (const name of packages.keys()) {
    if (!layer.has(name)) orphans.push(name);
  }

  const directInfo = direct.map((name) => {
    const inst = packages.get(name);
    const version = inst ? resolved.get(name).version : null;
    return {
      name,
      version,
      importers: importers.has(name) ? importers.get(name).size : 0,
      installed: !!inst,
      declared: true,
    };
  });

  const transitive = [];
  for (const [name, depth] of layer) {
    if (depth <= 1) continue;
    const inst = packages.get(name);
    transitive.push({
      name,
      version: inst ? resolved.get(name).version : null,
      depth,
      importers: importers.has(name) ? importers.get(name).size : 0,
    });
  }
  transitive.sort((a, b) => a.depth - b.depth || a.name.localeCompare(b.name));

  // Duplicates: same package name at more than one version anywhere in the tree.
  const duplicates = [];
  for (const [name, versions] of packages) {
    if (versions.size > 1) {
      duplicates.push({ name, versions: [...versions.keys()].sort(compareSemver) });
    }
  }
  duplicates.sort((a, b) => a.name.localeCompare(b.name));

  // Licenses from installed package.json metadata.
  const licenseByPkg = new Map();
  for (const [name, versions] of packages) {
    licenseByPkg.set(name, 'Unknown');
  }
  const licenses = new Map(); // license -> count
  for (const name of packages.keys()) {
    const lic = licenseOf(name, scan.root) || 'Unknown';
    licenseByPkg.set(name, lic);
    licenses.set(lic, (licenses.get(lic) || 0) + 1);
  }

  const unused = directInfo.filter((d) => d.importers === 0).map((d) => d.name);

  const maxDepth = Math.max(0, ...layer.values());
  const summary = {
    totalPackages: packages.size,
    directCount: direct.length,
    transitiveCount: transitive.length,
    maxDepth,
    unusedDirect: unused.length,
    duplicateSets: duplicates.length,
    missing: missing.length,
  };

  return {
    root: scan.root,
    layers: { direct: directInfo, transitive },
    orphans,
    duplicates,
    licenseByPkg,
    licenses,
    unused,
    missing,
    summary,
  };
}

/** Semver-ish comparison: numeric fields first, then string. */
function compareSemver(a, b) {
  const pa = String(a).split(/[.\-+]/).map((x) => (/^\d+$/.test(x) ? Number(x) : x));
  const pb = String(b).split(/[.\-+]/).map((x) => (/^\d+$/.test(x) ? Number(x) : x));
  for (let i = 0; i < 3; i++) {
    const va = pa[i] !== undefined ? pa[i] : 0;
    const vb = pb[i] !== undefined ? pb[i] : 0;
    if (typeof va === 'number' && typeof vb === 'number') {
      if (va !== vb) return va - vb;
    } else if (va !== vb) {
      return String(va) < String(vb) ? -1 : 1;
    }
  }
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

/** Read license for one package directly from disk (first matching version dir). */
function licenseOf(name, root) {
  const fs = require('fs');
  const path = require('path');
  const base = path.join(root, 'node_modules');
  const parts = name.split('/');
  const dir = name.startsWith('@') ? path.join(base, parts[0], parts[1]) : path.join(base, name);
  const pj = (() => {
    try {
      return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    } catch {
      return null;
    }
  })();
  if (!pj) return null;
  if (typeof pj.license === 'string') return pj.license;
  if (Array.isArray(pj.license)) return pj.license.join(' OR ');
  return null;
}

module.exports = { analyze, compareSemver };
