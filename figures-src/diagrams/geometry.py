"""Fixed, flexible and unbounded, per axis."""
import sys; sys.path.insert(0, "figures-src")
import matplotlib.patches as mp
from _style import ACCENT, GOOD, INK, MUTED, WARM, bare, caption, diagram

CASES = [
    ("height: 200", "Fixed", "the host controls it;\nfill and scroll inside", WARM),
    ("maxHeight: 420", "Flexible", "you control it,\nup to that limit", ACCENT),
    ("(omitted)", "Unbounded", "you control it,\nno limit", GOOD),
]

with diagram(figsize=(7.6, 3.4)) as (fig, ax):
    bare(ax, (0, 100), (0, 62))
    for i, (field, mode, note, colour) in enumerate(CASES):
        x = 6 + i * 32
        ax.add_patch(mp.FancyBboxPatch((x, 24), 26, 26, boxstyle="round,pad=0.5",
                                       facecolor="#F4F5F7", edgecolor=colour, lw=1.6))
        ax.add_patch(mp.FancyBboxPatch((x + 3, 27), 20, 16 if i == 0 else 20,
                                       boxstyle="round,pad=0.4",
                                       facecolor="#FFFFFF", edgecolor=MUTED, lw=1.0))
        ax.text(x + 13, 53, mode, color=colour, fontsize=11, ha="center")
        ax.text(x + 13, 21, field, color=INK, fontsize=8, ha="center", va="top",
                family="monospace")
        ax.text(x + 13, 15, note, color=MUTED, fontsize=7.6, ha="center", va="top")
        if i == 0:
            ax.text(x + 13, 35, "content\noverflows", color=MUTED, fontsize=7,
                    ha="center", va="center")
        else:
            ax.text(x + 13, 37, "frame follows\nthe content", color=MUTED,
                    fontsize=7, ha="center", va="center")

    caption(fig, "Width and height are decided independently, and a view that "
                 "assumes one mode breaks in the other.", y=0.02)

fig.savefig(sys.argv[1], bbox_inches="tight", facecolor="white")
