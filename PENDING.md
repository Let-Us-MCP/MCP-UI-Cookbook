# Pending

What this repository has not done yet, in rough order of how much it would
change the strength of the book's claims. Everything here is also stated in
the chapter it belongs to, so a reader meets it in context rather than only in
a list.

## 1. Render conformance against a live server

**The gap.** Until now nothing ran the actual MCP server, rendered the view it
delivers, fed it that server's actual tool output, and then asserted on what
appeared on screen. Transcripts verified the messages; nothing verified the
pixels, which is the subject of the book.

**Status: built.** `tools/check_render.mjs` with cases in
`conformance/render/`. Thirteen recipes, 88 assertions, run by `make render`
and by CI. It found four bugs on its first pass, three of which no
message-level check could have caught, including one where the book asserted a
safety property the code did not have.

**Still missing inside it.** Assertions on failure paths: a server that errors,
a capability withdrawn mid-session, a teardown with unsaved work. The driver
can express all three and only a few cases use them. Also no visual assertions,
which would need reference images and a tolerance, and are a different kind of
brittle.

## 2. Cross-host conformance

**The gap.** Every demonstration runs against the emulator in this repository,
written by the same person who wrote the applications. That is the condition
under which a capability model looks more general than it is.

**What would close it.** The same 30 demonstrations against `basic-host` from
the extension SDK, then against the MCP-UI client, then against production
hosts where automation is permitted. Results published per host and per
capability, in the manner of the public web platform test dashboards.

**Why it matters most after render conformance.** One host running thirteen
recipes proves the recipes work. Several hosts running them unmodified is the
only evidence that would answer the completeness test in Chapter 25.

## 3. Component layer checks

**The gap.** Part IV components are a shared stylesheet and helper file rather
than a library with stories, and no `axe-core` run is wired into the build.
The accessibility claims come from the Chapter 13 checklist applied by hand.

**What would close it.** Each component in isolation with interaction tests, an
automated accessibility audit, and the ARIA Authoring Practices keyboard
checklists transcribed into executable assertions.

## 4. Human usability sessions

**The gap.** None were run. Every design claim in Parts I and III is an
argument with reasoning behind it, and arguments about interfaces are wrong
more often than their authors expect.

**Most exposed claim.** Chapter 3's local-first principle. If it is wrong, the
recipes are overbuilt in a way no automated check would ever detect.

## 5. Keyboard routes in two recipes

**The gap.** Recipe 6 has no keyboard route to draw an annotation box. Recipe 7
has none to draw a connection by position. Both say so in their entries rather
than claiming otherwise, and both expose the operations as registered tools,
which is a real answer for agent and assistive-technology use and not a
complete one.

## 6. The streaming log announces every line

**The gap.** Recipe 9's log is `role="log"`, so every arriving line is
announced. At five lines a second that is unusable with a screen reader. The
correct behaviour is probably a periodic summary rather than per-line
announcement, and the recipe entry records it as a known limitation.

## 7. Chapter depth

**The gap.** Chapters run 1,100 to 1,500 words against a 1,500 target. The
reference volume in this series runs closer to 2,400 per chapter over fewer
chapters. This one is wider and shallower by design, being a reference rather
than an argument, but several Part II chapters would carry more worked detail.

## 8. Editable examples

**The gap.** The demonstrations run and cannot be edited. Two escalations are
possible and neither is built: an in-browser bundler for the client-only labs,
so a reader can change the view and watch it re-render, and a browser-based
Node runtime for the recipes, which would boot the real server in a tab.

Both are additive. Neither changes what the book claims.
