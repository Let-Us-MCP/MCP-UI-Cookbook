---
title: Glossary
slug: appendix-d
part: Appendices
number: D
summary: The terms this book uses in a specific way.
---

**Agent.** The model-driven participant in the conversation. It can call
tools, receive context, and act on a view through the tools that view
registers. It cannot see the view's pixels or its DOM.

**Agent boundary.** The line between interactions handled locally inside the
view and interactions that involve the model, tools, or external state.
Chapter 3.

**Atomic capability.** The smallest independently useful UI or
host-interaction operation, with a stable namespaced identifier.

**Capability delta.** For a recipe, the capabilities it exercises that no
earlier recipe does. A recipe with an empty delta is merged or deleted.

**Conformance level.** One of four cumulative tiers, Embedded, Interactive,
Native-Like and Agentic, that a host may claim. Appendix C.

**Core.** A capability that is mandatory at its level. The substance of a
level claim.

**Extended.** A capability that is optional at any level. Applications must
handle its absence.

**Golden transcript.** The recorded JSON-RPC message log for a scenario.
Replaying and diffing it is Layer 1 of the verification model.

**Ground.** Where a capability's behaviour comes from: a message on the wire,
core MCP, the browser platform, your own code, or nowhere at all.

**Host.** The application the user is in: a chat client, an IDE, a console. It
connects to servers, allocates surfaces, and mediates every privileged
operation.

**Host context.** The object describing the environment, delivered in the
initialize result and updated by partial notifications: theme, styles, locale,
timezone, display mode, container dimensions, safe area, device capabilities.

**Ownership map.** For an application where both user and agent can write, the
assignment of each region of state to user-owned, agent-owned, or shared.
Chapter 20.

**Recipe.** A reference application composed from components, serving as both
tutorial and integration test.

**Sandbox proxy.** In web hosts, the outer cross-origin iframe that wraps the
view and relays messages, so the host's origin never shares a document with
server-delivered content.

**Structured content.** The `structuredContent` field of a tool result: data
for the view, which never enters the model's context. Distinct from `content`,
which is what the model reads.

**Surface.** The region the host allocates to an application: inline card,
side panel, modal, fullscreen.

**View.** The embedded UI a server delivers as a `ui://` resource and the host
renders in a sandboxed iframe. Used interchangeably with "application" in this
book.
