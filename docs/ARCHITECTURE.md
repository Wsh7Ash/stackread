# Architecture

## Overview

stackread is a single-pass, read-only analyzer composed of four modules:

```text
scan (scanner.js) → analyze (analyzer.js) → render (render.js) ← cli.js
```

### scanner.js

Two parallel walks:

1. **Package graph** — walks `node_modules/`, including scoped directories and
   nested `node_modules` inside packages (up to depth 8). Each package's
   `package.json` supplies name, version, declared dependencies, and license.
   Result: `Map<name, Map<version, deps[]>>`.
2. **Importer map** — walks project source files (`.js .mjs .cjs .jsx .ts .tsx`),
   skipping `node_modules`, dot-dirs, and common build dirs. Import extraction
   uses five regexes covering static `import ... from`, side-effect `import`,
   `export ... from`, `require()`, and dynamic `import()`. Specifiers are
   normalized to package names (scope-aware) and Node builtins are dropped.
   Result: `Map<pkg, Set<file>>`.

### analyzer.js

- **Layering**: BFS from direct dependencies over resolved dependency edges.
  Layer 1 = direct deps; layer N+1 = dependencies of layer N. Depth is capped
  at 64. Packages installed but unreachable from direct deps are reported as
  orphans.
- **Resolution**: when multiple versions of a package exist, the highest
  semver-ordered version supplies the dependency edges.
- **Duplicates**: any package name present at >1 version anywhere in the tree
  (i.e., non-hoisted installs).
- **Licenses**: read per package from its on-disk `package.json` (`license`
  string or array; otherwise `Unknown`), aggregated into counts.
- **Unused direct deps**: direct dependencies with zero importer files.
- **Summary**: totals, max depth, unused count, duplicate sets, missing count.

### render.js

Deterministic text rendering (layered sections, `← UNUSED` markers) and a
stable JSON payload. `--top N` truncates lists; `--max-depth N` filters
transitive entries. Sorting is stable: importers desc, then name; depths asc,
then name.

## Design decisions

- **Zero dependencies** — the tool must be trustworthy on any machine; a
  dependency analyzer with its own dependency tree would be ironic and slower
  to vet.
- **Read-only, no code execution** — scanned package code is never imported or
  run; only `package.json` files are parsed as JSON. Safe to point at
  untrusted checkouts.
- **Regex import extraction** — deliberately not a full JS parser. It covers
  the common literal-import forms; exotic computed requires are out of scope
  and documented as a limitation.
- **Report, not gate** — exit code 0 on any successful scan; humans or CI
  scripts interpret the output.

## Data flow

```text
package.json (root)  ──direct deps──┐
node_modules walk     ──graph───────┼→ analyzer → report → render (text|json)
source tree walk      ──importers───┘
```
