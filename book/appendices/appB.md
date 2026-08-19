---
title: The Gaps
slug: appendix-b
part: Appendices
number: B
summary: Sixteen capabilities with no standard mechanism, what each one costs, and the shape a proposal would take.
---

Every entry below is a capability that recognisable applications need and that
no message, permission or platform feature currently provides. Ten of them
are Core, which means they are needed at their conformance level.

Several of these entries make a claim about a browser rather than about the
specification, and a claim about a browser deserves a run instead of an
argument. `tools/check_sandbox.mjs` loads a probe document into a real
`sandbox="allow-scripts"` iframe with an opaque origin, and into an
unsandboxed frame beside it running the identical code. The second frame is
the control: without it, a refusal could be an artefact of running headless
and blaming the sandbox would be a guess wearing a result. The section at the
end of this appendix has the recorded output, and it corrected one entry here.

![Sixteen doors that are shut](figures/xkcd-doors.png)

@gaps

## What each one costs, and what would fix it

### `surface.focusHandoff`

Neither party can move focus across the frame boundary. A view cannot return
focus to the composer when a form is finished; a host cannot direct focus into
a view's search field. Voice control and switch access both need it.

*Workaround, and its limit.* Finish interactions with a teardown request so
focus returns by ordinary means, and register a tool that moves focus to a
named element. Recipe 13 builds the second half:

<!-- listing: extracted from `apps/recipes/r13-settings/index.html` -->
```js
    const node = FIELDS.includes(field) ? $(`#${field}`) : null;
    if (!node) {
      return { isError: true, content: [{ type: "text", text:
        `There is no field called "${field}". The form has: ${FIELDS.join(", ")}.` }] };
    }
    node.focus();
```

Read what that does and does not buy. An agent can move focus, and an
assistive technology driving through an agent can move focus. A host still
cannot, and a user working entirely by keyboard is still unserved, because
nothing here is reachable without a turn. It closes the agent-facing half of
the gap and leaves the half that needs a message.

*Shape.* `ui/request-focus` from the view, declinable, and a focus grant
notification in the other direction carrying an optional target.

*Reopens.* Focus theft, which is why the request has to be declinable and
should require a recent user gesture.

### `surface.reveal`

A view scrolled out of the conversation cannot ask to be scrolled back into
it. Anything that happens inside it is invisible until the user looks.

*Workaround.* Design for being unobserved: legible state on return, once the
change has already happened.

*Shape.* `ui/request-reveal`, which the host may honour by scrolling, by
badging, or by ignoring.

*Reopens.* Attention hijacking, mitigated by leaving the host in control of
what "reveal" means.

### `input.shortcut`

A view cannot discover which accelerators the host has taken, and cannot be
told when it has collided. From the user's side an accelerator sometimes works
and sometimes does not.

*Workaround.* Take few, prefer document-scoped conventions, and always show a
visible control.

*Shape.* A reserved-chords list in `hostContext`, or a request to claim one
that returns whether it was granted.

*Reopens.* Nothing much. This is the cheapest of the sixteen.

### `input.dragBoundary`

No message carries a transfer payload. Nothing in the extension describes a
drag starting in one place and ending in another, so anything crossing the
boundary crosses because the browser routed it and not because the protocol
said it could.

*What the probe settled.* Whether HTML5 drag and drop crosses an opaque-origin
frame is a question about the browser, and the answer is that it does.
`tools/check_sandbox.mjs` starts a drag on a `draggable` element inside the
sandboxed frame, `dragstart` fires with `allowed: true`, and Chrome builds a
real transfer payload carrying `text/plain` out of an origin the host cannot
read. A drop carrying that payload then reaches the host's own document, text
intact. An earlier run reported this as inconclusive because it pressed at a
fixed offset inside the frame rather than on the draggable element, missed it,
and read the silence as headless refusing to drag.

Two things qualify the result. Chrome exports the payload, but a headless run
has no drag loop, so the harness dispatches the drop itself with the
intercepted data. The export is observed; the delivery is driven. And the
protocol half of this entry is untouched, which is the half that matters: no
message carries a transfer payload, so a drag that crosses the boundary
crosses because the browser routed it, and a mechanism that works only where
the browser happens to allow it is not one an application can rely on across
hosts.

*Workaround.* Clipboard out, file input or paste in, `resources/read` when the
object lives on the server anyway. Dropping files *into* a view works and
needs no permission; `lab-clipboard`, Recipe 3 and Recipe 6 all accept one.

*Shape.* A serialisable transfer payload carried in a message on drag start
and drop, with the host mediating both ends.

*Reopens.* Exfiltration, since a drag out is data leaving the frame, and the
probe shows that route is open today with nothing mediating it. Needs the same
treatment as `ui/download-file`.

### `clipboard.read`

No permission exists. The extension's set is `camera`, `microphone`,
`geolocation` and `clipboardWrite`, so there is no way for a host to grant a
programmatic read even if it wanted to.

*Workaround, and it works.* Offer a paste target. The user's Cmd+V is the
consent, the browser hands the content to a `paste` handler, and no permission
is involved at any point. The probe pastes into a sandboxed frame with an
opaque origin and the event arrives carrying `text/plain`:

<!-- listing: extracted from `apps/labs/lab-clipboard/index.html` -->
```js
  $("#pastehere").addEventListener("paste", (event) => {
    const data = event.clipboardData;
    if (!data) return;
    const text = data.getData("text/plain");
    const types = [...data.types].join(", ") || "none";
    say(`Paste delivered ${text.length} characters. Types offered: ${types}. `
      + "No permission was requested and none exists.");
  });
