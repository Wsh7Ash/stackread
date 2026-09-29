#!/usr/bin/env node
/**
 * demo.js — builds the synthetic demo-project node_modules tree and runs
 * a full stackread scan on it, saving the report and JSON to results/.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const demoDir = path.join(repoRoot, 'examples', 'demo-project');
const resultsDir = path.join(repoRoot, 'results');
fs.mkdirSync(resultsDir, { recursive: true });

const modules = path.join(demoDir, 'node_modules');
fs.rmSync(modules, { recursive: true, force: true });
fs.mkdirSync(modules, { recursive: true });

function writePkg(relDir, pkgName, meta) {
  const dir = path.join(modules, relDir);
  fs.mkdirSync(dir, { recursive: true });
  const pj = { name: pkgName, version: meta.version, license: meta.license || 'MIT' };
  if (meta.deps) {
    pj.dependencies = {};
    for (const d of meta.deps) pj.dependencies[d] = '*';
  }
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pj, null, 2));
}

// Layout mirrors README example:
//   direct: express, lodash, left-pad (unused)
//   express -> accepts -> negotiator, body-parser -> ms
//   nested: express/node_modules/debug@3.1.0 vs top debug@2.8.3 (duplicate)
writePkg('express', 'express', { version: '4.18.2', license: 'MIT', deps: ['accepts', 'body-parser', 'debug'] });
writePkg('lodash', 'lodash', { version: '4.17.21', license: 'MIT' });
writePkg('left-pad', 'left-pad', { version: '1.3.0', license: 'WTFPL' });
writePkg('accepts', 'accepts', { version: '1.3.8', license: 'MIT', deps: ['negotiator'] });
writePkg('negotiator', 'negotiator', { version: '0.6.3', license: 'MIT' });
writePkg('body-parser', 'body-parser', { version: '1.20.1', license: 'MIT', deps: ['ms'] });
writePkg('ms', 'ms', { version: '2.1.3', license: 'MIT' });
writePkg('debug', 'debug', { version: '2.8.3', license: 'MIT' });
writePkg('mkdirp', 'mkdirp', { version: '0.5.6', license: 'MIT' }); // installed but orphaned
writePkg('express/node_modules/debug', 'debug', { version: '3.1.0', license: 'MIT' }); // non-hoisted duplicate

const cli = path.join(repoRoot, 'src', 'cli.js');

const text = execFileSync(process.execPath, [cli, demoDir], { encoding: 'utf8' });
fs.writeFileSync(path.join(resultsDir, 'demo-report.txt'), text);
console.log(text);

const json = execFileSync(process.execPath, [cli, demoDir, '--json'], { encoding: 'utf8' });
fs.writeFileSync(path.join(resultsDir, 'demo-report.json'), json);
console.log('saved results/demo-report.txt and results/demo-report.json');
