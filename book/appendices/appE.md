---
title: Prior Art and Sources
slug: appendix-e
part: Appendices
number: E
summary: Where each part of this book is anchored, and every specification, guide and tool it depends on.
---

## Where each concern is anchored

| Cookbook concern | Source |
|---|---|
| Protocol, UI resources, bridge | MCP specification; MCP Apps extension (SEP-1865) |
| Prior UI-over-MCP practice | MCP-UI; OpenAI Apps SDK |
| Component keyboard and ARIA behaviour | ARIA Authoring Practices Guide; WAI-ARIA 1.2; WCAG 2.2 |
| Semantic colour roles | Material Design 3; Fluent 2 |
| Theme wire format | Plain CSS custom properties, per the extension. Not DTCG. |
| Adaptive appearance | Apple Human Interface Guidelines |
| Sandboxing, drag and drop, page visibility | HTML Living Standard |
| Content security policy, permissions | CSP Level 3; Permissions Policy |
| Clipboard, pointer, share | Clipboard API; Pointer Events 3; Web Share API |
| Conformance suite model | web-platform-tests |
| Test tooling | Chrome DevTools Protocol; MCP Inspector |
| Live book tooling | Static hosting, and nothing else |

## Specifications

Model Context Protocol, specification version 2026-07-28.
<https://modelcontextprotocol.io/specification/2026-07-28>

MCP Apps Extension, SEP-1865, extension identifier
`io.modelcontextprotocol/ui`. Dated release 2026-01-26, plus the current
draft. <https://github.com/modelcontextprotocol/ext-apps>

MCP Apps SDK documentation, including the `basic-host` reference host and the
example servers. <https://apps.extensions.modelcontextprotocol.io>

MCP Apps: Extending servers with interactive user interfaces. MCP Blog,
November 2025.
<https://blog.modelcontextprotocol.io/posts/2025-11-21-mcp-apps/>

MCP-UI: UI over MCP. <https://github.com/MCP-UI-Org/mcp-ui>

OpenAI Apps SDK, which implements the MCP Apps standard.
<https://developers.openai.com/apps-sdk/>

## Web platform

WHATWG HTML Living Standard, for iframe sandboxing, drag and drop, and page
visibility. <https://html.spec.whatwg.org/>

W3C Content Security Policy Level 3. <https://www.w3.org/TR/CSP3/>

W3C Permissions Policy. <https://www.w3.org/TR/permissions-policy/>

W3C Clipboard API and events. <https://www.w3.org/TR/clipboard-apis/>

W3C Pointer Events Level 3. <https://www.w3.org/TR/pointerevents3/>

W3C Web Share API. <https://www.w3.org/TR/web-share/>

## Accessibility

W3C WAI, ARIA Authoring Practices Guide.
<https://www.w3.org/WAI/ARIA/apg/>

W3C, Accessible Rich Internet Applications (WAI-ARIA) 1.2.
<https://www.w3.org/TR/wai-aria-1.2/>

W3C, Web Content Accessibility Guidelines (WCAG) 2.2.
<https://www.w3.org/TR/WCAG22/>

## Design systems

Design Tokens Community Group, Design Tokens Format Module.
<https://www.designtokens.org/>

Listed because the outline this book was planned from assumed the host theme
would arrive as DTCG tokens. It does not. The MCP Apps extension sends plain
CSS custom properties with standardised names, which Chapter 12 documents, and
no conversion step exists in either direction. The DTCG format remains the
right thing if you are generating those variables from a design system, which
is a build-time concern rather than a wire one.

Google, Material Design 3. <https://m3.material.io/>

Microsoft, Fluent 2 Design System. <https://fluent2.microsoft.design/>

Apple, Human Interface Guidelines.
<https://developer.apple.com/design/human-interface-guidelines>

## Testing

web-platform-tests, the cross-browser suite for web platform
specifications, with public results at wpt.fyi.
<https://web-platform-tests.org/>

Model Context Protocol Inspector.
<https://github.com/modelcontextprotocol/inspector>

Deque Systems, axe-core. <https://github.com/dequelabs/axe-core>

## A note on what is pinned

This book is pinned to core protocol `2026-07-28` and to the MCP Apps
extension `io.modelcontextprotocol/ui`, with wire claims checked against the
current specification draft rather than against the dated 2026-01-26 release.
Eight message names used here exist in the draft and not in that release, and
the entries that use them carry a *draft only* badge.

The SDK version referenced is 1.7.5. Nothing in this book depends on that SDK
at runtime; the bridge in `emulator/` is an independent implementation, and
the SDK is what you should use in production.
