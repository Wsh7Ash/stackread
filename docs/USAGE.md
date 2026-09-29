# Usage

## Basic

```shell
node src/cli.js <project-root>
```

Requires `package.json` in the target root; `node_modules` should be present
for version/license data (declared-but-not-installed packages are reported).

## Options

| Flag | Effect |
|---|---|
| `--json` | Emit a machine-readable JSON report instead of text |
| `--top N` | Truncate package lists to the first N entries |
| `--max-depth N` | Filter transitive packages to depth ≤ N |
| `--ignore DIR` | Ignore an extra source directory (repeatable) |
| `-h, --help` | Show help |

## Reading the report

- **LAYER 1** — direct dependencies with importer counts. `← UNUSED` means no
  source file imports the package (candidate for removal — check dynamic
  loaders first).
- **LAYER 2+** — transitive dependencies with their BFS depth from your direct
  deps. Deep stacks (depth ≥ 4) are maintenance-risk signals.
- **INSTALLED BUT UNREACHABLE** — packages physically in `node_modules` that
  nothing reaches from your declared deps (stale installs).
- **DUPLICATES** — same package, multiple versions in the tree. Costs install
  size and can cause subtle type/behavior mismatches.
- **LICENSES** — aggregated per package; audit non-permissive entries before
  shipping.
- **DECLARED BUT NOT INSTALLED** — declared deps with no `node_modules`
  presence (broken install).

## CI usage

```shell
node /path/to/stackread/src/cli.js "$PWD" --json > stackread.json
```

The JSON contains `summary`, `unusedDirect`, `duplicates`, `licenses`, and
per-package data — index into it with `jq` as needed, e.g.:

```shell
jq '.unusedDirect' stackread.json
```

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Scan succeeded (any report content) |
| 1 | Scan failed (bad path, missing package.json) |
| 2 | Usage error (unknown flag, missing target) |

## Interpreting caveats

- `importers` counts distinct files that mention the package in an import-like
  statement; it does not prove runtime reachability.
- Config-only packages (loaders, presets referenced by name in config files)
  may show 0 importers while being legitimately used — verify before removing.
