#!/usr/bin/env python3
"""The capability registry.

This file is the single source of truth for every capability identifier the
book uses. `make registry` writes `capabilities/registry.json` from it, and
everything downstream (the capability index, the coverage matrix, the
conformance checklists, the gap appendix, the cross-reference checker) reads
the JSON. Nothing about a capability is written twice.

Columns:

  id        Namespaced identifier. Flat names are not used.
  level     Host conformance level 1-4 (cumulative).
  tag       core     mandatory at its level
            extended optional at any level
  ground    Where the behaviour actually comes from. This is the honest part:
            wire      the MCP Apps extension defines a message for it
            core      core MCP defines it
            platform  the browser inside the sandbox provides it, no host
                      round trip
            app       the view implements it and nobody else can
            gap       no standard mechanism exists; the entry carries a
                      workaround and the gap appendix collects them
  wire      Literal strings that MUST appear in the pinned specification
            text. `tools/check_claims.py` greps for every one of them and
            fails the build if a claim has drifted.
  chapter   Slug of the chapter whose entry defines it.
  lab       Slug of the live demo that exercises it, or None.
  summary   The one-line description used in the index.
"""

from __future__ import annotations

import json
from pathlib import Path

APPS = "apps"   # MCP Apps extension, io.modelcontextprotocol/ui
CORE = "core"   # core MCP specification, 2026-07-28

