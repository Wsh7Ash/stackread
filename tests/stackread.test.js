'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { makeProject } = require('./helpers');
const { scanProject, packageName, extractImports, isBuiltin } = require('../src/scanner');
const { analyze, compareSemver } = require('../src/analyzer');
const { renderText, renderJson } = require('../src/render');

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'stackread-test-'));
}

test('packageName strips subpaths and scopes', () => {
  assert.strictEqual(packageName('lodash'), 'lodash');
  assert.strictEqual(packageName('lodash/fp/map'), 'lodash');
  assert.strictEqual(packageName('@scope/pkg/dist/index'), '@scope/pkg');
  assert.strictEqual(packageName('./local'), null);
  assert.strictEqual(packageName('/abs'), null);
  assert.strictEqual(packageName('node:fs'), null);
});

test('extractImports finds import/require/dynamic forms', () => {
  const src = [
    "const fs = require('node:fs');",
    "const _ = require('lodash');",
    "import express from 'express';",
    "import { x } from '@scope/pkg';",
    "export * from './local';",
    "async () => { const m = await import('semver'); };",
  ].join('\n');
  const specs = extractImports(src);
  assert.ok(specs.includes('lodash'));
  assert.ok(specs.includes('express'));
  assert.ok(specs.includes('@scope/pkg'));
  assert.ok(specs.includes('semver'));
  // extractImports is a raw extractor; builtin/local filtering happens in packageName()
  assert.ok(specs.includes('node:fs'));
  assert.ok(specs.includes('./local'));
  assert.strictEqual(packageName('node:fs'), null);
  assert.strictEqual(packageName('./local'), null);
});

test('isBuiltin recognizes core modules with and without prefix', () => {
  assert.ok(isBuiltin('fs'));
  assert.ok(isBuiltin('node:crypto'));
  assert.ok(!isBuiltin('lodash'));
});

function standardFixture(basedir) {
  return makeProject(basedir, {
    direct: { express: '^4.18.2', lodash: '^4.17.21', leftpad: '^1.3.0' },
    packages: {
      express: { version: '4.18.2', deps: ['accepts', 'debug'], license: 'MIT' },
      lodash: { version: '4.17.21', deps: [], license: 'MIT' },
      leftpad: { version: '1.3.0', deps: [], license: 'WTFPL' },
      accepts: { version: '1.3.8', deps: ['negotiator'], license: 'MIT' },
      negotiator: { version: '0.6.3', deps: [], license: 'MIT' },
      debug: { version: '2.8.3', deps: [], license: 'MIT' },
    },
    nested: {
      express: { debug: { version: '3.1.0', deps: [] } },
    },
    sources: {
      'src/a.js': "const _ = require('lodash');\nconst e = require('express');\n",
      'src/b.js': "import express from 'express';\n",
      'src/c.ts': "import { x } from 'express';\n",
    },
  });
}

