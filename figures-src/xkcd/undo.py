"""Chapter 15 and 20: the agent's changes belong on your undo stack."""
import sys; sys.path.insert(0, "figures-src")
import matplotlib.patches as mp
from _style import ACCENT, DANGER, GOOD, INK, MUTED, WARM, bare, caption, sketch

with sketch(figsize=(7.4, 3.4)) as (fig, ax):
    bare(ax, (0, 100), (0, 60))
    ax.text(50, 54, "one undo stack, two authors", ha="center", color=INK,
            fontsize=12)

    entries = [("you typed a sentence", ACCENT), ("you made it bold", ACCENT),
               ("the agent rewrote the paragraph", WARM),
               ("you fixed the date", ACCENT)]
    for i, (label, colour) in enumerate(entries):
        y = 38 - i * 8
        ax.add_patch(mp.FancyBboxPatch((16, y), 56, 6, boxstyle="round,pad=0.5",
                                       facecolor="#FFFFFF", edgecolor=colour,
                                       lw=1.6))
        ax.text(44, y + 3, label, ha="center", va="center", color=colour,
                fontsize=9)

    ax.annotate("", xy=(76, 41), xytext=(76, 10),
                arrowprops=dict(arrowstyle="->", color=MUTED, lw=1.6))
    ax.text(88, 26, "one Cmd+Z\nper step,\nwhoever\nmade it",
            ha="center", va="center", color=MUTED, fontsize=8.5)

    caption(fig, "An agent whose edits cannot be undone is an agent people "
                 "will not let near a document.", y=0.02)

fig.savefig(sys.argv[1], bbox_inches="tight", facecolor="white")
