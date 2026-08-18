# The MCP UI Cookbook

**From atomic UI capabilities to native-like applications.**

Read it: <https://let-us-mcp.github.io/MCP-UI-Cookbook/>

A practical reference and conformance suite for building interactive,
host-integrated, agent-connected MCP applications. It takes the surface an MCP
application actually has, cuts it into 85 named capabilities, composes those
into 13 recognisable applications, and ships a harness that decides whether a
host really supports what it claims.

Every demonstration on the site is a live application in a sandboxed iframe,
driven by a host emulator, with its own source and its own JSON-RPC transcript
next to it. Nothing is hosted: it is static files.

Pinned to core protocol `2026-07-28` and the MCP Apps extension
`io.modelcontextprotocol/ui`.

## What is here

```
book/            Markdown. One file per chapter, recipe and appendix.
capabilities/    registry.py, the single source of truth for all 85 entries.
apps/
  lib/           The view stylesheet, helpers, and the shared MCP server.
  labs/          17 capability labs, one per chapter of Parts II and III.
  recipes/       13 recipe applications, each with a real MCP server.
emulator/        The host half of the bridge, the view half, and the demo widget.
conformance/
  transcripts/   Golden JSON-RPC logs, recorded by driving every demo.
figures-src/     Generated figures: mechanism diagrams, cartoons, the cover.
tools/           Build, record, lint, check.
docs/            The generated website. GitHub Pages serves this directory.
```

## Building it

```
make venv      # once, for the figure pipeline
make           # registry, fixtures, demos, figures, site
make check     # what CI runs
make serve     # docs/ on http://127.0.0.1:8977/
```

`make check` runs six things:

| Check | What it proves |
|---|---|
| `lint_prose.py` | No em dashes, no slop, no repeated sentences |
| `check_refs.py` | Every figure exists, every capability has exactly one entry |
| `check_listings.py` | Every listing tagged *extracted* matches the file it names |
| `check_counts.py` | Every number the prose asserts is still true |
| `check_claims.py` | Every wire claim appears in the pinned specification text |
| `check_demos.mjs` | All 30 demonstrations run in Chrome and their transcripts match |

The last one needs Chrome. The claims check needs `proto/`, a pair of
specification clones that are never committed, and skips cleanly without them.

## Running a recipe server for real

Each recipe under `apps/recipes/` is a working MCP server over stdio with no
dependencies:

```
node apps/recipes/r01-data-explorer/server.js
```

It declares the UI extension in `initialize`, registers a `ui://` resource
whose content is the view, and points its tools at that resource through
`_meta.ui.resourceUri`. Point any MCP client at it.

## Contributing a finding

If you build something the 85 capabilities cannot express, that is a finding
rather than a bug. Appendix B is the list of the 14 that already exist, and
each entry names the recipe that needs it, what the workaround costs, the
shape a mechanism would take, and which part of the threat model it reopens.
Findings belong upstream against the extension specification.

## Licence

Prose, figures and site under CC BY 4.0. Code under MIT. See `LICENSE`.
