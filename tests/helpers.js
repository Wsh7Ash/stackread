/**
 * tests/helpers.js — synthetic node_modules fixture builder.
 */
'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Build a synthetic project with node_modules from a spec.
 * spec: {
 *   direct: { name: version, ... },
 *   devDirect: { name: version, ... },
 *   packages: { name: { version, deps: [names], license } },
 *   nested: { parentName: { name: { version, deps } } },
 *   sources: { 'relpath': 'file content' },
 * }
 * @returns {string} created project root
 */
function makeProject(basedir, spec) {
  const root = path.join(basedir, 'proj');
  const modules = path.join(root, 'node_modules');
  fs.mkdirSync(modules, { recursive: true });

  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({
      name: 'proj',
      version: '1.0.0',
      dependencies: spec.direct || {},
      devDependencies: spec.devDirect || {},
    })
  );

  for (const [name, meta] of Object.entries(spec.packages || {})) {
    writePkg(modules, name, meta);
  }
  for (const [parent, inner] of Object.entries(spec.nested || {})) {
    for (const [name, meta] of Object.entries(inner)) {
      writePkg(path.join(modules, parent, 'node_modules'), name, meta);
    }
  }
  for (const [rel, content] of Object.entries(spec.sources || {})) {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
  return root;
}

function writePkg(base, name, meta) {
  const parts = name.split('/');
  const dir = name.startsWith('@') ? path.join(base, parts[0], parts[1]) : path.join(base, name);
  fs.mkdirSync(dir, { recursive: true });
  const pj = { name, version: meta.version };
  if (meta.license) pj.license = meta.license;
  const deps = {};
  for (const d of meta.deps || []) deps[d] = '*';
  if (Object.keys(deps).length) pj.dependencies = deps;
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pj));
}

module.exports = { makeProject };
