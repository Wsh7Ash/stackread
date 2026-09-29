# stackread

**Zero-dependency Node.js CLI that reads a JS/TS codebase's real dependency stack: layers, unused direct dependencies, duplicates, and licenses.**

## The problem

`package.json` tells you what a project *declares*. It doesn't tell you:

- which of those declared dependencies nobody actually imports
- how deep the transitive tree goes and what sits at layer 2, 3, 4...
- where the same package exists multiple times at different versions in the tree
- what licenses you're shipping

Reviewing an unfamiliar repo means opening dozens of files to answer these. `stackread` answers them in one read-only pass.

## Key features

- **Layer report** — direct dependencies are layer 1; anything they depend on is layer 2+; depth shown per package
- **Unused direct dependencies** — every direct dep with zero importer files found in source
- **Importer counts** — how many distinct source files import each package
- **Duplicate detection** — same package name existing at multiple versions (non-hoisted installs)
- **License report** — per-package license from package metadata, aggregated counts
- **JSON mode** — `--json` for CI pipelines and further tooling
- **Zero dependencies** — plain Node.js; nothing to install

## Terminal example

```text
$ node src/cli.js examples/demo-project

stackread — dependency layer report for examples/demo-project
Scanned 12 source files, 10 packages.

LAYER 1 (direct dependencies)
  express          4.18.2    importers=3
  lodash           4.17.21   importers=1
  left-pad         1.3.0     importers=0   ← UNUSED

LAYER 2+ (transitive dependencies)
  accepts          1.3.8     depth=2
  body-parser      1.20.1    depth=2
  ...
  ms               2.1.3     depth=3

DUPLICATES
  debug: 2.8.3, 3.1.0 (2 versions)

LICENSES
  MIT (7)  ISC (2)  BSD-3-Clause (1)

SUMMARY
  10 packages · max depth 3 · 1 unused direct dep · 1 duplicate set
```

*(Output above is representative of the format; exact values come from the scanned tree.)*

## Architecture summary

Single-pass pipeline in `src/`:

- `cli.js` — arg parsing, orchestration, rendering
- `scanner.js` — walks `node_modules` building the package graph; walks source trees for import statements
- `analyzer.js` — layers, importer counts, duplicates, licenses, summary
- `render.js` — text rendering and JSON shape

## Requirements

- Node.js ≥ 18 (no dependencies, nothing to install)

## Installation

```shell
git clone https://github.com/Wsh7Ash/stackread.git
cd stackread
```

## Quick start

```shell
node src/cli.js path/to/node-project
```

Run on the bundled fixture:

```shell
node src/cli.js examples/demo-project
```

## Usage examples

```shell
# Top 10 packages by depth/importers instead of the full list
node src/cli.js examples/demo-project --top 10

# Limit transitive layering depth
node src/cli.js examples/demo-project --max-depth 2

# Machine-readable report for CI
node src/cli.js examples/demo-project --json > report.json

# Ignore extra source dirs
node src/cli.js examples/demo-project --ignore dist --ignore build
```

## Configuration

All behavior is CLI flags; no config files. Exit code is `0` on any successful scan (this is a reporting tool, not a gate — interpret the report yourself).

| Flag | Meaning |
|---|---|
| `--json` | JSON output |
| `--top N` | limit package lists to N entries |
| `--max-depth N` | stop layering below N |
| `--ignore DIR` | extra source dir to ignore (repeatable) |

## Testing instructions

```shell
npm test
```

Runs the fixture-based suite with the Node test runner.

## Project structure

```text
stackread/
├─ src/            cli.js, scanner.js, analyzer.js, render.js
├─ tests/          fixture-based unit tests
├─ examples/demo-project/   synthetic target used by tests and demo
├─ results/        generated demo report + JSON
├─ docs/           ARCHITECTURE.md, USAGE.md, PROJECT_SPEC.md
└─ .github/workflows/ci.yml
```

## Limitations

- Import extraction is static (string literals in `import`/`require`/dynamic `import()`); re-export aliasing across files is attributed to the re-exporting file
- No lockfile-only mode: needs `node_modules` present to resolve versions
- Scoped packages and Windows paths handled, but exotic `exports` maps are not followed
- JS/TS source parsing only; no transpilation

## Roadmap

- Lockfile-only mode (npm/yarn/pnpm lock parsing)
- License compatibility policy flags
- `--changed` mode diffing two scans

## Security notes

Read-only scanning. Never executes code from the scanned project; package metadata is parsed as JSON text only. No network access.

## License

MIT