# id, level, tag, ground, wire, chapter, lab, summary
CAPS: list[tuple] = [
    # --- Foundations ------------------------------------------------------
    ("host.capabilities", 1, "core", "wire",
     [("apps", "ui/initialize"), ("apps", "hostCapabilities"),
      ("apps", "appCapabilities"), ("apps", "ui/notifications/initialized")],
     "ch01", "lab-handshake",
     "Enumerate what this host supports before using any of it."),
    ("log.message", 1, "extended", "wire",
     [("apps", "notifications/message"), ("apps", "logging")],
     "ch02", "lab-handshake",
     "Send a log line to the host for debugging and telemetry."),
    ("resource.read", 2, "extended", "wire",
     [("apps", "resources/read"), ("apps", "serverResources")],
     "ch02", "lab-handshake",
     "Read a server resource through the host proxy."),

    # --- Surfaces and geometry -------------------------------------------
    ("surface.resize", 1, "core", "wire",
     [("apps", "ui/notifications/size-changed"), ("apps", "containerDimensions")],
     "ch07", "lab-surface",
     "Report content size so the host can size the frame around it."),
    ("surface.viewport", 1, "core", "wire",
     [("apps", "containerDimensions"), ("apps", "safeAreaInsets"),
      ("apps", "deviceCapabilities")],
     "ch07", "lab-surface",
     "Read the space actually available: fixed, flexible, or unbounded."),
    ("surface.displayMode", 3, "core", "wire",
     [("apps", "ui/request-display-mode"), ("apps", "availableDisplayModes"),
      ("apps", "ui/notifications/host-context-changed")],
     "ch07", "lab-surface",
     "Move between inline, fullscreen, and picture-in-picture."),
    ("surface.compose", 3, "core", "gap", [],
     "ch03", None,
     "Put more than one view on the same surface, arranged."),
    ("surface.viewMessage", 3, "extended", "gap", [],
     "ch03", None,
     "Let two views on one surface exchange anything at all."),
    ("surface.close", 2, "core", "wire",
     [("apps", "ui/notifications/request-teardown"), ("apps", "ui/resource-teardown")],
     "ch07", "lab-surface",
     "Ask the host to dismiss this view."),

    # --- Focus and scroll -------------------------------------------------
    ("surface.focus", 2, "core", "platform", [],
     "ch08", "lab-focus",
     "Move, trap, and restore focus inside the view."),
    ("surface.focusHandoff", 2, "core", "gap", [],
     "ch08", "lab-focus",
     "Hand focus across the host boundary in either direction."),
    ("surface.scroll", 2, "core", "platform", [],
     "ch08", "lab-focus",
     "Scroll to a position or bring an element into view inside the frame."),
    ("surface.reveal", 2, "core", "gap", [],
     "ch08", "lab-focus",
     "Ask the host to scroll the conversation until this view is visible."),

    # --- Dialogs and attention -------------------------------------------
    ("dialog.alert", 2, "core", "app", [],
     "ch09", "lab-dialogs",
     "Block on an acknowledgement the user cannot miss."),
    ("dialog.confirm", 2, "core", "app", [],
     "ch09", "lab-dialogs",
     "Take an explicit binary decision before acting."),
    ("dialog.prompt", 2, "core", "app", [],
     "ch09", "lab-dialogs",
     "Collect one small value without leaving the surface."),
    ("notify.toast", 2, "core", "app", [],
     "ch09", "lab-dialogs",
     "Say saved, copied, failed, and get out of the way."),
    ("notify.banner", 2, "extended", "app", [],
     "ch09", "lab-dialogs",
     "Hold a persistent, non-modal status in view."),
    ("notify.attention", 3, "extended", "gap", [],
     "ch09", "lab-dialogs",
     "Signal from a backgrounded view that a human is needed."),

    # --- Keyboard, pointer, selection ------------------------------------
    ("input.pointer", 1, "core", "platform", [],
     "ch10", "lab-input",
     "Click, hover, drag, and capture across mouse, touch, and pen."),
    ("input.keyboard", 2, "core", "platform", [],
     "ch10", "lab-input",
     "Keys, modifiers, and the platform conventions users already have."),
    ("input.shortcut", 2, "core", "gap", [],
     "ch10", "lab-input",
     "Own an accelerator without fighting the host for it."),
    ("input.longpress", 2, "core", "platform", [],
     "ch10", "lab-input",
     "Touch equivalent of a right click."),
    ("input.contextmenu", 2, "core", "platform", [],
     "ch10", "lab-input",
     "Contextual actions on right click or long press."),
    ("input.selection", 2, "core", "platform", [],
     "ch10", "lab-input",
     "Single, additive, range, and select-all over text and objects."),
    ("input.dragdrop", 2, "core", "platform", [],
     "ch10", "lab-input",
     "Drag and drop inside the view, with structured transfer data."),
    ("input.dragBoundary", 2, "extended", "gap", [],
     "ch10", "lab-input",
     "Drag something out of the view and into the host, or the reverse."),
    ("input.zoompan", 3, "core", "platform", [],
     "ch10", "lab-input",
     "Wheel and pinch zoom, pan, reset, fit to content."),

    # --- Clipboard, files, system ----------------------------------------
    ("clipboard.write", 2, "core", "wire",
     [("apps", "clipboardWrite"), ("apps", "permissions")],
     "ch11", "lab-clipboard",
     "Copy text or structured content, with a fallback when denied."),
    ("clipboard.read", 2, "extended", "gap", [],
     "ch11", "lab-clipboard",
     "Read what the user has on the clipboard."),
    ("file.open", 2, "core", "platform", [],
     "ch11", "lab-clipboard",
     "Open the system file picker and read what comes back."),
    ("file.dropzone", 2, "core", "platform", [],
     "ch11", "lab-clipboard",
     "Accept dropped files with validation, preview, and progress."),
    ("file.export", 2, "core", "wire",
     [("apps", "ui/download-file"), ("apps", "downloadFile")],
     "ch11", "lab-clipboard",
     "Hand a generated artifact to the host to save."),
    ("file.save", 2, "core", "wire",
     [("apps", "ui/download-file"), ("apps", "resource_link")],
     "ch11", "lab-clipboard",
     "Persist app-generated content through the host."),
    ("link.open", 1, "core", "wire",
     [("apps", "ui/open-link"), ("apps", "openLinks")],
     "ch11", "lab-clipboard",
     "Delegate external navigation instead of attempting it."),
    ("system.share", 3, "extended", "gap", [],
     "ch11", None,
     "Invoke the operating system share sheet."),
    ("system.print", 3, "extended", "gap", [],
     "ch11", None,
     "Request host-mediated printing."),

    # --- Pickers ----------------------------------------------------------
    ("picker.date", 2, "extended", "platform", [],
     "ch12", "lab-pickers",
     "Native date selection, localised by the host locale."),
    ("picker.time", 2, "extended", "platform", [],
     "ch12", "lab-pickers",
     "Native time selection in the host timezone."),
    ("picker.color", 2, "extended", "platform", [],
     "ch12", "lab-pickers",
     "Native colour selection."),
    ("picker.resource", 3, "extended", "wire",
     [("apps", "resources/read"), ("apps", "serverResources")],
     "ch12", "lab-pickers",
     "Pick from resources the server exposes, through the host."),

    # --- Environment and theming -----------------------------------------
    ("env.theme", 1, "core", "wire",
     [("apps", "styles"), ("apps", "--color-background-primary"),
      ("apps", "light-dark")],
     "ch13", "lab-theme",
     "Take the host's tokens and follow them when they change."),
    ("env.locale", 1, "core", "wire", [("apps", "locale")],
     "ch13", "lab-theme",
     "Format numbers, dates, and text for the user's region."),
    ("env.timezone", 1, "core", "wire", [("apps", "timeZone")],
     "ch13", "lab-theme",
     "Render instants in the timezone the user is actually in."),
    ("env.platform", 2, "extended", "wire",
     [("apps", "platform"), ("apps", "userAgent")],
     "ch13", "lab-theme",
     "Coarse platform shape, used sparingly."),
    ("env.inputMode", 2, "core", "wire",
     [("apps", "deviceCapabilities"), ("apps", "touch"), ("apps", "hover")],
     "ch13", "lab-theme",
     "Size targets for the modality actually in use."),
    ("env.safeArea", 2, "core", "wire", [("apps", "safeAreaInsets")],
     "ch13", "lab-theme",
     "Keep content out of regions the host has spoken for."),
    ("env.fonts", 2, "extended", "wire",
     [("apps", "fonts"), ("apps", "--font-sans")],
     "ch13", "lab-theme",
     "Load the host's typeface without loading anything else."),

    # --- Accessibility ----------------------------------------------------
    ("env.reducedMotion", 2, "core", "platform", [],
     "ch14", "lab-a11y",
     "Respect a stated preference for less movement."),
    ("env.contrast", 2, "core", "platform", [],
     "ch14", "lab-a11y",
     "Survive forced colours and high contrast."),
    ("env.textScale", 2, "core", "platform", [],
     "ch14", "lab-a11y",
     "Stay usable when text is two sizes larger than you designed for."),
    ("a11y.announce", 2, "core", "app", [],
     "ch14", "lab-a11y",
     "Tell assistive technology that something changed."),

    # --- Lifecycle --------------------------------------------------------
    ("lifecycle.visibility", 3, "core", "platform", [],
     "ch15", "lab-lifecycle",
     "Know when the view is on screen and when it is not."),
    ("lifecycle.suspend", 3, "core", "app", [],
     "ch15", "lab-lifecycle",
     "Stop doing work nobody is looking at."),
    ("lifecycle.connectivity", 3, "core", "platform", [],
     "ch15", "lab-lifecycle",
     "Show online, offline, and reconnecting honestly."),
    ("lifecycle.dirty", 2, "core", "app", [],
     "ch15", "lab-lifecycle",
     "Track uncommitted local state and say so."),
    ("lifecycle.beforeClose", 2, "core", "wire",
     [("apps", "ui/resource-teardown"), ("apps", "reason")],
     "ch15", "lab-lifecycle",
     "Get one chance to finish before the frame goes away."),

    # --- Persistence and history -----------------------------------------
    ("state.save", 3, "core", "gap", [],
     "ch16", "lab-state",
     "Persist view state keyed to the view's identity."),
    ("state.restore", 3, "core", "gap", [],
     "ch16", "lab-state",
     "Come back up where the user left off."),
    ("history.transaction", 3, "core", "app", [],
     "ch16", "lab-state",
     "Group mutations into one undoable unit."),
    ("history.undo", 3, "core", "app", [],
     "ch16", "lab-state",
     "Revert the last transaction, including the agent's."),
    ("history.redo", 3, "core", "app", [],
     "ch16", "lab-state",
     "Reapply what was reverted."),

    # --- Media, progress, errors -----------------------------------------
    ("media.playback", 3, "extended", "platform", [],
     "ch17", "lab-media",
     "Play, pause, seek, rate, volume, captions."),
    ("media.fullscreen", 3, "extended", "wire",
     [("apps", "ui/request-display-mode"), ("apps", "fullscreen")],
     "ch17", "lab-media",
     "Go immersive through the host, not through the Fullscreen API."),
    ("op.progress", 2, "core", "core",
     [("core", "notifications/progress"), ("core", "progressToken")],
     "ch17", "lab-media",
     "Determinate and indeterminate progress with a phase name."),
    ("op.cancel", 2, "core", "core",
     [("core", "notifications/cancelled"), ("core", "requestId")],
     "ch17", "lab-media",
     "Interrupt work that is still running."),
    ("op.pause", 3, "extended", "app", [],
     "ch17", None,
     "Suspend and continue long work."),
    ("op.retry", 2, "core", "app", [],
     "ch17", "lab-media",
     "Retry without making the user rebuild the interaction."),
    ("op.error", 2, "core", "core",
     [("core", "isError"), ("apps", "isError")],
     "ch17", "lab-media",
     "Structured errors: what failed, whether to retry, what to do."),

    # --- UI to agent ------------------------------------------------------
    ("agent.escalate", 4, "core", "wire",
     [("apps", "ui/message"), ("apps", "message")],
     "ch18", "lab-agent",
     "Put the current selection into the conversation as a request."),
    ("agent.contextUpdate", 4, "core", "wire",
     [("apps", "ui/update-model-context"), ("apps", "updateModelContext")],
     "ch18", "lab-agent",
     "Publish the part of view state the model should reason over."),
    ("agent.intent", 4, "core", "gap", [],
     "ch18", "lab-agent",
     "Name a semantic action rather than describing it in prose."),
    ("agent.sampling", 4, "extended", "wire",
     [("apps", "sampling/createMessage"), ("apps", "sampling")],
     "ch18", "lab-agent",
     "Ask the host's model for a completion from inside the view."),

    # --- Agent to UI ------------------------------------------------------
    ("app.tools", 4, "core", "wire",
     [("apps", "appCapabilities"), ("apps", "tools/list"),
      ("apps", "notifications/tools/list_changed")],
     "ch19", "lab-apptools",
     "Expose the view's operations as tools the agent can call."),
    ("ui.highlight", 4, "core", "app", [],
     "ch19", "lab-apptools",
     "Let the agent point at a row, a node, or a hunk."),
    ("ui.navigate", 4, "core", "app", [],
     "ch19", "lab-apptools",
     "Let the agent open the panel it is talking about."),
    ("ui.prefill", 4, "core", "app", [],
     "ch19", "lab-apptools",
     "Let the agent propose values, never submit them."),

    # --- Tools and streaming ---------------------------------------------
    ("tool.invoke", 4, "core", "wire",
     [("apps", "tools/call"), ("apps", "serverTools"), ("apps", "visibility")],
     "ch20", "lab-tools",
     "Call a server tool from a button, through the host."),
    ("tool.cancel", 4, "core", "core",
     [("core", "notifications/cancelled")],
     "ch20", "lab-tools",
     "Cancel a call the user has stopped caring about."),
    ("tool.partialInput", 4, "core", "wire",
     [("apps", "ui/notifications/tool-input-partial"),
      ("apps", "ui/notifications/tool-input")],
     "ch20", "lab-tools",
     "Render something useful while arguments are still streaming."),
    ("tool.result", 4, "core", "wire",
     [("apps", "ui/notifications/tool-result"),
      ("apps", "ui/notifications/tool-cancelled")],
     "ch20", "lab-tools",
     "Take delivery of the result that this view was rendered for."),
    ("tool.partialOutput", 4, "core", "gap", [],
     "ch20", "lab-tools",
     "Update stable elements as results arrive, not after."),

    # --- Ownership, approval, boundary -----------------------------------
    ("state.ownership", 4, "core", "app", [],
     "ch21", "lab-ownership",
     "Declare who owns each region when both parties can write."),
    ("state.conflict", 4, "core", "app", [],
     "ch21", "lab-ownership",
     "Decide what happens when they both do."),
    ("approval.request", 4, "core", "gap", [],
     "ch22", "lab-approval",
     "Require a human signature on a sensitive action."),
    ("elicit.request", 4, "core", "gap", [],
     "ch22", "lab-approval",
     "Ask the user a structured question mid-operation."),
    ("agent.boundary", 4, "core", "app", [],
     "ch22", "lab-approval",
     "Keep hover, scroll, and sort out of the model's context."),
]

