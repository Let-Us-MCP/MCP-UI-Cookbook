"""Where eighty-five capabilities actually come from."""
import json, sys; sys.path.insert(0, "figures-src")
from collections import Counter
from pathlib import Path
from _style import ACCENT, DANGER, GOOD, INK, MUTED, WARM, caption, clean, diagram

registry = json.loads(Path("capabilities/registry.json").read_text())
counts = Counter(c["ground"] for c in registry["capabilities"])

ORDER = [("wire", "On the wire", ACCENT), ("core", "Core MCP", GOOD),
         ("platform", "Platform", MUTED), ("app", "Yours to build", WARM),
         ("gap", "Not standardised", DANGER)]

with diagram(figsize=(7.2, 3.0)) as (fig, ax):
    labels = [label for key, label, _ in ORDER]
    values = [counts[key] for key, _, _ in ORDER]
    colours = [colour for _, _, colour in ORDER]
    bars = ax.barh(labels[::-1], values[::-1], color=colours[::-1], height=0.62)
    for bar, value in zip(bars, values[::-1]):
        ax.text(value + 0.7, bar.get_y() + bar.get_height() / 2, str(value),
                va="center", color=INK, fontsize=10)
    ax.set_xlim(0, max(values) + 5)
    clean(ax, xlabel="capabilities")
    ax.set_xticks([])
    ax.spines["bottom"].set_visible(False)

    caption(fig, "Only a third of what an application needs is a message. "
                 "Fourteen are nothing at all.", y=0.0)

fig.savefig(sys.argv[1], bbox_inches="tight", facecolor="white")
