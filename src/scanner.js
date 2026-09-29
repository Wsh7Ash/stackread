/**
 * scanner.js — builds the dependency graph and importer map for a project.
 * Walks node_modules for package metadata and source trees for imports.
 * Read-only. Never executes scanned code.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const SOURCE_EXT = new Set(['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.cache']);
const BUILTIN_PREFIXES = ['node:', 'fs', 'path', 'http', 'https', 'crypto', 'os', 'util', 'url', 'events', 'stream', 'zlib', 'child_process', 'cluster', 'net', 'tls', 'dns', 'readline', 'repl', 'vm', 'assert', 'buffer', 'process', 'querystring', 'string_decoder', 'timers', 'tty', 'v8', 'worker_threads', 'perf_hooks', 'async_hooks', 'trace_events', 'module', 'constants', 'punycode', 'sys'];
const BUILTINS = new Set(BUILTIN_PREFIXES);

/** Import statement / require extraction. */
function extractImports(source) {
  const specs = [];
  const patterns = [
    /(?:^|[\s;])import\s+[^'"]*?from\s*['"]([^'"]+)['"]/g,
    /(?:^|[\s;])import\s*['"]([^'"]+)['"]/g,
    /(?:^|[\s;])export\s+(?:\*|\{[^}]*\})\s*from\s*['"]([^'"]+)['"]/g,
    /(?:^|[^.\w])require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /(?:^|[^.\w])import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(source)) !== null) specs.push(m[1]);
  }
  return specs;
}

/** "pkg/sub/path" → "pkg"; "@scope/pkg/sub" → "@scope/pkg" */
function packageName(specifier) {
  if (specifier.startsWith('.') || specifier.startsWith('/') || /^[A-Za-z]:/.test(specifier)) return null;
  if (specifier.startsWith('node:')) return null;
  const parts = specifier.split('/');
  if (specifier.startsWith('@')) {
    if (parts.length < 2) return null;
    return parts.slice(0, 2).join('/');
  }
  return parts[0];
}

function isBuiltin(name) {
  return BUILTINS.has(name) || BUILTINS.has(name.replace(/^node:/, ''));
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function listDirSafe(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

/**
 * Walk node_modules (including scoped packages) and collect every installed
 * package's name/version/deps from its package.json.
 */
function collectPackages(rootModules) {
  const packages = new Map(); // name -> { versions: Map<version, deps> }
  const walk = (dir, depth) => {
    if (depth > 8) return;
    for (const ent of listDirSafe(dir)) {
      if (!ent.isDirectory()) continue;
      const full = path.join(dir, ent.name);
      if (ent.name.startsWith('@')) {
        walk(full, depth + 1);
        continue;
      }
      const pj = readJson(path.join(full, 'package.json'));
      if (pj && pj.name && pj.version) {
        const name = pj.name;
        if (!packages.has(name)) packages.set(name, new Map());
        const deps = Object.assign({}, pj.dependencies, pj.peerDependencies && pj.peerDependencies,
          pj.optionalDependencies);
        packages.get(name).set(pj.version, Object.keys(deps || {}));
        // nested node_modules
        const nested = path.join(full, 'node_modules');
        if (fs.existsSync(nested)) walk(nested, depth + 1);
      }
    }
  };
  walk(rootModules, 0);
  return packages;
}

/** Walk source files and record which file imports which package. */
function collectImporters(root, extraIgnores) {
  const importers = new Map(); // pkg -> Set<relative file>
  const ignoreSet = new Set([...SKIP_DIRS, ...extraIgnores]);
  const walk = (dir, relBase) => {
    for (const ent of listDirSafe(dir)) {
      const full = path.join(dir, ent.name);
      const rel = relBase ? `${relBase}/${ent.name}` : ent.name;
      if (ent.isDirectory()) {
        if (ignoreSet.has(ent.name) || ent.name.startsWith('.')) continue;
        walk(full, rel);
      } else if (SOURCE_EXT.has(path.extname(ent.name))) {
        let src = null;
        try {
          src = fs.readFileSync(full, 'utf8');
        } catch {
          continue;
        }
        const seen = new Set();
        for (const spec of extractImports(src)) {
          const name = packageName(spec);
          if (!name || isBuiltin(name)) continue;
          if (!seen.has(name)) {
            seen.add(name);
            if (!importers.has(name)) importers.set(name, new Set());
            importers.get(name).add(rel);
          }
        }
      }
    }
  };
  walk(root, '');
  return importers;
}

/**
 * Scan a project: package graph + importer map + root package.json.
 * @returns {{root: string, direct: string[], packages: Map, importers: Map, missing: string[]}}
 */
function scanProject(root, opts = {}) {
  const rootPj = readJson(path.join(root, 'package.json'));
  if (!rootPj) {
    throw new Error(`no package.json found in ${root}`);
  }
  const direct = [
    ...Object.keys(rootPj.dependencies || {}),
    ...Object.keys(rootPj.devDependencies || {}),
  ];
  const modulesDir = path.join(root, 'node_modules');
  const packages = collectPackages(modulesDir);
  const importers = collectImporters(root, opts.ignore || []);
  const missing = direct.filter((d) => !packages.has(d));
  return { root, direct, packages, importers, missing };
}

module.exports = { scanProject, extractImports, packageName, isBuiltin, collectPackages, collectImporters };
