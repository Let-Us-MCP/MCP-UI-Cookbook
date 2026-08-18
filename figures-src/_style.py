"""Shared setup for the drawn figures.

Two families live here. The xkcd ones make an argument you can take in at a
glance and remember at the pub. The diagram ones show mechanism. Both are
generated, both regenerate, and neither is a screenshot of anything.

matplotlib's xkcd mode wants Humor Sans, which is almost never installed. We
pick whatever handwriting face the machine actually has and keep the wobble
either way, because the wobble is most of the effect.
"""

from __future__ import annotations

import contextlib

import matplotlib
matplotlib.use("Agg")
import matplotlib.font_manager as fm
import matplotlib.pyplot as plt

# Same palette as the website and the apps, so the book looks like one thing.
INK = "#15181D"
MUTED = "#5B6472"
RULE = "#C9CED6"
WASH = "#F4F5F7"
PAPER = "#FFFFFF"
ACCENT = "#0F5C8C"
WARM = "#B4531A"
GOOD = "#2C6E49"
DANGER = "#9B2226"

PALETTE = [ACCENT, WARM, GOOD, DANGER, MUTED]

_HANDWRITING = [
    "xkcd Script", "Humor Sans", "Comic Neue", "Comic Sans MS",
    "Chalkboard SE", "Chalkboard", "Bradley Hand", "Marker Felt",
]


def _hand_family() -> list[str]:
    have = {f.name for f in fm.fontManager.ttflist}
    return [n for n in _HANDWRITING if n in have] + ["DejaVu Sans"]


@contextlib.contextmanager
def sketch(figsize=(7.2, 3.4), dpi=200):
    """Hand-drawn mode. Yields (fig, ax)."""
    with plt.xkcd(scale=1.0, length=100, randomness=2):
        matplotlib.rcParams["font.family"] = _hand_family()
        matplotlib.rcParams["font.size"] = 11
        matplotlib.rcParams["path.effects"] = []
        fig, ax = plt.subplots(figsize=figsize, dpi=dpi)
        fig.patch.set_facecolor(PAPER)
        ax.set_facecolor(PAPER)
        yield fig, ax


@contextlib.contextmanager
def diagram(figsize=(7.2, 3.4), dpi=200):
    """Straight lines, for the figures that are explaining a mechanism."""
    matplotlib.rcParams.update(matplotlib.rcParamsDefault)
    matplotlib.rcParams["font.family"] = [
        "Helvetica Neue", "Helvetica", "Arial", "DejaVu Sans"
    ]
    matplotlib.rcParams["font.size"] = 10
    fig, ax = plt.subplots(figsize=figsize, dpi=dpi)
    fig.patch.set_facecolor(PAPER)
    ax.set_facecolor(PAPER)
    yield fig, ax


def bare(ax, xlim=(0, 100), ylim=(0, 100)):
    ax.set_xlim(*xlim)
    ax.set_ylim(*ylim)
    ax.set_xticks([])
    ax.set_yticks([])
    for s in ax.spines.values():
        s.set_visible(False)
    return ax


def clean(ax, xlabel=None, ylabel=None, title=None):
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["left"].set_color(INK)
    ax.spines["bottom"].set_color(INK)
    ax.tick_params(colors=INK, labelsize=10)
    if xlabel:
        ax.set_xlabel(xlabel, color=INK)
    if ylabel:
        ax.set_ylabel(ylabel, color=INK)
    if title:
        ax.set_title(title, color=INK, fontsize=12, pad=14)
    return ax


def caption(fig, text, y=-0.02):
    """The dry line underneath, which is where the joke usually lives."""
    fig.text(0.5, y, text, ha="center", va="top", color=MUTED, fontsize=10.5)


def box(ax, x, y, w, h, label, color=INK, fill=PAPER, fontsize=10, lw=1.6, sub=None):
    ax.add_patch(plt.Rectangle((x, y), w, h, facecolor=fill, edgecolor=color,
                               linewidth=lw, zorder=2, joinstyle="round"))
    ax.text(x + w / 2, y + h / 2 + (2.5 if sub else 0), label, ha="center", va="center",
            color=color, fontsize=fontsize, zorder=3)
    if sub:
        ax.text(x + w / 2, y + h / 2 - 5, sub, ha="center", va="center",
                color=MUTED, fontsize=fontsize - 2, zorder=3)


def arrow(ax, xy_from, xy_to, color=INK, text=None, rad=0.0, style="->", lw=1.5,
          fontsize=9, dy=2.5):
    ax.annotate("", xy=xy_to, xytext=xy_from,
                arrowprops=dict(arrowstyle=style, color=color, lw=lw,
                                connectionstyle=f"arc3,rad={rad}"), zorder=4)
    if text:
        mx = (xy_from[0] + xy_to[0]) / 2
        my = (xy_from[1] + xy_to[1]) / 2 + dy
        ax.text(mx, my, text, ha="center", va="bottom", color=color, fontsize=fontsize,
                zorder=5)
