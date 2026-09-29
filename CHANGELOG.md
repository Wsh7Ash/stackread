# Changelog

## 1.0.0 — 2026-09-29

Initial release.

- Dependency layer report (direct = layer 1, BFS transitive layers)
- Unused direct dependency detection with per-package importer counts
- Duplicate (multi-version) package detection across nested node_modules
- License aggregation from installed package metadata
- Installed-but-unreachable orphan report and declared-but-not-installed report
- Text and JSON output with `--top` and `--max-depth` filters
- Zero runtime dependencies; Node.js ≥ 18
