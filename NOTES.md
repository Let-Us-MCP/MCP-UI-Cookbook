# Working notes

What was decided, what it cost, and what is still wrong. Updated as work lands.

**Target:** <https://github.com/Let-Us-MCP/MCP-UI-Cookbook>, published at
<https://let-us-mcp.github.io/MCP-UI-Cookbook/>
**Pinned to:** core protocol `2026-07-28`, MCP Apps extension
`io.modelcontextprotocol/ui` (release `2026-01-26` plus the current draft),
SDK `1.7.5`
**Reference material:** `proto/ext-apps` and `proto/modelcontextprotocol`,
clones of the two specification repositories, never committed.

## House style, binding on every page

1. **No em dashes.** Not one. `tools/lint_prose.py` enforces it.
2. **No AI slop.** Banned-phrase list, cadence budget, and near-duplicate
   sentence detection across the whole book. Same linter.
3. **No invented anecdotes.** Every example is a running application in this
   repository, labelled and clickable.
4. **Every listing says where it came from.** Extracted, captured, or
   illustrative, and the extracted ones are checked against their files.
5. **Every number is computed.** `tools/check_counts.py` recomputes what the
   prose asserts about the repository.
6. **Every identifier is real.** `tools/check_identifiers.py` requires each one
   to appear in a specification, the SDK, or this repository's source.

## Architecture

```
book/            Markdown. One file per chapter, recipe and appendix.
capabilities/    registry.py, the single source of truth for all 85 entries.
apps/lib/        View stylesheet, helpers, and the shared stdio MCP server.
apps/labs/       17 capability labs, one per chapter of Parts II and III.
apps/recipes/    13 recipe applications, each with a real MCP server.
emulator/        Host half of the bridge, view half, and the demo widget.
conformance/     Golden JSON-RPC transcripts for all 30 demonstrations.
figures-src/     Generated diagrams, cartoons and the cover.
docs/            The generated website. Pages serves this directory.
```

## Decisions and their reasons

**The registry drives everything.** Level, tag, ground, wire anchors, chapter
and demo live in one Python file. Badges, the index, the matrix, the
checklists and the gap table are all generated from it. A chapter can describe
a capability and cannot restate its facts, because it has no way to.

**Five grounds, not two.** The useful question is not "does the protocol
support this" but "who is responsible". Splitting into wire, core, platform,
app and gap turned an argument about coverage into a countable claim: 28
messages, 4 from core MCP, 20 from the browser, 19 yours, and 14 with no
mechanism at all.

**The book's own bridge, not the SDK.** Production code should use
`@modelcontextprotocol/ext-apps`. The 250-line bridge here exists so the
transcript pane on each page has nothing hidden behind it. Both are in the
repository and the code tab shows the one actually running.

**Classic script, not a module.** The first bridge was an ES module, which is
a CORS request from an opaque origin, which a static file host will not answer.
The comment explaining this is at the top of `emulator/app-bridge.js`.

**Fixtures are recorded from real servers.** `tools/record_fixtures.mjs` starts
each recipe's server over stdio and records its answers. The demonstration is
honest even though the server is not executing in the browser, and the chain is
regenerated on every build.

**Render conformance runs the real server.** `tools/check_render.mjs` starts
each recipe's server over stdio, does the host handshake, reads the view's HTML
through `resources/read`, renders it, proxies the view's own tool calls back to
that server, forwards its progress notifications, and asserts on the DOM. No
model is involved: a host connects, renders and mediates, and none of that
needs one.

**The frame is read over CDP, not from page script.** Page script cannot,
because the frame has an opaque origin, which is the property that stops a host
reading a view. Attaching flatly to the child target gives a session that can
evaluate inside it. The shipped sandbox is unchanged.

**The harness also drives views through their registered tools.** A sandboxed frame
with an opaque origin cannot be driven from outside, which is the same property
that stops a host reading it. Recipes that register tools are driven deeply;
the rest are checked for handshake, render and host-side flows. This is the
same mechanism Chapter 19 recommends for accessibility, which is a decent sign
it is the right one.

## What building it found

- **An empty red banner in the Data Explorer.** An author rule with a class
  selector beats the user agent's `[hidden]` rule, so `hidden` silently stopped
  working on every component that set `display`. One declaration in
  `apps/lib/view.css`, with the comment still attached.
- **A transcript that changed every run.** The workflow builder minted node ids
  from `Date.now()`, and those ids reach the wire in a tool result. Anything
  that crosses the boundary has to be deterministic or Layer 1 is noise.
- **Dynamic import resolves against the module, not the page.** The demo widget
  404ed on every page except the harness.
- **Half a theme is worse than none.** Applying host style variables without
  removing the ones the host stopped sending leaves the previous theme in
  place. The bridge now tracks and clears what it applied.
- **Two listings had been quietly abridged** and presented as extracted.
  `tools/check_listings.py` exists because of that.
- **The Core capability count was wrong in Chapter 1**, written from an
  estimate rather than from the registry. `tools/check_counts.py` exists
  because of that.
- **A spreadsheet full of `#VALUE`.** Every text cell rendered as an error,
  because the evaluator passed cell contents through `Number()` and the view
  rendered the `NaN`. Present in every screenshot; nobody had read the
  top-left cell.
- **Accepting the agent's rewrite could not be undone.** Recipe 4 recorded its
  transaction by comparing the document against itself before replacing it, so
  nothing was pushed. The book asserts this exact safety property in two
  chapters and the code did not have it.
- **The monitoring console rendered every line twice**, because it received the
  tool result it was rendered for and also called the tool on mount. Two rows
  shared an identifier, so selecting one selected both.
- **A server died of EPIPE** when its host went away mid-write. Guarded in
  `apps/lib/mcp-server.js`.
- **A specification and SDK divergence.** The extension's list of standard MCP
  messages available to a view names only `resources/read`, while the SDK ships
  `listServerResources()` and documents building a picker with it, and
  `hostCapabilities.serverResources.listChanged` exists. Chapter 12 reports it
  as a documentation gap rather than asserting a design one.
- **Eight message names are draft-only.** `ui/download-file`, `downloadFile`,
  `ui/notifications/request-teardown`, `updateModelContext`,
  `sampling/createMessage`, `notifications/tools/list_changed`,
  `resource_link` and `isError` are in the current draft and not in the
  `2026-01-26` release. The badge on each affected entry is generated from that
  comparison rather than remembered.

## Open items

- **One host.** Everything runs against hosts written in this repository: the
  browser emulator and the render driver. Layer 5 of Chapter 27, the same suite
  against `basic-host` and against production hosts, is the check that would
  turn the completeness argument into evidence. It is now the largest gap in
  the book's own verification.
- **No component layer tests.** Part IV components are a shared stylesheet and
  helper file rather than a library with stories, so they are audited only
  through the recipes that use them. `axe-core` is vendored and does run
  against all thirteen, after the interactions rather than on load.
- **No usability sessions.** Every design claim is an argument. Chapter 4's
  local-first principle is the one most exposed to being wrong in a way no
  automated check would detect.

`PENDING.md` is the authority on what is open, and this list drifted behind it
once already: it still described a weak keyboard story in Recipes 6 and 7, a
log that announces every line, chapters short of their target and an `axe-core`
run that was not wired in, after all four had been closed. A stale list of
known limitations is the same defect the book spends Part VI on, which is an
assertion nothing checks.
