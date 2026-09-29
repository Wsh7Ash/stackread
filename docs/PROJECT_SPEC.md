# PROJECT_SPEC — stackread

- **Name:** stackread
- **Category:** dev-tool
- **Target user:** JavaScript/TypeScript developers and tech leads reviewing unfamiliar Node.js codebases
- **Problem:** Before modifying or auditing a Node.js project you need to know what actually ships: runtime vs dev deps, which dependencies have zero importers in source, transitive dependency depth, repeated packages across the tree, and license spread. Reading package.json alone answers none of this.
- **Solution:** `stackread` is a zero-dependency Node.js CLI that walks `node_modules` (or a lockfile) and source code, then prints a layered report: layer 1 direct deps, layer 2+ transitive deps, per-package importer counts, licenses from `package.json` metadata, hoisting duplicates detected by name+version+count, and an actionable "unused direct dependency" list with a top-5 stack summary.
- **Core workflow:** `node src/cli.js <project-root>` → scan → report to stdout, `--json` machine output, `--top N`, `--max-depth N`
- **Must-have features:** direct/transitive layering; unused direct-dep detection with importer counts; duplicate (non-hoisted) detection; license aggregation; machine-readable JSON mode; exit code 0 always on valid scan (report tool, not gate)
- **Nice-to-have:** top-N deepest stacks; monorepo workspace hint; missing-package detection
- **Stack:** Node.js ≥ 18, zero dependencies (fs, path, crypto)
- **Test strategy:** Node test runner (`node --test`) on synthetic fixture projects — layering correctness, unused detection (imported/not-imported), duplicate detection, license aggregation, JSON mode
- **Demo/result strategy:** run on `examples/demo-project` fixture, save report + JSON to `results/`
- **Safety considerations:** read-only on the target tree; never executes package code; skips symlinks
- **Definition of done:** tests pass, CLI runs on fixture producing report + JSON in `results/`, README matches verified commands