test('scanProject builds package graph, importers, and layering', () => {
  const dir = tmp();
  try {
    const root = standardFixture(dir);
    const scan = scanProject(root);
    assert.deepStrictEqual(scan.direct.sort(), ['express', 'leftpad', 'lodash']);
    assert.ok(scan.packages.has('express'));
    assert.strictEqual(scan.packages.get('express').size, 1);
    assert.ok(scan.packages.has('debug'));
    assert.strictEqual(scan.packages.get('debug').size, 2); // 2.8.3 and nested 3.1.0
    // importers
    assert.strictEqual(scan.importers.get('express').size, 3);
    assert.strictEqual(scan.importers.get('lodash').size, 1);
    assert.ok(!scan.importers.has('leftpad'));
    assert.deepStrictEqual(scan.missing, []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('analyze layers direct vs transitive and detects unused/duplicates', () => {
  const dir = tmp();
  try {
    const root = standardFixture(dir);
    const report = analyze(scanProject(root));
    assert.strictEqual(report.summary.totalPackages, 6); // 6 unique names; debug has 2 versions
    assert.strictEqual(report.summary.directCount, 3);
    // transitive: accepts(2), negotiator(3), debug(2)
    assert.strictEqual(report.summary.transitiveCount, 3);
    assert.strictEqual(report.summary.maxDepth, 3);
    assert.deepStrictEqual(report.unused, ['leftpad']);
    const dup = report.duplicates.find((d) => d.name === 'debug');
    assert.ok(dup, 'duplicate set for debug');
    assert.deepStrictEqual(dup.versions, ['2.8.3', '3.1.0']);
    // license aggregation: MIT x5, WTFPL x1 (licenses are read from the top-level
    // installed copy of each package name; nested copies are not re-sampled)
    assert.strictEqual(report.licenses.get('MIT'), 5);
    assert.strictEqual(report.licenses.get('WTFPL'), 1);
    assert.strictEqual(report.licenses.size, 2);
    // direct info carries importer counts
    const express = report.layers.direct.find((d) => d.name === 'express');
    assert.strictEqual(express.importers, 3);
    assert.strictEqual(express.version, '4.18.2');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('analyze flags declared-but-not-installed packages', () => {
  const dir = tmp();
  try {
    const root = makeProject(dir, {
      direct: { ghost: '^1.0.0', real: '^1.0.0' },
      packages: { real: { version: '1.0.0', deps: [] } },
      sources: {},
    });
    const report = analyze(scanProject(root));
    assert.deepStrictEqual(report.missing, ['ghost']);
    assert.strictEqual(report.summary.missing, 1);
    const g = report.layers.direct.find((d) => d.name === 'ghost');
    assert.strictEqual(g.installed, false);
    assert.strictEqual(g.importers, 0);
    assert.deepStrictEqual(report.unused, ['ghost', 'real']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('devDependencies count as direct', () => {
  const dir = tmp();
  try {
    const root = makeProject(dir, {
      direct: {},
      devDirect: { tap: '^1.0.0' },
      packages: { tap: { version: '1.0.0', deps: [] } },
      sources: { 'index.js': "require('tap');\n" },
    });
    const report = analyze(scanProject(root));
    assert.strictEqual(report.summary.directCount, 1);
    assert.strictEqual(report.layers.transitive.length, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('compareSemver orders versions correctly', () => {
  assert.ok(compareSemver('2.8.3', '3.1.0') < 0);
  assert.ok(compareSemver('3.1.0', '2.8.3') > 0);
  assert.ok(compareSemver('1.10.0', '1.9.0') > 0);
  assert.strictEqual(compareSemver('1.2.3', '1.2.3'), 0);
});

test('renderText includes sections and unused marker', () => {
  const dir = tmp();
  try {
    const root = standardFixture(dir);
    const report = analyze(scanProject(root));
    const text = renderText(report);
    assert.ok(text.includes('LAYER 1'));
    assert.ok(text.includes('LAYER 2+'));
    assert.ok(text.includes('DUPLICATES'));
    assert.ok(text.includes('LICENSES'));
    assert.ok(text.includes('SUMMARY'));
    assert.ok(text.includes('UNUSED'));
    assert.ok(text.includes('leftpad'));
    assert.ok(text.includes('debug: 2.8.3, 3.1.0 (2 versions)'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('renderJson emits valid machine-readable report', () => {
  const dir = tmp();
  try {
    const root = standardFixture(dir);
    const report = analyze(scanProject(root));
    const parsed = JSON.parse(renderJson(report));
    assert.strictEqual(parsed.summary.totalPackages, 6);
    assert.deepStrictEqual(parsed.unusedDirect, ['leftpad']);
    assert.ok(parsed.licenses.MIT === 5);
    assert.strictEqual(parsed.direct.length, 3);
    assert.ok(typeof parsed.generatedAt === 'string');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('CLI end-to-end: text and json modes, exit code 0', () => {
  const dir = tmp();
  try {
    const root = standardFixture(dir);
    const cli = path.join(__dirname, '..', 'src', 'cli.js');
    const textOut = execFileSync(process.execPath, [cli, root], { encoding: 'utf8' });
    assert.ok(textOut.includes('LAYER 1'));
    const jsonOut = execFileSync(process.execPath, [cli, root, '--json'], { encoding: 'utf8' });
    const parsed = JSON.parse(jsonOut);
    assert.strictEqual(parsed.summary.directCount, 3);
    // --top limits lists
    const topOut = execFileSync(process.execPath, [cli, root, '--top', '1'], { encoding: 'utf8' });
    assert.ok(topOut.includes('importers='));
    assert.ok(topOut.split('\n').filter((l) => l.includes('importers=')).length <= 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('CLI exits nonzero on missing target and bad flag', () => {
  const cli = path.join(__dirname, '..', 'src', 'cli.js');
  const run = (args) => {
    try {
      execFileSync(process.execPath, [cli, ...args], { encoding: 'utf8', stdio: 'pipe' });
      return 0;
    } catch (e) {
      return e.status;
    }
  };
  assert.notStrictEqual(run([]), 0);
  assert.strictEqual(run(['--nope', '.']), 2);
  assert.strictEqual(run(['./no-such-dir-xyz-stackread']), 1); // scan failure
});

test('scanProject rejects directory without package.json', () => {
  const dir = tmp();
  try {
    assert.throws(() => scanProject(dir), /no package.json/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
