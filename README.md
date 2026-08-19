# The MCP UI Cookbook

**From atomic UI capabilities to native-like applications.**

Read it: <https://let-us-mcp.github.io/MCP-UI-Cookbook/>

A practical reference and conformance suite for building interactive,
host-integrated, agent-connected MCP applications. It takes the surface an MCP
application actually has, cuts it into 87 named capabilities, composes those
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

`make check` runs eleven things:

| Check | What it proves |
|---|---|
| `lint_prose.py` | No em dashes, no slop, no repeated sentences |
| `audit_density.py` | Sentences carry an identifier, a number or an instruction, not commentary |
| `check_refs.py` | Every figure exists, every capability has exactly one entry |
| `check_listings.py` | Every listing tagged *extracted* matches the file it names |
| `check_counts.py` | Every number the prose asserts is still true |
| `check_claims.py` | Every wire claim appears in the pinned specification text |
| `check_identifiers.py` | Every identifier in the prose exists in a spec, the SDK or the source |
| `check_web_claims.py` | Every sandbox token, CSP directive, ARIA name and WCAG number matches its own spec |
| `check_sdk_client.mjs` | Every recipe server answers the real MCP SDK, not just the host written here |
| `check_demos.mjs` | All 30 demonstrations run in Chrome and their transcripts match |
| `check_render.mjs` | Each recipe's real server renders and produces the expected DOM |

The last two need Chrome. The specification checks and the SDK client check
need `proto/`, which holds a pair of specification clones and an installed
copy of `@modelcontextprotocol/sdk`, is never committed, and which they all
skip cleanly without.

```
mkdir -p proto/sdk-client && cd proto/sdk-client
npm install @modelcontextprotocol/sdk
```

### Render conformance

`make render` is the check that covers what the book is actually about. For
each of the thirteen recipes it starts the real MCP server as a child process,
does the host's `initialize` declaring the UI extension, reads
`_meta.ui.resourceUri` off the tool, fetches the view's HTML through
`resources/read`, renders it in a sandboxed iframe, proxies the view's own
`tools/call` back to that server, forwards the server's progress
notifications, and then asserts on the DOM inside the frame.

No model is involved at any point. A host connects to servers, renders
surfaces and mediates privileged operations, and none of that needs one. This
harness is a host driven by a JSON file.

Reading into the frame is done over the DevTools Protocol rather than from page
script, because page script cannot: the frame has an opaque origin, which is
the property that stops a host reading a view. A debugger can, which makes the
sandbox that ships testable without weakening it.

```
node tools/check_render.mjs                  # 13 cases, 156 assertions
node tools/check_render.mjs r04-document-editor
```

Cases live in `conformance/render/*.json` and can click inside the view, call
its registered tools, and change the host context between assertions.

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

If you build something the 87 capabilities cannot express, that is a finding
rather than a bug. Appendix B is the list of the 14 that already exist, and
each entry names the recipe that needs it, what the workaround costs, the
shape a mechanism would take, and which part of the threat model it reopens.
Findings belong upstream against the extension specification.

## Licence

Prose, figures and site under CC BY 4.0. Code under MIT. See `LICENSE`.