RECIPES = [
    ("r01", "Data Explorer", "Explore structured tool output interactively.",
     ["surface.resize", "surface.viewport", "input.selection", "input.keyboard",
      "input.pointer", "clipboard.write", "file.export", "env.theme",
      "env.locale", "agent.escalate", "agent.contextUpdate", "tool.invoke",
      "tool.result", "op.error", "a11y.announce", "host.capabilities"]),
    ("r02", "Dashboard", "At-a-glance monitoring with drill-down.",
     ["surface.compose", "surface.resize", "surface.viewport",
      "surface.displayMode", "env.theme",
      "env.reducedMotion", "tool.invoke", "tool.result", "op.progress",
      "op.retry", "lifecycle.visibility", "agent.contextUpdate", "ui.navigate"]),
    ("r03", "File Explorer", "Hierarchical browse and manage.",
     ["input.contextmenu", "input.dragdrop", "input.longpress", "input.selection",
      "clipboard.write", "dialog.confirm", "file.open", "file.dropzone",
      "surface.focus", "notify.toast", "picker.resource", "resource.read",
      "history.undo", "history.transaction"]),
    ("r04", "Document Editor", "Authoring with agent-assisted rewriting.",
     ["history.transaction", "history.undo", "history.redo", "state.save",
      "state.restore", "lifecycle.dirty", "lifecycle.beforeClose",
      "state.ownership", "state.conflict", "ui.prefill", "ui.highlight",
      "input.shortcut", "agent.sampling", "surface.close"]),
    ("r05", "Spreadsheet", "Editable grid computation.",
     ["input.selection", "input.keyboard", "input.shortcut", "clipboard.write",
      "clipboard.read", "history.transaction", "history.undo", "state.save",
      "a11y.announce", "op.error"]),
    ("r06", "Image Annotator", "Label regions on an image.",
     ["input.zoompan", "input.pointer", "input.dragdrop", "file.dropzone",
      "file.export", "surface.displayMode", "env.contrast", "history.undo",
      "picker.color"]),
    ("r07", "Workflow Builder", "Build and edit a node graph.",
     ["input.zoompan", "input.dragdrop", "input.selection", "input.contextmenu",
      "history.transaction", "history.undo", "ui.highlight", "ui.navigate",
      "app.tools", "agent.intent", "op.error", "state.ownership"]),
    ("r08", "Code and Diff Reviewer", "Review changes with agent context.",
     ["input.selection", "input.keyboard", "clipboard.write", "agent.escalate",
      "agent.contextUpdate", "ui.highlight", "surface.displayMode",
      "surface.scroll", "env.theme", "link.open"]),
    ("r09", "Monitoring Console", "Live operational awareness.",
     ["tool.partialOutput", "tool.result", "lifecycle.connectivity",
      "lifecycle.visibility", "lifecycle.suspend", "notify.attention",
      "notify.banner", "op.retry", "input.selection", "surface.resize"]),
    ("r10", "Approval Center", "Human review of queued sensitive actions.",
     ["approval.request", "dialog.confirm", "agent.contextUpdate",
      "agent.boundary", "op.error", "notify.banner", "a11y.announce",
      "elicit.request", "link.open"]),
    ("r11", "Agent Control Center", "Observe and steer running tasks.",
     ["tool.invoke", "tool.cancel", "tool.partialInput", "tool.partialOutput",
      "op.progress", "op.cancel", "op.retry", "notify.attention", "op.error",
      "app.tools"]),
    ("r12", "Media Viewer", "Inspect and present media.",
     ["media.playback", "media.fullscreen", "surface.displayMode",
      "lifecycle.visibility", "lifecycle.suspend", "system.share",
      "env.reducedMotion", "input.zoompan", "file.export"]),
    ("r13", "Settings and Preferences", "Forms, done properly.",
     ["picker.date", "picker.time", "picker.color", "env.textScale",
      "env.contrast", "env.reducedMotion", "a11y.announce", "surface.focus",
      "lifecycle.dirty", "dialog.confirm", "op.error", "state.save",
      "env.inputMode", "env.fonts"]),
]

