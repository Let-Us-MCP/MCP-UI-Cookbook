"""The five failure modes and when each becomes discoverable."""
import sys; sys.path.insert(0, "figures-src")
import matplotlib.patches as mp
from _style import ACCENT, DANGER, GOOD, INK, MUTED, WARM, bare, caption, diagram

MOMENTS = [
    (12, "before render", ["unsupported"], MUTED,
     "the control never exists"),
    (37, "at the attempt", ["denied", "failed"], WARM,
     "say what and what next"),
    (62, "any time", ["cancelled"], ACCENT,
     "state must match reality"),
    (87, "only by deciding", ["timeout"], DANGER,
     "or the spinner runs forever"),
]

with diagram(figsize=(7.6, 3.2)) as (fig, ax):
    bare(ax, (0, 100), (0, 56))
    ax.annotate("", xy=(97, 34), xytext=(3, 34),
                arrowprops=dict(arrowstyle="->", color="#C9CED6", lw=1.6))
    ax.text(3, 38, "initialisation", color=MUTED, fontsize=8, ha="left")
    ax.text(97, 38, "teardown", color=MUTED, fontsize=8, ha="right")

    for x, when, modes, colour, note in MOMENTS:
        ax.plot([x, x], [31, 37], color=colour, lw=2)
        ax.text(x, 27, "\n".join(modes), color=colour, fontsize=10, ha="center",
                va="top")
        ax.text(x, 14, note, color=MUTED, fontsize=7.6, ha="center", va="top")
        ax.text(x, 44, when, color=colour, fontsize=8, ha="center")

    caption(fig, "Handling only the second column and calling it error handling "
                 "is the common case.", y=0.02)

fig.savefig(sys.argv[1], bbox_inches="tight", facecolor="white")
