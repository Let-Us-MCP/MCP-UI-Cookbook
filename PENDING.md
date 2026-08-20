# Pending

What this repository has not done yet, in rough order of how much it would
change the strength of the book's claims. Everything here is also stated in
the chapter it belongs to, so a reader meets it in context rather than only in
a list.

## 0. Re-testing the gaps themselves

**The failure.** Appendix B listed sixteen capabilities as absent. Several of
those entries made claims about a browser rather than about the specification,
and none of those claims had ever been run. Two entries also prescribed a
workaround that nobody had built, which is the same defect the book spends
Part VI warning about: an assertion nothing checks.

**What closed it.** `tools/check_sandbox.mjs` runs a probe in a real sandboxed
frame with an unsandboxed control beside it. It corrected `clipboard.read`,
which had a working route the book prescribed and never built, and it recorded
that `window.print()` fails by returning normally and doing nothing. The paste
target now exists in `lab-clipboard` and the focus tool in Recipe 13.

**Also closed.** Drag and drop across an opaque-origin frame was recorded as
untested on the reasoning that headless Chrome will not begin a drag. It will.
The probe had been pressing at a fixed offset inside the frame rather than on
the draggable element. Pressing on the element starts the drag, Chrome exports
a `text/plain` payload out of the sandboxed origin, and a drop carrying it
reaches the host's own document. Appendix B now says so, including the part
the harness drives rather than observes: a headless run has no drag loop, so
the harness dispatches the drop with the intercepted data.

**Still open.** Nothing in this section. The remaining protocol gaps were
re-read against a specification snapshot confirmed current, and stand.

## 1. Render conformance against a live server

**The gap.** Until now nothing ran the actual MCP server, rendered the view it
delivers, fed it that server's actual tool output, and then asserted on what
appeared on screen. Transcripts verified the messages; nothing verified the
pixels, which is the subject of the book.

**Status: built.** `tools/check_render.mjs` with cases in
`conformance/render/`. Thirteen recipes, 156 assertions, run by `make render`
and by CI. It found four bugs on its first pass, three of which no
message-level check could have caught, including one where the book asserted a
safety property the code did not have.

**Failure paths: built.** The driver has three levers now. `deny` withdraws a
host capability mid-session, `failNextCall` makes the next tool call return
`isError: true` or reject, and `teardown` starts the close handshake. They
found two real defects on the first pass: Recipe 1's export button was
completely silent when the host refused, and Recipe 4 marked the document
saved when the save had failed, which is silent data loss in an autosaving
editor. Teardown-with-unsaved-work now has a case as well as a lever: Recipe 4
is left dirty by a refused save, the host starts the handshake, and the case
asserts that the flush went out, that the document ends saved, and that the
view answered the host rather than leaving it waiting.

**Still missing inside it.** Reference-image comparison is absent, and would need stored
images and a tolerance, which is a different kind of brittle. What the harness
does assert is geometry: `prop` reads a decoded image's `naturalWidth` and
`box` reads a rendered element's own rectangle, which is what separates a
drawn shape from an element that exists and draws nothing. That gap was real.
Recipe 3 shipped an inline PNG whose base64 was corrupted by a stray unary
plus, the book said it was a real image, and a case asserting the `<img>` and
its `alt` text passed for as long as both were wrong.

The harness also watches for
unhandled rejections in the frame, which caught a deliberately provoked one
but did not fire for a real refused request; that detector is a bonus signal
and not something the suite relies on.

## 2. Cross-host conformance

**The gap.** Every demonstration runs against the emulator in this repository,
written by the same person who wrote the applications. That is the condition
under which a capability model looks more general than it is.

**The server half: built, three checks.** `tools/check_sdk_client.mjs` drives
all thirteen recipe servers over `@modelcontextprotocol/sdk`'s own stdio
transport, 218 assertions. `tools/check_differential.mjs` re-serves everything
they publish through the SDK's own `Server` and reads it back through its
`Client`, 92 assertions, so the reference implementation's validation sees
every descriptor and result. `tools/check_musts.py` holds
`conformance/musts.json`, in which each of the 85 server-directed MUSTs in the
pinned specification is classified as implemented, not applicable or open with
a note, and an unclassified one fails the build. The first two need
`proto/sdk-client/` and skip without it; the third needs the specification
clone.

