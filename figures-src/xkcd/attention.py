"""Chapter 8: how loudly to interrupt somebody."""
import sys; sys.path.insert(0, "figures-src")
import matplotlib.patches as mp
from _style import ACCENT, DANGER, GOOD, INK, MUTED, WARM, bare, caption, sketch

RUNGS = [
    ("banner", "true until it isn't", GOOD, 14),
    ("toast", "it happened", ACCENT, 26),
    ("prompt", "one small value", WARM, 38),
    ("confirm", "decide before we go on", WARM, 50),
    ("alert", "you cannot miss this", DANGER, 62),
]

with sketch(figsize=(7.0, 3.8)) as (fig, ax):
    bare(ax, (0, 100), (0, 78))
    ax.annotate("", xy=(10, 72), xytext=(10, 8),
                arrowprops=dict(arrowstyle="->", color=MUTED, lw=1.6))
    ax.text(6.5, 40, "how much of their\nattention you took",
            rotation=90, ha="center", va="center", color=MUTED, fontsize=8.5)

    for label, note, colour, y in RUNGS:
        ax.plot([16, 22], [y, y], color=colour, lw=2.2)
        ax.text(25, y, label, color=colour, fontsize=11, va="center")
        ax.text(52, y, note, color=MUTED, fontsize=9, va="center")

    caption(fig, "Most attention bugs are one rung too high. "
                 "\"Export finished. OK.\" is the classic.", y=0.02)

fig.savefig(sys.argv[1], bbox_inches="tight", facecolor="white")
