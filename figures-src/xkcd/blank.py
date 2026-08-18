"""Chapter 25: the failure that reports nothing."""
import sys; sys.path.insert(0, "figures-src")
import matplotlib.patches as mp
from _style import ACCENT, DANGER, GOOD, INK, MUTED, bare, caption, sketch

with sketch(figsize=(7.2, 3.4)) as (fig, ax):
    bare(ax, (0, 100), (0, 62))
    ax.add_patch(mp.FancyBboxPatch((8, 12), 40, 36, boxstyle="round,pad=1.0",
                                   facecolor="#FFFFFF", edgecolor=MUTED, lw=1.4))
    ax.text(28, 44, "the host", ha="center", color=MUTED, fontsize=9)
    ax.add_patch(mp.FancyBboxPatch((12, 18), 32, 20, boxstyle="round,pad=0.8",
                                   facecolor="#FAFAFA", edgecolor=DANGER, lw=1.8))
    ax.text(28, 28, "(nothing)", ha="center", va="center", color=DANGER,
            fontsize=11)

    lines = ["one quote is mismatched", "so the script never runs",
             "so ui/initialize never fires", "so the host waits forever",
             "and nothing is logged anywhere"]
    for i, line in enumerate(lines):
        ax.text(56, 42 - i * 7, line, color=INK if i else DANGER, fontsize=9.5)

    caption(fig, "This is why a missing handshake is a hard failure in the "
                 "harness rather than a warning.", y=0.02)

fig.savefig(sys.argv[1], bbox_inches="tight", facecolor="white")
