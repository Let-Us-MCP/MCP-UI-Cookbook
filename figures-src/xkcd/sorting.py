"""Chapter 3: the cost of asking a model to sort a table."""
import sys; sys.path.insert(0, "figures-src")
import matplotlib.patches as mp
from _style import ACCENT, DANGER, GOOD, INK, MUTED, bare, caption, sketch

with sketch(figsize=(7.4, 3.4)) as (fig, ax):
    bare(ax, (0, 100), (0, 60))
    ax.text(50, 54, "the user clicked a column header", ha="center", color=INK,
            fontsize=12)

    ax.add_patch(mp.FancyBboxPatch((5, 30), 38, 16, boxstyle="round,pad=1.0",
                                   facecolor="#FFFFFF", edgecolor=GOOD, lw=1.8))
    ax.text(24, 40, "sort it locally", ha="center", color=GOOD, fontsize=11)
    ax.text(24, 34, "one frame, always the same order", ha="center", color=MUTED,
            fontsize=8.5)

    ax.add_patch(mp.FancyBboxPatch((55, 30), 40, 16, boxstyle="round,pad=1.0",
                                   facecolor="#FFFFFF", edgecolor=DANGER, lw=1.8))
    ax.text(75, 40, "ask the model", ha="center", color=DANGER, fontsize=11)
    ax.text(75, 34, "two seconds, some tokens,\nusually the right column",
            ha="center", va="center", color=MUTED, fontsize=8.5)

    ax.text(24, 20, "no", ha="center", color=GOOD, fontsize=22)
    ax.text(75, 20, "no", ha="center", color=DANGER, fontsize=22)
    ax.text(24, 12, "problem", ha="center", color=GOOD, fontsize=10)
    ax.text(75, 12, "really, no", ha="center", color=DANGER, fontsize=10)

    caption(fig, "Scrolling, sorting, selecting and dragging are not "
                 "conversations.", y=0.02)

fig.savefig(sys.argv[1], bbox_inches="tight", facecolor="white")
