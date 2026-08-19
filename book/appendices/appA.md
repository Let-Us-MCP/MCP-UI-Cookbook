---
title: Capability Index
slug: appendix-a
part: Appendices
number: A
summary: All eighty-seven identifiers with level, tag, ground, the specification messages behind them, and how many recipes exercise each.
---

Generated from `capabilities/registry.py` on every build. 85 rows: 9 at level
1, 41 at level 2, 19 at level 3, 18 at level 4.

Read the ground column first. 28 are messages the extension defines, 4 come
from core MCP, 20 are the browser, 19 are yours to write, and 14 have no
mechanism at all.

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

A mark means the recipe exercises the capability. `make render` asserts 88
facts about what these 13 applications put on screen.

A row with no marks is a capability this book describes and never demonstrates.
Chapter 28 says what to make of those.

@matrix
