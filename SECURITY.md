# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| 1.0.x | yes |

## Reporting a vulnerability

Open a private GitHub security advisory for `Wsh7Ash/stackread`, or open a
regular issue only if the report contains nothing sensitive. Please include a
minimal reproducer (command + synthetic tree description).

## Security model

- stackread is a **read-only** analyzer. It parses `package.json` files as JSON
  text and never imports, executes, or evaluates code from the scanned project.
- It performs no network access.
- The only writes it performs are the files you explicitly redirect its stdout
  to.
- Treat its output as advisory: reports do not modify the scanned project.

## Out of scope

- Vulnerabilities in packages found during a scan (report those upstream).
- Reports produced against untrusted trees are informational only; do not use
  stackread as a security gate without your own review.
