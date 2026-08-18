"""Anatomy of a capability entry."""
import sys; sys.path.insert(0, "figures-src")
import matplotlib.patches as mp
from _style import ACCENT, DANGER, GOOD, INK, MUTED, WARM, bare, caption, diagram

BADGES = [
    ("Core", GOOD, "mandatory at its level"),
    ("Level 2", MUTED, "which rung of the ladder"),
    ("On the wire", ACCENT, "where the behaviour comes from"),
]

with diagram(figsize=(7.4, 3.3)) as (fig, ax):
    bare(ax, (0, 100), (0, 58))
    ax.add_patch(mp.FancyBboxPatch((6, 20), 88, 30, boxstyle="round,pad=0.8",
                                   facecolor="#F4F5F7", edgecolor=ACCENT, lw=1.8))
    ax.plot([6.4, 6.4], [20, 50], color=ACCENT, lw=5, solid_capstyle="butt")
    ax.text(11, 44.5, "clipboard.write", color=INK, fontsize=13,
            family="monospace", va="center")

    x = 11
    for label, colour, _ in BADGES:
        w = 3.0 + len(label) * 1.55
        ax.add_patch(mp.FancyBboxPatch((x, 35.5), w, 5, boxstyle="round,pad=0.5",
                                       facecolor="#FFFFFF", edgecolor=colour, lw=1.2))
        ax.text(x + w / 2, 38, label, color=colour, fontsize=8.5, ha="center",
                va="center")
        x += w + 2.4
    ax.text(11, 29.5, "Copy text or structured content, with a fallback when denied.",
            color=INK, fontsize=9.5, va="center")
    ax.text(11, 25, "clipboardWrite     permissions", color=ACCENT, fontsize=8.5,
            family="monospace", va="center")

    for i, (label, colour, meaning) in enumerate(BADGES):
        ax.annotate("", xy=(20 + i * 24, 34.5), xytext=(20 + i * 24, 13),
                    arrowprops=dict(arrowstyle="<-", color=colour, lw=1.1))
        ax.text(20 + i * 24, 10.5, meaning, color=colour, fontsize=8,
                ha="center", va="top", wrap=True)

    caption(fig, "Every badge is generated from the registry, so the prose "
                 "cannot contradict it.", y=0.02)

fig.savefig(sys.argv[1], bbox_inches="tight", facecolor="white")
