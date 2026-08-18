"""Three regions, three owners, one conflict policy each."""
import sys; sys.path.insert(0, "figures-src")
import matplotlib.patches as mp
from _style import ACCENT, DANGER, GOOD, INK, MUTED, WARM, bare, caption, diagram

REGIONS = [
    ("User owned", "internal note", "agent may read,\nnever write", GOOD),
    ("Shared", "the summary", "agent proposes,\nhuman accepts", WARM),
    ("Agent owned", "risk score", "view displays,\nnever edits", ACCENT),
]

with diagram(figsize=(7.4, 3.3)) as (fig, ax):
    bare(ax, (0, 100), (0, 60))
    for i, (title, example, policy, colour) in enumerate(REGIONS):
        x = 5 + i * 31
        ax.add_patch(mp.FancyBboxPatch((x, 16), 28, 30, boxstyle="round,pad=0.6",
                                       facecolor="#FFFFFF", edgecolor=colour, lw=1.8))
        ax.text(x + 14, 40, title, color=colour, fontsize=10.5, ha="center")
        ax.text(x + 14, 33, example, color=INK, fontsize=8.6, ha="center",
                family="monospace")
        ax.text(x + 14, 26, policy, color=MUTED, fontsize=8, ha="center",
                va="center")
    ax.text(50, 9, "keep the middle column as small as you can defend",
            color=WARM, fontsize=8.6, ha="center")

    caption(fig, "Written down before the code, this is a list of decisions "
                 "rather than an argument.", y=0.02)

fig.savefig(sys.argv[1], bbox_inches="tight", facecolor="white")
