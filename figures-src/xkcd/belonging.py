"""Chapter 12: a view that ignores the theme."""
import sys; sys.path.insert(0, "figures-src")
import matplotlib.patches as mp
from _style import ACCENT, DANGER, GOOD, INK, MUTED, bare, caption, sketch

with sketch(figsize=(7.2, 3.4)) as (fig, ax):
    bare(ax, (0, 100), (0, 62))

    for i, (title, edge, fill, note, colour) in enumerate([
        ("uses the host's tokens", GOOD, "#FFFFFF", "part of the room", GOOD),
        ("brings its own palette", DANGER, "#FFF6DA", "an advertisement", DANGER),
    ]):
        x = 6 + i * 48
        ax.add_patch(mp.FancyBboxPatch((x, 14), 40, 34, boxstyle="round,pad=1.0",
                                       facecolor="#FFFFFF", edgecolor=MUTED, lw=1.4))
        ax.text(x + 20, 44, "conversation", ha="center", color=MUTED, fontsize=8)
        ax.add_patch(mp.FancyBboxPatch((x + 5, 20), 30, 16, boxstyle="round,pad=0.8",
                                       facecolor=fill, edgecolor=edge, lw=2.0))
        ax.text(x + 20, 28, title, ha="center", color=colour, fontsize=9)
        ax.text(x + 20, 9, note, ha="center", color=colour, fontsize=10)

    caption(fig, "Belonging is the job. Define a fallback for every variable "
                 "and follow the host when it changes its mind.", y=0.02)

fig.savefig(sys.argv[1], bbox_inches="tight", facecolor="white")
