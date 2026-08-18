"""Input streams to the view. Output does not."""
import sys; sys.path.insert(0, "figures-src")
import matplotlib.patches as mp
from _style import ACCENT, DANGER, GOOD, INK, MUTED, bare, caption, diagram

with diagram(figsize=(7.4, 3.2)) as (fig, ax):
    bare(ax, (0, 100), (0, 58))
    ax.text(50, 52, "arguments in, results out", color=INK, fontsize=11,
            ha="center")

    for i in range(4):
        x = 10 + i * 9
        ax.add_patch(mp.FancyBboxPatch((x, 32), 7, 6, boxstyle="round,pad=0.3",
                                       facecolor="#FFFFFF", edgecolor=ACCENT, lw=1.3))
    ax.text(24, 42, "tool-input-partial  x n", color=ACCENT, fontsize=8,
            ha="center", family="monospace")
    ax.add_patch(mp.FancyBboxPatch((46, 32), 12, 6, boxstyle="round,pad=0.3",
                                   facecolor="#FFFFFF", edgecolor=ACCENT, lw=1.8))
    ax.text(52, 42, "tool-input", color=ACCENT, fontsize=8, ha="center",
            family="monospace")
    ax.annotate("", xy=(45, 35), xytext=(38, 35),
                arrowprops=dict(arrowstyle="->", color=ACCENT, lw=1.2))

    ax.add_patch(mp.FancyBboxPatch((78, 32), 14, 6, boxstyle="round,pad=0.3",
                                   facecolor="#FFFFFF", edgecolor=GOOD, lw=1.8))
    ax.text(85, 42, "tool-result", color=GOOD, fontsize=8, ha="center",
            family="monospace")
    ax.annotate("", xy=(77, 35), xytext=(59, 35),
                arrowprops=dict(arrowstyle="->", color=GOOD, lw=1.2))

    for i in range(4):
        x = 62 + i * 4
        ax.add_patch(mp.FancyBboxPatch((x, 16), 3, 5, boxstyle="round,pad=0.2",
                                       facecolor="#FFFFFF", edgecolor=DANGER,
                                       lw=1.0, linestyle=":"))
    ax.text(70, 10, "there is no tool-result-partial", color=DANGER, fontsize=8.5,
            ha="center")

    caption(fig, "The model streams its arguments to you. The server cannot "
                 "stream its results to you.", y=0.02)

fig.savefig(sys.argv[1], bbox_inches="tight", facecolor="white")