GROUNDS = {
    "wire": "The MCP Apps extension defines a message for it.",
    "core": "Core MCP defines it; the view inherits it.",
    "platform": "The browser inside the sandbox provides it. No host round trip.",
    "app": "The view implements it. Nobody else can.",
    "gap": "No standard mechanism exists yet. The entry carries a workaround.",
}

LEVELS = {
    1: ("Embedded", "Render, size, theme, link out, and know what you are "
                    "running inside."),
    2: ("Interactive", "Focus, keyboard, selection, clipboard, files, "
                       "dialogs, and errors that recover."),
    3: ("Native-Like", "Display modes, spatial interaction, lifecycle, "
                       "persistence, history, media."),
    4: ("Agentic", "Tools, streaming, context, approval, and shared "
                   "ownership of state."),
}


def build() -> dict:
    caps = []
    for cid, level, tag, ground, wire, chapter, lab, summary in CAPS:
        caps.append({
            "id": cid,
            "level": level,
            "tag": tag,
            "ground": ground,
            "wire": [{"spec": s, "anchor": a} for s, a in wire],
            "chapter": chapter,
            "lab": lab,
            "summary": summary,
            "recipes": [r for r, _n, _g, ids in RECIPES if cid in ids],
        })
    known = {c["id"] for c in caps}
    for rid, name, goal, ids in RECIPES:
        unknown = [i for i in ids if i not in known]
        if unknown:
            raise SystemExit(f"{rid} references unknown capabilities: {unknown}")
    recipes = []
    seen: set[str] = set()
    for rid, name, goal, ids in RECIPES:
        delta = [i for i in ids if i not in seen]
        seen.update(ids)
        recipes.append({"id": rid, "name": name, "goal": goal,
                        "capabilities": ids, "delta": delta})
    return {
        "protocol": {"core": "2026-07-28", "apps": "io.modelcontextprotocol/ui",
                     "appsVersion": "2026-01-26", "sdk": "1.7.5"},
        "grounds": GROUNDS,
        "levels": {str(k): {"name": v[0], "summary": v[1]}
                   for k, v in LEVELS.items()},
        "capabilities": caps,
        "recipes": recipes,
    }


if __name__ == "__main__":
    out = Path(__file__).resolve().parent / "registry.json"
    data = build()
    out.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    caps = data["capabilities"]
    by_ground: dict[str, int] = {}
    for c in caps:
        by_ground[c["ground"]] = by_ground.get(c["ground"], 0) + 1
    print(f"{len(caps)} capabilities, {len(data['recipes'])} recipes")
    print("  " + ", ".join(f"{k}: {v}" for k, v in sorted(by_ground.items())))
