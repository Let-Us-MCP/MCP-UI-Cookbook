"""What crosses the context boundary, and what does not."""
import sys; sys.path.insert(0, "figures-src")
import matplotlib.patches as mp
from _style import ACCENT, DANGER, GOOD, INK, MUTED, bare, caption, diagram

STAYS = ["hover", "scroll position", "open menus", "focus", "sort order",
         "which tab is active", "how long they took"]
CROSSES = ["the selection", "the decision made", "the panel being read",
           "an alert that fired"]

with diagram(figsize=(7.4, 3.6)) as (fig, ax):
    bare(ax, (0, 100), (0, 66))
    ax.add_patch(mp.FancyBboxPatch((3, 8), 44, 48, boxstyle="round,pad=0.8",
                                   facecolor="#F4F5F7", edgecolor=MUTED, lw=1.4))
    ax.text(25, 50, "stays in the view", color=MUTED, fontsize=10.5, ha="center")
    for i, item in enumerate(STAYS):
        ax.text(25, 43 - i * 5.2, item, color=INK, fontsize=8.4, ha="center")

    ax.add_patch(mp.FancyBboxPatch((59, 8), 38, 48, boxstyle="round,pad=0.8",
                                   facecolor="#FFFFFF", edgecolor=ACCENT, lw=1.8))
    ax.text(78, 50, "worth crossing", color=ACCENT, fontsize=10.5, ha="center")
    for i, item in enumerate(CROSSES):
        ax.text(78, 42 - i * 6, item, color=INK, fontsize=8.6, ha="center")
    ax.text(78, 14, "ui/update-model-context", color=ACCENT, fontsize=7.6,
            ha="center", family="monospace")

    ax.annotate("", xy=(58, 32), xytext=(48, 32),
                arrowprops=dict(arrowstyle="->", color=ACCENT, lw=1.6))
    ax.text(53, 35, "explicitly", color=ACCENT, fontsize=7.4, ha="center")

    caption(fig, "The test: would this change a reasonable answer to the next "
                 "question?", y=0.02)

fig.savefig(sys.argv[1], bbox_inches="tight", facecolor="white")
