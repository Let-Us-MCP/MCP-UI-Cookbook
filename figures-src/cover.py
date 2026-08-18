"""The cover. Generated, so its provenance is unambiguous and no third-party
artwork is involved.

The image is the book's argument drawn once: a grid of small primitives at the
bottom, composing upward into fewer, larger things, with the gaps left visibly
empty. Nothing here is a photograph, a stock image, or anyone else's drawing.
"""
import sys
sys.path.insert(0, "figures-src")

import matplotlib
matplotlib.use("Agg")
import matplotlib.patches as mp
import matplotlib.pyplot as plt
import numpy as np

INK = "#0F1216"
PAPER = "#F7F5F0"
ACCENT = "#0F5C8C"
WARM = "#B4531A"
GOOD = "#2C6E49"
DANGER = "#9B2226"
MUTED = "#8A93A0"

rng = np.random.default_rng(20260126)

W, H = 1200, 1800
fig = plt.figure(figsize=(W / 200, H / 200), dpi=200)
ax = fig.add_axes([0, 0, 1, 1])
ax.set_xlim(0, 100)
ax.set_ylim(0, 150)
ax.axis("off")
fig.patch.set_facecolor(PAPER)

# Layer 1: the primitives. A dense band of small cells, a few of them hollow,
# because fourteen of the eighty-five have nothing behind them.
COLS, ROWS = 13, 5
cell, gap = 5.4, 1.5
x0 = (100 - (COLS * cell + (COLS - 1) * gap)) / 2
for r in range(ROWS):
    for c in range(COLS):
        x = x0 + c * (cell + gap)
        y = 22 + r * (cell + gap)
        missing = rng.random() < 0.16
        colour = [ACCENT, ACCENT, GOOD, MUTED, WARM][rng.integers(0, 5)]
        ax.add_patch(mp.FancyBboxPatch(
            (x, y), cell, cell, boxstyle="round,pad=0.25,rounding_size=0.8",
            facecolor="none" if missing else colour,
            edgecolor=DANGER if missing else "none",
            linewidth=1.1 if missing else 0,
            linestyle=(0, (2, 2)) if missing else "solid",
            alpha=1.0 if missing else 0.16 + 0.14 * r))

# Layer 2: components. Wider bars, fewer of them.
for i, (x, w) in enumerate([(12, 24), (39, 22), (64, 24)]):
    ax.add_patch(mp.FancyBboxPatch(
        (x, 60), w, 7.2, boxstyle="round,pad=0.5,rounding_size=1.4",
        facecolor="#FFFFFF", edgecolor=ACCENT, linewidth=1.6, alpha=0.95))
    for k in range(3):
        ax.add_patch(mp.FancyBboxPatch(
            (x + 2.5 + k * (w - 5) / 3, 62.4), (w - 7) / 3, 2.4,
            boxstyle="round,pad=0.3,rounding_size=0.7",
            facecolor=ACCENT, edgecolor="none", alpha=0.35 + k * 0.2))

# Layer 3: the application. One surface, with a border, because it should be
# visibly separate from the host.
ax.add_patch(mp.FancyBboxPatch(
    (12, 78), 76, 30, boxstyle="round,pad=1.2,rounding_size=2.6",
    facecolor="#FFFFFF", edgecolor=INK, linewidth=2.4))
ax.add_patch(mp.FancyBboxPatch(
    (17, 99), 30, 4.6, boxstyle="round,pad=0.5,rounding_size=1.1",
    facecolor=ACCENT, edgecolor="none"))
for k, wbar in enumerate([54, 40, 47]):
    ax.add_patch(mp.FancyBboxPatch(
        (17, 92 - k * 5.6), wbar, 2.6,
        boxstyle="round,pad=0.45,rounding_size=0.9",
        facecolor="#DDE4EB", edgecolor="none"))
ax.add_patch(mp.FancyBboxPatch(
    (66, 81.5), 17, 5.4, boxstyle="round,pad=0.5,rounding_size=1.2",
    facecolor=WARM, edgecolor="none", alpha=0.85))

# The arrows that make it a composition rather than a stack.
for y0, y1 in [(53.5, 58.5), (69.5, 76.5)]:
    ax.annotate("", xy=(50, y1), xytext=(50, y0),
                arrowprops=dict(arrowstyle="-|>", color=MUTED, lw=1.6,
                                shrinkA=0, shrinkB=0))

# Type.
ax.text(50, 130, "The MCP UI", ha="center", va="center", color=INK,
        fontsize=34, fontweight="bold",
        family=["Helvetica Neue", "Helvetica", "Arial", "DejaVu Sans"])
ax.text(50, 121.5, "Cookbook", ha="center", va="center", color=INK,
        fontsize=34, fontweight="bold",
        family=["Helvetica Neue", "Helvetica", "Arial", "DejaVu Sans"])
ax.plot([36, 64], [116, 116], color=ACCENT, lw=2.2)
ax.text(50, 114.5, "From atomic UI capabilities to native-like applications",
        ha="center", va="top", color=MUTED, fontsize=10.2,
        family=["Helvetica Neue", "Helvetica", "Arial", "DejaVu Sans"])

ax.text(50, 14, "85 capabilities   ·   13 recipes   ·   14 gaps",
        ha="center", va="center", color=MUTED, fontsize=10,
        family=["Helvetica Neue", "Helvetica", "Arial", "DejaVu Sans"])
ax.text(50, 8, "Krimler", ha="center", va="center", color=INK, fontsize=12,
        family=["Helvetica Neue", "Helvetica", "Arial", "DejaVu Sans"])

fig.savefig(sys.argv[1], facecolor=PAPER)
