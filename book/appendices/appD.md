---
title: Glossary
slug: appendix-d
part: Appendices
number: D
summary: The terms this book uses in a specific way, each with the message, field or file it corresponds to.
---

**Agent.** The model-driven participant. It calls server tools through the
host, and it calls *your* tools through `tools/call` when you declare
`appCapabilities.tools`. It never sees your pixels or your DOM. Chapter 18.

**Agent boundary.** The line between what runs locally and what crosses to the
model. Chapter 3 puts sorting, filtering and selection on the local side.

**Atomic capability.** The smallest independently useful operation, with a
namespaced identifier such as `surface.resize`. All 85 are in Appendix A.

**Capability delta.** The capabilities a recipe exercises that no earlier
recipe does, generated into each recipe entry. Recipe 1 claims 16; by Recipe 13
they are down to a handful.

**Conformance level.** One of four cumulative tiers: 1 Embedded, 2 Interactive,
3 Native-Like, 4 Agentic. 9 capabilities sit at level 1, 41 at level 2, 17 at
level 3 and 18 at level 4. Appendix C is the checklist.

**Core.** Mandatory at its level. 67 of the 85 are Core.

**Extended.** Optional at any level, so your view must work without it. 18 of
the 85.

**Golden transcript.** The recorded JSON-RPC log for one demonstration, in
`conformance/transcripts/`. `node tools/check_demos.mjs` replays and diffs all
30 of them.

**Ground.** Where a capability's behaviour comes from: `wire` (28), `core` (4),
`platform` (20), `app` (19) or `gap` (14). The badge on every entry.

**Host.** The chat client, IDE or console the user is in. It connects to
servers, allocates surfaces and mediates every privileged operation. It needs
no model to do any of that.

**Host context.** The object in the `ui/initialize` result: `theme`, `styles`,
`locale`, `timeZone`, `displayMode`, `containerDimensions`, `safeAreaInsets`,
`deviceCapabilities`, `platform`, `userAgent`, `toolInfo`. Updated by
`ui/notifications/host-context-changed`, which carries only changed keys.

**Ownership map.** Each region of state labelled user-owned, agent-owned or
shared, written down before the code. Chapter 20; Recipe 4 declares one.

**Recipe.** A reference application that is also an integration test. Thirteen
of them, in `apps/recipes/`, each with an MCP server that runs over stdio.

**Sandbox proxy.** The outer cross-origin iframe a web host must wrap your view
in, so the host's origin never shares a document with server-delivered content.
It relays every message except `ui/notifications/sandbox-*`.

**Structured content.** The `structuredContent` field of a `CallToolResult`.
Your view reads it; it never enters the model's context. Distinct from
`content`, which is what the model reads.

**Surface.** The region the host allocates: inline card, side panel, modal or
fullscreen. Its size arrives as `containerDimensions`; its mode as
`displayMode`.

**View.** The HTML your server delivers as a `ui://` resource with mimeType
`text/html;profile=mcp-app`, rendered in an iframe with `allow-scripts` and no
`allow-same-origin`. Used interchangeably with "application" here.
