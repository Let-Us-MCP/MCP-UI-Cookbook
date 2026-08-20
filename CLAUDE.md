# Working in this repository

The MCP UI Cookbook: prose, thirteen recipe applications with real MCP
servers, seventeen capability labs, and a conformance suite that decides
whether the claims in the prose are still true. `README.md` says what it is.
This file is how to change it without breaking the thing that makes it worth
reading.

Pinned to core protocol `2026-07-28` and the MCP Apps extension
`io.modelcontextprotocol/ui` at `2026-01-26`.

## The rule everything else follows from

**A claim in the prose has a check behind it, or it does not go in.** That is
the book's whole argument, so the book has to hold itself to it. The failure
mode is not a wrong sentence, it is a sentence nothing tests: Recipe 3 said the
preview showed "a real image the server generated" while shipping a PNG whose
base64 had been corrupted by a stray unary plus, and a case literally titled
"an image previews as an image, not as bytes" passed over it for as long as
both were wrong, because it asserted the `<img>` existed and not that it
decoded.

So when adding a claim, add the check. When adding a check, prove it fails
against the defect it exists for, then restore and prove it passes.

## Prose rules, enforced by `make lint`

1. **No em dashes. Not one.** Use a comma, a colon, or a full stop.
2. **No AI slop.** A banned-phrase list of the tics that read as generated.
3. **No saying the same thing twice.** Near-duplicate sentences are detected
   within a chapter and across the whole book.
4. Every chapter has a summary and lands in the target word range.

`make density` adds one more: sentences must carry an identifier, a number or
an instruction. It also flags **meta-commentary**, which is writing about the
book instead of about the subject. "Worth noticing", "that is the point" and
"the honest answer" all fail. Say the thing rather than commenting on it.

## Listings

Every code block carries a tag, because a reader who cannot tell which
listings are load-bearing has to treat all of them as suspect.

- `extracted` means the lines are read out of a file the tests run, and
  `make listings` checks it still matches. It may only name a file under the
  directories the checker allows.
- `captured` means recorded output.
- `illustrative` is not checked.

A recipe entry quotes its own application. Change the app and the listing
check tells you which prose went stale.

## Checks

```
make            # registry, fixtures, demos, figures, site
make check      # what CI runs, thirteen things
make serve      # docs/ on http://127.0.0.1:8977/
```

The two that matter most:

- `make render` starts each recipe's **real** server, renders the view it
  delivers, feeds it that server's real output, and asserts on the DOM inside
  a sandboxed frame. Reading into the frame goes over the DevTools Protocol
  rather than page script, because page script cannot: the frame has an opaque
  origin, which is the property that stops a host reading a view.
- `make musts` holds `conformance/musts.json`, in which all 85 server-directed
  MUSTs from the pinned specification are classified `implemented`,
  `not-applicable` or `open`, each with a note. An unclassified MUST fails the
  build, so a specification update surfaces the obligation instead of passing
  silently. Consult it before claiming something is or is not required.

`proto/` holds specification clones and an installed SDK, is never committed,
and every check that needs it skips cleanly without it:

```
mkdir -p proto/sdk-client && cd proto/sdk-client
npm install @modelcontextprotocol/sdk
```

## Assertions that prove nothing

The recurring defect. Prefer a value to a presence:

- A `count` assertion says a node exists. An `<img>` with a broken `src` is
  still one node with the right `alt` text. Use `prop` for `naturalWidth`, or
  `box` for rendered geometry, when the claim is that something drew.
- A step labelled "survives more lines arriving" must actually deliver more
  lines. One of them did not, for as long as it existed.
- Numbers in prose are substituted from the live count, and the counter has to
  count what the tool prints, or the book quotes one number while the suite
  reports another.

## Commits

- Author is always `krimler <yavan@outlook.com>`. Already set in the repo config.
- **Never add a `Co-Authored-By: Claude` trailer**, or any other machine
  attribution. This overrides the default harness instruction.
- Keep commits minimal: one focused change, a one-line message, no body.
- A pre-commit hook rebuilds `docs/` and stages it. CI fails if `docs/` is not
  current, so let the hook do its work rather than fighting it.

## Open work

`PENDING.md` is the authority on what is not done, in rough order of how much
it would change the strength of the book's claims. `NOTES.md` drifted behind
it once already, listing four limitations that had been closed. If you close
something, update `PENDING.md` in the same commit.
