# Results

## Environment
- OS: Windows 11 (win32, Git Bash)
- Runtime: Node.js v24.13.0
- Dependency manager: none (zero dependencies, stdlib only)

## Validation performed
- install: PASS (no dependencies)
- build: PASS (plain Node.js; syntax checked by executing CLI)
- unit tests: PASS — 13/13 (`npm test` → `node --test`)
- integration tests: N/A (CLI exercised end-to-end inside unit tests)
- lint: N/A (no linter configured)
- type check: N/A (plain JavaScript)
- demo run: PASS (`node scripts/demo.js` → `results/demo-report.txt`, `results/demo-report.json`)

## Commands executed
```shell
npm test
node scripts/demo.js
node src/cli.js examples/demo-project --json
```

## Observed result
- 13/13 tests pass: specifier normalization (scopes/subpaths/builtins), import extraction across all five syntactic forms, fixture-based graph building (scoped + nested node_modules), layering (express→accepts→negotiator gives max depth 3), unused direct-dep detection, declared-but-not-installed detection, devDependencies counted as direct, semver ordering, duplicate set detection (debug 2.8.3 vs nested 3.1.0), text and JSON rendering, CLI exit codes (0 scan / 1 scan-failure / 2 usage).
- Demo scan of the synthetic tree (9 unique package names): left-pad flagged `← UNUSED` (0 importers), debug duplicate set (2.8.3 + 3.1.0), mkdirp installed-but-unreachable, licenses MIT×8 WTFPL×1, max depth 3.
- Defects caught by tests/demo and fixed before release:
  1. The demo fixture initially wrote the nested debug package's manifest with name `express/node_modules/debug`, so duplicate detection saw two distinct packages; fixed to emit two versions of the same name.
  2. Test-side expectation fixes (unique-name vs version counting; raw specifier extraction vs builtin filtering; asserting `err.status` for CLI exit codes).
  3. `npm test` invocation changed from `node --test tests/` (unsupported directory-arg form on this Node/Windows build) to plain `node --test` discovery.

## Generated artifacts
- `results/demo-report.txt` — full text report of the demo tree
- `results/demo-report.json` — machine-readable report with summary/unusedDirect/duplicates/licenses

## Known limitations
- Static literal-import extraction only; computed `require(variable)` is not visible
- Needs `node_modules` on disk (no lockfile-only mode yet)
- Config-only packages (loaders/presets referenced by name in config files) can show 0 importers
