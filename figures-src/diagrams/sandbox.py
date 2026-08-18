"""What the sandbox takes away, and the two doors it leaves open."""
import sys; sys.path.insert(0, "figures-src")
import matplotlib.patches as mp
from _style import ACCENT, DANGER, GOOD, INK, MUTED, bare, caption, diagram

GONE = ["localStorage", "cookies", "window.alert", "window.print",
        "download attribute", "top-level navigation", "navigator.share",
        "clipboard read", "requestFullscreen"]
OPEN = ["ui/open-link", "ui/download-file"]

with diagram(figsize=(7.6, 3.6)) as (fig, ax):
    bare(ax, (0, 100), (0, 66))
    ax.add_patch(mp.FancyBboxPatch((4, 8), 54, 48, boxstyle="round,pad=0.8",
                                   facecolor="#FFFFFF", edgecolor=DANGER, lw=1.6))
    ax.text(31, 50, "gone, because the origin is opaque", color=DANGER,
            fontsize=10, ha="center")
    for i, item in enumerate(GONE):
        col, row = i % 2, i // 2
        ax.text(9 + col * 26, 42 - row * 6.4, item, color=INK, fontsize=8,
                family="monospace", va="center")

    ax.add_patch(mp.FancyBboxPatch((66, 20), 30, 24, boxstyle="round,pad=0.8",
                                   facecolor="#FFFFFF", edgecolor=GOOD, lw=1.8))
    ax.text(81, 39, "the two doors", color=GOOD, fontsize=10, ha="center")
    for i, item in enumerate(OPEN):
        ax.text(81, 32 - i * 6, item, color=ACCENT, fontsize=9, ha="center",
                family="monospace")
    ax.text(81, 15, "both go through the host,\nwhere a human can see them",
            color=MUTED, fontsize=7.6, ha="center", va="top")

    ax.annotate("", xy=(65, 32), xytext=(59, 32),
                arrowprops=dict(arrowstyle="->", color=GOOD, lw=1.6))

    caption(fig, "Every restriction maps to one of the five attacks in the "
                 "threat model.", y=0.02)

fig.savefig(sys.argv[1], bbox_inches="tight", facecolor="white")
