---
title: What This Book Is
slug: preface
part: Front matter
summary: Two audiences, one artifact, and a promise that everything here runs.
---

There are two ways to write about a protocol. You can explain the messages,
which produces a document that is correct and that nobody can build from. Or
you can show a working application, which produces a tutorial that is useful
once and then goes out of date. This book tries a third thing. It takes the
surface an MCP application actually has, cuts it into the smallest pieces that
are independently useful, gives each piece a name, and then builds thirteen
recognisable applications out of nothing but those pieces. If the pieces are
sufficient, the applications work. If a piece is missing, an application fails
in a specific place, and that failure is worth more than another paragraph of
prose.

The pieces are called atomic capabilities and they are the unit of this book.
`surface.resize` is one. So is `clipboard.write`, and `tool.invoke`, and
`history.undo`. Each gets an entry that says what the user sees, what the
application does, what the host is responsible for, what happens when the
capability is absent or denied, and how you would test that any of it is true.
Above them sit components, which are capabilities composed into things with
names people already know: a combobox, a modal, an editable grid. Above those
sit recipes, which are whole applications. And underneath all of it sits a
conformance suite, because a book about what hosts should support is worth
very little without a way to find out what they do support.

## Who this is for

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

## What is actually normative

The normative foundation is the Model Context Protocol specification and the
MCP Apps extension, `io.modelcontextprotocol/ui`, which standardises UI
resources under the `ui://` scheme, links tools to them through
`_meta.ui.resourceUri`, mandates sandboxed iframe rendering, and defines a
bidirectional JSON-RPC channel over `postMessage`. That extension consolidates
patterns worked out first by MCP-UI and by OpenAI's Apps SDK. This book does
not restate those documents and does not compete with them.

What it adds is organisation and honesty about coverage. Every capability
entry in Parts II and III carries a label saying where its behaviour comes
from. Some are messages the extension defines, and the entry cites them by
name. Some come from core MCP. A large number are simply the browser doing its
job inside the sandbox, with no host involvement at all, and saying so plainly
saves you from looking for a protocol feature that does not need to exist. Some
you write yourself. And some have no mechanism anywhere, which is the label
that matters most: an application that needs one of those is an application
that is about to invent a private convention with one host.

The labels are not editorial judgement. They are generated from a machine
readable registry, and a build step greps the specification text for every
message name the registry claims exists. If the extension renames something,
the build fails before the sentence describing it can go stale.

## What runs

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

## How to read it

Parts I through III work bottom up, from the runtime to the primitives. Parts
IV and V work top down, from applications back to the pieces they need. Part
VI closes the loop by defining how every claim here is checked. You do not
have to read it in that order. The capability index in Appendix A is the
fastest way in if you arrived with a specific problem, and the recipes in Part
V are the fastest way in if you arrived with an application to build.

One caution before you start. This book is opinionated about a boundary that
the specification deliberately leaves open: which interactions belong to the
model and which belong to the interface. Chapter 3 argues that sorting a
column, opening a menu, and dragging a node should never involve a language
model, and the rest of the book follows from that. If you disagree, the
capability entries are still accurate. The recipes will just look overbuilt.
