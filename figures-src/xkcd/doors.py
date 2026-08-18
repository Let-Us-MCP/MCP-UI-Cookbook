"""Appendix B: fourteen doors that are shut."""
import json, sys; sys.path.insert(0, "figures-src")
import matplotlib.patches as mp
from pathlib import Path
from _style import ACCENT, DANGER, GOOD, INK, MUTED, bare, caption, sketch

registry = json.loads(Path("capabilities/registry.json").read_text())
gaps = [c["id"] for c in registry["capabilities"] if c["ground"] == "gap"]

with sketch(figsize=(7.6, 3.8)) as (fig, ax):
    bare(ax, (0, 100), (0, 66))
    ax.text(50, 60, f"{len(gaps)} capabilities with no mechanism at all",
            ha="center", color=INK, fontsize=12)

    for i, name in enumerate(gaps):
        col, row = i % 5, i // 5
        x = 5 + col * 19
        y = 34 - row * 15
        ax.add_patch(mp.FancyBboxPatch((x, y), 16, 11, boxstyle="round,pad=0.6",
                                       facecolor="#FFFFFF", edgecolor=DANGER,
                                       lw=1.4))
        ax.plot([x + 13, x + 13], [y + 4, y + 6], color=DANGER, lw=3)
        ax.text(x + 8, y - 2.5, name, ha="center", va="top", color=MUTED,
                fontsize=6.6, family="monospace")

    caption(fig, "Every one was found by a recipe that needed it, and every one "
                 "has a workaround somebody had to write.", y=0.02)

fig.savefig(sys.argv[1], bbox_inches="tight", facecolor="white")
