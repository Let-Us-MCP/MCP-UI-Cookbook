---
title: Capability Index
slug: appendix-a
part: Appendices
number: A
summary: All eighty-five identifiers with level, tag, ground, the specification messages behind them, and how many recipes exercise each.
---

Generated from `capabilities/registry.py` on every build. The ground column is
the one to read first: it says whether a capability is a message, the
platform, your code, or a gap.

## How to read a row

**Ground** is the column to read first. *On the wire* means a message exists
and the entry names it. *Platform* means the browser does it with no host
involvement. *Yours to build* means nobody can do it for you. *Not
standardised* means there is no mechanism at all, and Appendix B carries the
workaround.

**Level** places the capability on the ladder in Chapter 1, and levels are
cumulative. **Tag** says whether it is mandatory at that level. **Messages**
lists the specification names behind it, each of which is checked against the
pinned specification text on every build. **Recipes** counts how many of the
thirteen applications exercise it; a zero is a capability this book describes
and does not demonstrate.

@index

## Coverage by recipe

A mark means the recipe exercises the capability. Rows with no marks are
capabilities this book describes and does not demonstrate; Chapter 27 explains
what to make of them.

@matrix
