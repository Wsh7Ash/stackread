# Contributing

Thanks for considering a contribution to stackread.

## Development setup

- Node.js ≥ 18. No install step — the project has zero dependencies.

```shell
git clone https://github.com/Wsh7Ash/stackread.git
cd stackread
npm test
```

## Ground rules

- Keep the zero-dependency property. Use Node.js stdlib (`fs`, `path`, `crypto`,
  `node:test`) — do not add npm dependencies without discussing the tradeoff in
  an issue first.
- Read-only guarantee: the scanner must never execute code from the scanned
  project or write outside its own output targets.
- Every behavior change ships with tests in `tests/` (fixture-based, using
  `tests/helpers.js` to synthesize node_modules trees).
- Keep output stable: text format changes should be additive; JSON field
  removals/renames are breaking changes and need a major version bump.

## Style

- Plain CommonJS, `'use strict'`, 2-space indent.
- Deterministic output (stable sorting) — no unkeyed object iteration in
  rendering.

## Reporting bugs

Open an issue with:

1. the command you ran,
2. the structure of the target project (a `tree -L 3 node_modules` is fine),
3. actual vs expected output.

Never attach proprietary code; a synthetic reproducer is enough.