They found four defects, all MUSTs, all in all thirteen servers: `initialize`
answering with its own `protocolVersion` whatever was asked, no
`server/discover`, `-32002` for a missing resource where this version forbids
that code and expects `-32602`, and the per-request `_meta` protocol fields
neither sent nor required. None was reachable from a host that already speaks
`2026-07-28`, which is why nothing here had caught them.

**The largest open gap is now inside the servers.** `2026-07-28` moved to a
stateless per-request model: every request carries
`io.modelcontextprotocol/protocolVersion` and
`io.modelcontextprotocol/clientCapabilities` in `_meta`, a server MUST reject a
request missing them with `-32602`, and a server MUST NOT rely on a prior
request over the same connection to establish that context. This repository is
still on the connection-state model from earlier versions: the emulator, the
render driver and both SDK checks send none of it, and no server asks for it.
Six of the eleven open entries in the ledger are that one gap. Closing it
changes every client here, every recorded transcript and several wire listings
in the book, which is why it is stated rather than patched quietly.

**The host half: still open, and blocked.** This book is pinned to
`2026-07-28`; the published SDK at 1.30.0 supports up to `2025-11-25` and its
`Client` refuses the handshake rather than negotiating. So `basic-host` cannot
drive these servers until one side moves. The check works around it by using
the SDK's transport and building its own requests, and reports that it does.

**What would still close it.** The same 30 demonstrations against
`basic-host`, then the MCP-UI client, then production hosts where automation
is permitted, published per host and per capability in the manner of the
public web platform test dashboards. One host running thirteen recipes proves
the recipes work. Several hosts running them unmodified is the only evidence
that would answer the completeness test in Chapter 26.

## 3. Component layer checks

**Status: partly built.** `axe-core` is vendored and runs against all thirteen
recipes inside the render harness, after the interactions rather than on load.
Four page-level rules are disabled by name with a reason each, because a view
is a fragment and not a page. It found five defects on its first run,
including one critical ARIA misuse and two contrast failures.

**Still missing.** The components are audited only through the recipes that
use them, because there is no component library with stories to audit them in
isolation. The ARIA Authoring Practices keyboard checklists are still prose
rather than executable assertions, though the harness can now dispatch keys
and two canvases are driven that way.

## 4. Human usability sessions

**The gap.** None were run. Every design claim in Parts I and III is an
argument with reasoning behind it, and arguments about interfaces are wrong
more often than their authors expect.

**Most exposed claim.** Chapter 4's local-first principle. If it is wrong, the
recipes are overbuilt in a way no automated check would ever detect.

## 5. Keyboard routes in two recipes

**Status: fixed.** Recipe 6 draws a box with a caret, arrow keys and Enter.
Recipe 7 selects nodes with Enter and moves them with the arrow keys, and its
nodes are `role="button"` with `aria-pressed` instead of silent focusable
divs. The render harness gained a `keys` step, so both routes are driven by
real key events and asserted on the resulting DOM. Both recipes still expose
the operations as registered tools, which remains the better route for an
agent.

## 6. The streaming log announces every line

**Status: fixed.** Recipe 9's log carries `aria-live="off"` and announces a
summary every five seconds: "twelve new lines, two errors", and nothing at all
when nothing arrived. The render harness asserts the attribute, so a future
edit that restores the implicit live region fails the build.

## 7. Chapter depth

**Status: closed.** The entry described chapters running 1,100 to 1,500 words
against a 1,500 target. They now run 1,500 to 3,122, mean 1,918 and median
1,843 across 29 chapters, with none below the target. The reference volume in
this series runs closer to 2,400 per chapter over fewer chapters, and this one
is still wider by design, being a reference rather than an argument.

## 8. Editable examples

**The gap.** The demonstrations run and cannot be edited. Two escalations are
possible and neither is built: an in-browser bundler for the client-only labs,
so a reader can change the view and watch it re-render, and a browser-based
Node runtime for the recipes, which would boot the real server in a tab.

Both are additive. Neither changes what the book claims.
