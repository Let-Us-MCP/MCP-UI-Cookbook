---
title: Conformance Checklists
slug: appendix-c
part: Appendices
number: C
summary: What a host is claiming when it claims a level, phrased as things a test can assert.
---

Levels are cumulative: a host claiming Level 3 passes the checks for Levels 1,
2 and 3. Extended capabilities are not on these lists, because they are
optional at any level and their absence must be handled by applications.

Items marked *not standardised* are Core capabilities with no mechanism. A
host cannot be asked to implement them until the gap in Appendix B is closed,
and they are listed so that the shape of the missing work is visible.

@checklists

## Cross-cutting checks

These apply at every level and are the ones that break the most applications.

**The handshake is truthful.** Every capability present in `hostCapabilities`
behaves as described when used. A capability advertised and not implemented is
worse than one that was never advertised, because it defeats exactly the views
that checked properly.

**The frame is sized from the notification.** When a dimension is flexible,
`ui/notifications/size-changed` changes the frame. A zero from a freshly
appended frame is treated as "not yet" rather than as "empty".

**Teardown waits.** `ui/resource-teardown` is sent before removal and the host
waits for the response, with a bounded but generous deadline. This is the only
data-loss defect in the protocol that a view cannot work around.

**Context changes are partial.** `ui/notifications/host-context-changed`
carries only what changed, and the host does not expect the view to
re-initialise.

**The sandbox is real.** The frame has `allow-scripts` and not
`allow-same-origin`, the CSP is constructed from the resource metadata, and
undeclared origins are blocked.

**Nothing is sent before `ui/notifications/initialized`.** A host that sends
tool input before the view has finished initialising will lose it.

## For application authors

The mirror image, as a pre-ship list.

Read `hostCapabilities` once, at initialisation, and let it decide which
controls exist. Define a fallback for every style variable you use. Format
through `hostContext.locale` and `timeZone`. Report your size on change only.
Answer `ui/resource-teardown` promptly, and flush before you do. Publish state
to the model, not events, and only state that changes an answer. Put every
agent write on the undo stack. Handle all five failure modes from Chapter 5,
and check that the interface is honest in each.

## Publishing a result

A host that runs these checks has a number, and the number is worth publishing
in a form somebody can act on: the level claimed, the checks that failed, and
the date of the run. The model to copy is the public web platform test
dashboards, where a per-feature, per-implementation grid makes it possible to
write portable code without guessing.

Nothing here requires that infrastructure. A markdown table in a repository is
enough to be more useful than the current situation, which is that application
authors discover a host's level by shipping into it.

## What this appendix cannot tell you

Whether a host is good. Every check here is about whether a defined behaviour
happens, and none of them is about whether the result is usable. A host can
pass every Level 2 check and still render views in a 200 pixel column with the
theme variables of a different product. Conformance is the floor, not the
ceiling.
