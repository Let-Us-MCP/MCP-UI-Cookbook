"""The four layers, and the direction each part of the book travels."""
import sys; sys.path.insert(0, "figures-src")
import matplotlib.patches as mp
from _style import ACCENT, GOOD, INK, MUTED, WARM, bare, caption, diagram

LAYERS = [
    ("Atomic capability", "surface.resize, input.selection", ACCENT),
    ("Reusable component", "combobox, editable grid, approval card", GOOD),
    ("Application recipe", "data explorer, spreadsheet, approval centre", WARM),
    ("Capability validation", "transcripts, checklists, coverage matrix", MUTED),
]

with diagram(figsize=(7.4, 3.6)) as (fig, ax):
    bare(ax, (0, 100), (0, 64))
    for i, (name, example, colour) in enumerate(LAYERS):
        y = 48 - i * 12.5
        ax.add_patch(mp.FancyBboxPatch((14, y), 72, 9.4,
                                       boxstyle="round,pad=0.6",
                                       facecolor="#FFFFFF", edgecolor=colour, lw=1.6))
        ax.text(17, y + 6.1, name, color=colour, fontsize=11, va="center")
        ax.text(17, y + 2.6, example, color=MUTED, fontsize=8.5, va="center")
        if i < 3:
            ax.annotate("", xy=(50, y - 0.4), xytext=(50, y - 2.7),
                        arrowprops=dict(arrowstyle="<-", color="#C9CED6", lw=1.4))

    ax.annotate("", xy=(9, 58), xytext=(9, 8),
                arrowprops=dict(arrowstyle="->", color=ACCENT, lw=1.6))
    ax.text(4.5, 33, "Parts I to III\nbuild upward", color=ACCENT, fontsize=8.5,
            rotation=90, ha="center", va="center")
    ax.annotate("", xy=(91, 8), xytext=(91, 58),
                arrowprops=dict(arrowstyle="->", color=WARM, lw=1.6))
    ax.text(96.0, 33, "Parts IV and V\nwork downward", color=WARM, fontsize=8.5,
            rotation=270, ha="center", va="center")

    caption(fig, "Part VI closes the loop: a recipe that cannot be built has "
                 "found a missing primitive.", y=0.04)

fig.savefig(sys.argv[1], bbox_inches="tight", facecolor="white")