```

This is the weakest gap in the appendix and it is listed honestly as weak. A
view cannot read the clipboard on its own initiative; it can receive whatever
the user chooses to paste, which covers most of what applications actually
want. What is lost is reading without a gesture, and reading without a gesture
is the part that should require a permission anyway.

*An earlier version of this entry said the browser refuses reads from an
opaque origin.* The probe does not show that. The programmatic read fails in
the sandboxed frame and fails identically in the unsandboxed control, both
because a headless document is not focused, so this suite has no evidence
about the origin at all. The absence of a permission is the part that is
demonstrated, and it is the part that matters.

*Shape.* A `clipboardRead` permission requiring a user gesture and a
host-mediated grant, probably with visible indication in host chrome.

*Reopens.* Silent reading of whatever the user last copied, which is often a
credential.

### `system.share`

`navigator.share` needs the `web-share` permission policy, which is not in the
extension's set of four. The function exists on `navigator` in a view, which
is worth knowing: a feature-detection check on its presence reports that
sharing is available and then the call is denied.

<!-- listing: extracted from `conformance/sandbox.json` -->
```json
    "shareCall": {
      "verdict": "denied before any surface appeared",
      "ok": false
    },
```

The control frame running the identical code reaches the browser's own share
surface instead, so the denial is the sandbox and the permissions policy and
not the headless environment. Feature-detect by calling and catching, never by
checking that the method exists.

*Workaround.* `ui/open-link` with a canonical URL, or the clipboard.

*Shape.* A fifth permission, or a `ui/share` request taking standard content
types, which would let the host present its own share surface.

*Reopens.* Little; the host would own the surface.

### `system.print`

`window.print` needs `allow-modals`, which the sandbox does not grant. The
failure is the awkward kind: `window.print()` **returns normally and does
nothing**. It does not throw,
there is no rejected promise, and no event says the print did not happen. A
view that calls it and then reports success to the user is reporting a print
that never occurred.

*Workaround.* Generate a document and hand it to `ui/download-file`.

*Shape.* `ui/print` taking an embedded resource.

*Reopens.* Modal blocking of the host's own window, which is why a request is
the right shape.

### `notify.attention`

A backgrounded or collapsed view cannot signal that a person is needed.

*Workaround.* A banner that survives until the user returns, and a context
update so the model can raise it in the next turn.

*Shape.* `ui/request-attention` with a severity and a short label. Host free to
badge, chime, or ignore. Probably the same feature as `surface.reveal`.

*Reopens.* Notification spam from many embedded views, which is exactly why
the host must stay in control.

### `state.save` and `state.restore`

The view's origin is opaque, so storage is unavailable, and the extension has
no state message. The Apps SDK on the other side of this ecosystem has
`setWidgetState`, and the specification lists state persistence as deferred.

*Workaround.* Persist through an app-only server tool. Costs a round trip and
fails entirely at Level 1.

*Shape.* `ui/set-view-state` and a `viewState` field in the initialize result,
scoped to the view identity the host already tracks, with a host-enforced size
limit.

*Reopens.* Storage as a covert channel between views, which a per-view scope
and a size cap address.

### `agent.intent`

A view can send prose, and cannot send a verb and a target. The round trip
through prose is lossy and untestable.

*Workaround.* Register a tool so the agent has a precise entry point in the
other direction, and send structured data alongside the prose.

*Shape.* `ui/intent` with a verb, a target and arguments, delivered as a
structured turn.

*Reopens.* Little; it is strictly more precise than the message it replaces.

### `tool.partialOutput`

Input streams to the view. Output does not. There is no partial tool result.

*Workaround.* Poll an app-only tool, rely on a host that re-sends results, or
paginate.

*Shape.* `ui/notifications/tool-result-partial`, mirroring the input side,
with the same "never rely on it, always get a final one" contract.

*Reopens.* Nothing. This is the most clearly justified of the sixteen and the
asymmetry with input streaming is hard to defend.

### `approval.request`

A view's Approve button is a button in an untrusted iframe. Nothing is
attested, and the host does not know an approval happened.

*Workaround.* Queue at the server, perform through an app-only tool, and show
provenance in the view. A convention, not a guarantee.

*Shape.* `ui/request-approval` answered by the host after the host itself asks
the user, returning something the server can verify.

*Reopens.* Nothing; it closes the phishing case, since the host would render
the consent surface.

### `elicit.request`

Core MCP has elicitation from server to host. There is no view-to-host
equivalent, so a view's mid-operation question carries no more weight than any
other pixels in the frame.

*Workaround.* Ask in the view and accept the weaker guarantee, or send a
message and take a turn.

*Shape.* `ui/elicit` mirroring `elicitation/create`, with the same hard
prohibition on credentials in form mode and the same URL mode for anything
that touches authentication.

*Reopens.* Credential phishing, unless the prohibition is carried over
unchanged.

## What the sandbox actually refuses

Every claim in this appendix about what a browser will not do is recorded
rather than argued. Both frames run the same document; the only difference is
one attribute.

| Experiment | Sandboxed view | Unsandboxed control |
|---|---|---|
| `window.origin` | `"null"` | the server's origin |
| `localStorage.setItem` | `SecurityError` | wrote |
| `sessionStorage.setItem` | `SecurityError` | wrote |
| `indexedDB.open` | `SecurityError` | opened |
| `document.cookie` write | `SecurityError` | wrote |
| `navigator.share()` | `NotAllowedError` | reached the share surface |
| `window.open` | returned `null` | opened |
| `window.print()` | returned, did nothing | returned |
| `paste` event | fired, carried `text/plain` | fired |

Two rows are worth reading twice. `window.print()` and the `paste` event are
the only two where the sandboxed frame behaves like the control, and they are
opposite kinds of surprise: printing looks like it worked and did not, and
pasting looks like it should be blocked and is not.

One experiment produced no usable answer. `navigator.clipboard.readText()`
fails identically in both frames, because a headless document is never
focused, so this suite cannot say whether the sandbox would refuse it. The
entry above says so instead of claiming a result it does not have.

## Reading this appendix as a work list

The sixteen are not equally urgent, and the ordering that matters is by how
many applications they block and how cheap a mechanism would be.

**Cheap and clearly justified.** `tool.partialOutput` and `input.shortcut`.
The first is an asymmetry with the input side that is hard to defend; the
second is a list in `hostContext` and reopens nothing.

**Cheap, with prior art on both sides of this ecosystem.** `state.save` and
`state.restore`. The Apps SDK has `setWidgetState`, the specification lists
state persistence as deferred, and the shape is well understood.

**Needs a design, not just a message.** `approval.request` and
`elicit.request`. Both require the host to render a consent surface the user
trusts, and both have to carry the core specification's prohibition on
collecting credentials into an untrusted frame.

**One feature wearing three hats.** `surface.reveal`, `notify.attention` and
the visibility half of `lifecycle.visibility` are all the same missing signal:
the host knows whether a view is being looked at, and the view does not.

**Genuinely hard.** `input.dragBoundary`, because it moves data across the
boundary in the direction the sandbox exists to prevent, and because both ends
of a drag need mediating.

**Weaker than it looks, and listed anyway.** `clipboard.read`. A paste target
covers the case applications actually have, it needs no permission, and it is
demonstrated in `lab-clipboard`. What remains missing is reading without a
user gesture, which is the part that ought to be hard. An entry that stayed on
the list because nobody re-tested it would be the same failure this book
spends Part VI trying to avoid.

