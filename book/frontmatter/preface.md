---
title: What This Book Is
slug: preface
part: Front matter
summary: 85 capabilities, 30 applications that run on this site, and a build that fails when a sentence stops being true.
---

An MCP application is HTML in a sandboxed iframe that speaks JSON-RPC to a host
over `postMessage`. About twenty methods, four permissions, no storage, no
address bar.

This book cuts that surface into 85 named capabilities, then builds 13
applications out of nothing but those pieces. If the pieces are enough, the
applications work. If one is missing, an application breaks in a specific
place, and Appendix B lists the 14 places where that happened.

## Who is this for?

**You are writing a view.** Start at Appendix A, find the capability, and read
its ground badge first. It tells you in one line whether `input.contextmenu` is
a protocol message, a browser feature, or your afternoon.

**You are writing a host.** Chapter 2 is the entire wire protocol. Appendix C
is a checklist of what each conformance level obliges you to do. Chapter 27
says which three to implement first.

## What actually runs

Every demonstration on this site is a real application in a real sandboxed
iframe, driven by a host emulator that implements the host half of the bridge.
The panel underneath prints the JSON-RPC traffic as it happens. The source
drawer shows the same file the frame is running, fetched from the same URL, so
the two cannot drift.

Thirteen of them have a working MCP server behind them. Run
`node apps/recipes/r01-data-explorer/server.js` and it speaks stdio to any MCP
client. The numbers in the Data Explorer come out of that server, recorded by
`make fixtures`.

None of this needs a model. A host connects to servers, allocates surfaces and
mediates privileged operations, and none of that requires an LLM. That is why
`make render` can start each server, render the view it delivers, and assert on
the resulting DOM.

## What is checked, and how

Ten checks run on every build. The six that catch real errors:

| Check | Fails when |
|---|---|
| `check_claims.py` | A message name in the registry is not in the pinned spec |
| `check_identifiers.py` | An identifier in the prose exists nowhere |
| `check_web_claims.py` | A CSP directive, ARIA name or WCAG number is wrong |
| `check_listings.py` | A listing marked *extracted* no longer matches its file |
| `check_counts.py` | A number the prose asserts is out of date |
| `check_render.mjs` | A recipe's real server stops rendering what it should |

`check_web_claims.py` earned itself immediately. The draft said hit targets
need 44 CSS pixels; WCAG 2.2 requires 24 at AA, and 44 is the AAA criterion.

## What this book gets wrong

**It runs against one host.** The emulator here was written by the same person
as the applications, which is the condition under which a capability model
looks more general than it is. Chapter 26 calls cross-host conformance the
missing layer.

**No usability sessions were run.** Chapter 3's local-first principle is an
argument, not a finding.

**Eight message names are draft-only.** `ui/download-file`,
`sampling/createMessage`, `updateModelContext`,
`ui/notifications/request-teardown`, `notifications/tools/list_changed`,
`downloadFile`, `resource_link` and `isError` are in the current draft and not
in the `2026-01-26` release. Those entries carry a badge.

## Conventions

Every code block says where it came from: *extracted* from a file the tests
run, *captured* from a real run, or *illustrative* and executed by nothing.

Capability identifiers are in `code` and every one appears in Appendix A.
Message names are quoted exactly as the specification writes them, and the
build greps the specification for all 68 of them.

No em dashes anywhere, enforced by `tools/lint_prose.py`.
