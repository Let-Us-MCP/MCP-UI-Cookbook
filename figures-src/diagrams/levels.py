"""Capabilities per conformance level, split by where they come from."""
import json, sys; sys.path.insert(0, "figures-src")
from collections import Counter
from pathlib import Path
from _style import ACCENT, DANGER, GOOD, INK, MUTED, WARM, caption, clean, diagram

registry = json.loads(Path("capabilities/registry.json").read_text())
ORDER = [("wire", "On the wire", ACCENT), ("core", "Core MCP", GOOD),
         ("platform", "Platform", MUTED), ("app", "Yours to build", WARM),
         ("gap", "Not standardised", DANGER)]
LEVELS = ["1 Embedded", "2 Interactive", "3 Native-Like", "4 Agentic"]

table = {key: [0, 0, 0, 0] for key, _, _ in ORDER}
for cap in registry["capabilities"]:
    table[cap["ground"]][cap["level"] - 1] += 1

with diagram(figsize=(7.2, 3.4)) as (fig, ax):
    bottom = [0, 0, 0, 0]
    for key, label, colour in ORDER:
        ax.bar(LEVELS, table[key], bottom=bottom, color=colour, label=label,
               width=0.6)
        bottom = [b + v for b, v in zip(bottom, table[key])]
    for i, total in enumerate(bottom):
        ax.text(i, total + 0.8, str(total), ha="center", color=INK, fontsize=10)
    clean(ax, ylabel="capabilities")
    ax.set_ylim(0, max(bottom) + 6)
    ax.legend(frameon=False, fontsize=8, ncol=5, loc="upper center",
              bbox_to_anchor=(0.5, 1.16))

    caption(fig, "Level 3 is where the standard runs out fastest.", y=0.0)

fig.savefig(sys.argv[1], bbox_inches="tight", facecolor="white")
