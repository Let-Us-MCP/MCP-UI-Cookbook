---
title: What This Book Is
slug: preface
part: Front matter
summary: Two audiences, one artifact, and a promise that everything here runs.
---

This book cuts the surface of an MCP application into eighty-five named
pieces, then builds thirteen recognisable applications out of nothing but
those pieces.

If the pieces are enough, the applications work. If one is missing, an
application fails in a specific place, and that failure is worth more than
another paragraph of prose.

The alternatives are worse. Explaining the messages produces a document that is
correct and that nobody can build from. Showing one working application
produces a tutorial that is useful once and then rots.

The pieces are called atomic capabilities. `surface.resize` is one. So are
`clipboard.write`, `tool.invoke` and `history.undo`.

Each gets an entry: what the user sees, what your code does, what the host owes
you, what happens when it is absent, and how to test any of it.

Above them are components, which are capabilities composed into things with
familiar names: a combobox, a modal, an editable grid. Above those are recipes,
which are whole applications.

Underneath all of it is a conformance suite. A book about what hosts *should*
support is worth little without a way to find out what they *do*.

## Who is this for?

**Application authors** get a catalogue. When you need a context menu inside a
sandboxed iframe that the host has never heard of, there is an entry that says
whether that is a protocol feature, a browser feature, or something you are
about to write yourself, and what the fallback looks like when it is denied.
When you need to know whether sorting a table should involve the model, there
is a principle with a name and thirteen worked examples of applying it.

**Host implementers** get a specification of expectations and a way to check
them. The capabilities are sorted into four cumulative conformance levels. A
host that claims Level 2 is claiming that a specific list of observable
behaviours works, and the list is phrased so that each item can be asserted by
a test rather than argued about in an issue thread.

Both audiences get the same artifact, because the disagreements between them
are the interesting part. Most of what makes an MCP application feel wrong is
not a bug in either half. It is a capability that one side assumed and the
other never promised.

## What is normative here?

The normative foundation is the Model Context Protocol specification and the
MCP Apps extension, `io.modelcontextprotocol/ui`, which standardises UI
resources under the `ui://` scheme, links tools to them through
`_meta.ui.resourceUri`, mandates sandboxed iframe rendering, and defines a
bidirectional JSON-RPC channel over `postMessage`. That extension consolidates
patterns worked out first by MCP-UI and by OpenAI's Apps SDK. This book does
not restate those documents and does not compete with them.

What it adds is organisation and honesty about coverage.

Every entry in Parts II and III carries a label saying where its behaviour
comes from. Some are messages the extension defines, cited by name. Some come
from core MCP. A large number are just the browser doing its job inside the
sandbox, and saying so saves you hunting for a protocol feature that does not
need to exist. Some you write yourself.

And some have no mechanism anywhere. That label matters most: an application
that needs one is about to invent a private convention with one host.

The labels are not editorial judgement. They are generated from a machine
readable registry, and a build step greps the specification text for every
message name the registry claims exists. If the extension renames something,
the build fails before the sentence describing it can go stale.

## What actually runs?

Every demonstration in this book is a live application. The frame you can
click in is a real MCP application in a real sandboxed iframe, driven by a
host emulator that implements the host half of the bridge, and the panel
underneath it is the actual JSON-RPC traffic between them, printed as it
happens. The source shown in the code tab is the same file the frame is
running, fetched from the same directory, not a paraphrase of it.

That arrangement is possible because of what an MCP application physically is.
It is HTML in a sandboxed iframe that talks JSON-RPC over `postMessage`. It
needs no model and no server to render, only something willing to answer the
host side of the conversation. So the application half runs on a static site
next to its own source, and the transcript pane doubles as the verification
artifact that Part VI is built on.

## How do I read it?

Parts I to III work bottom up, from the runtime to the primitives. Parts IV and
V work top down, from applications back to the pieces they need. Part VI
defines how every claim here is checked.

You do not have to read it in that order. Arrived with a problem? Appendix A.
Arrived with an application to build? Part V.

One caution before you start. This book is opinionated about a boundary that
the specification deliberately leaves open: which interactions belong to the
model and which belong to the interface. Chapter 3 argues that sorting a
column, opening a menu, and dragging a node should never involve a language
model, and the rest of the book follows from that. If you disagree, the
capability entries are still accurate. The recipes will just look overbuilt.

## What this book gets wrong

Three things, stated here rather than discovered later.

**It runs against one host.** The emulator in this repository implements the
host half of the bridge faithfully, and it was written by the same person who
wrote the applications, which is exactly the condition under which a capability
model looks more general than it is. Chapter 26 lists cross-host conformance
as the layer that is missing, and it is the one that would turn the argument
here into evidence.

**No usability sessions were run.** Every design claim is an argument with
reasoning behind it, and arguments about interfaces are wrong more often than
their authors expect. Where a claim is a preference rather than a finding, the
prose tries to say so.

**It is pinned to a moving specification.** The MCP Apps extension is at
`2026-01-26` with an active draft, and eight of the message names used here
exist only in the draft. Those entries carry a badge. The rest will age at the
speed the extension does, which the build can detect and a reader cannot.

## Conventions

Every code block says where it came from: *extracted* from a file the tests
run, *captured* from a real run, or *illustrative* and executed by nothing.
Capability identifiers are in `code`, and every one of them appears in
Appendix A. Message names are quoted exactly as the specification writes them,
and a build step greps the specification for each one.

British spelling, one space after a full stop, and no em dashes anywhere,
which is a house rule enforced by a linter rather than a claim about style.
