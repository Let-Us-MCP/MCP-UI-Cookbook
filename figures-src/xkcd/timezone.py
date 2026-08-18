"""Chapter 12: whose clock is it."""
import sys; sys.path.insert(0, "figures-src")
import matplotlib.patches as mp
from _style import ACCENT, DANGER, GOOD, INK, MUTED, bare, caption, sketch

with sketch(figsize=(7.2, 3.2)) as (fig, ax):
    bare(ax, (0, 100), (0, 56))
    rows = [
        ("the deploy happened at", "12:21 Tokyo", GOOD),
        ("the server recorded", "03:21 UTC", MUTED),
        ("the browser rendered", "04:21, machine offset", DANGER),
        ("the user reads", "\"nobody deploys at four in the morning\"", DANGER),
    ]
    for i, (label, value, colour) in enumerate(rows):
        y = 44 - i * 10
        ax.text(6, y, label, color=MUTED, fontsize=9.5, va="center")
        ax.text(46, y, value, color=colour, fontsize=10, va="center")

    caption(fig, "hostContext.locale and hostContext.timeZone are the only "
                 "correct sources. Not the machine's.", y=0.02)

fig.savefig(sys.argv[1], bbox_inches="tight", facecolor="white")
