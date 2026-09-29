#!/usr/bin/env node
/**
 * stackread — dependency layer report CLI for Node.js projects.
 * Zero dependencies. Read-only: never executes scanned code.
 */
'use strict';

const path = require('path');
const { scanProject } = require('./scanner');
const { analyze } = require('./analyzer');
const { renderText, renderJson } = require('./render');

function parseArgs(argv) {
  const args = {
    target: null,
    json: false,
    top: 0,
    maxDepth: 0,
    ignore: [],
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') args.json = true;
    else if (a === '--help' || a === '-h') args.help = true;
    else if (a === '--top') {
      i++;
      const n = Number(argv[i]);
      if (!Number.isInteger(n) || n < 1) throw new Error('--top expects a positive integer');
      args.top = n;
    } else if (a === '--max-depth') {
      i++;
      const n = Number(argv[i]);
      if (!Number.isInteger(n) || n < 1) throw new Error('--max-depth expects a positive integer');
      args.maxDepth = n;
    } else if (a === '--ignore') {
      i++;
      if (!argv[i]) throw new Error('--ignore expects a directory name');
      args.ignore.push(String(argv[i]));
    } else if (a.startsWith('--')) {
      throw new Error(`unknown flag: ${a}`);
    } else {
      if (args.target !== null) throw new Error('exactly one target directory expected');
      args.target = a;
    }
  }
  return args;
}

function usage() {
  return [
    'stackread — dependency layer report for Node.js projects',
    '',
    'Usage:',
    '  node src/cli.js <project-root> [options]',
    '',
    'Options:',
    '  --json          machine-readable JSON output',
    '  --top N         limit package lists to N entries',
    '  --max-depth N   stop layering below depth N',
    '  --ignore DIR    extra source directory to ignore (repeatable)',
    '  -h, --help      show this help',
  ].join('\n');
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(`stackread: ${e.message}`);
    console.error(usage());
    process.exit(2);
  }
  if (args.help) {
    console.log(usage());
    process.exit(0);
  }
  if (!args.target) {
    console.error('stackread: target project directory is required');
    console.error(usage());
    process.exit(2);
  }

  const root = path.resolve(args.target);
  try {
    const scan = scanProject(root, { ignore: args.ignore });
    const report = analyze(scan);
    if (args.json) {
      process.stdout.write(renderJson(report, { top: args.top, maxDepth: args.maxDepth }));
    } else {
      process.stdout.write(renderText(report, { top: args.top, maxDepth: args.maxDepth }));
    }
    process.exit(0);
  } catch (e) {
    console.error(`stackread: ${e.message}`);
    process.exit(1);
  }
}

main();
