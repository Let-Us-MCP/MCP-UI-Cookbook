"""The two halves of the bridge and the message families that cross it."""
import sys; sys.path.insert(0, "figures-src")
import matplotlib.patches as mp
from _style import ACCENT, GOOD, INK, MUTED, bare, caption, diagram

with diagram(figsize=(7.8, 4.2)) as (fig, ax):
    bare(ax, (0, 100), (0, 78))

    ax.add_patch(mp.FancyBboxPatch((2, 26), 25, 44, boxstyle="round,pad=0.8",
                                   facecolor="#FFFFFF", edgecolor=INK, lw=1.8))
    ax.text(14.5, 65, "Host", color=INK, fontsize=12, ha="center")
    ax.text(14.5, 60, "chat client, IDE, console", color=MUTED, fontsize=7.5,
            ha="center", va="top")
    ax.text(14.5, 48, "sends", color=MUTED, fontsize=8, ha="center")
    ax.text(14.5, 43, "ui/notifications/\n"
                      "  tool-input\n"
                      "  tool-result\n"
                      "  host-context-changed\n"
                      "ui/resource-teardown",
            color=MUTED, fontsize=6.4, ha="center", va="center", family="monospace")

    ax.add_patch(mp.FancyBboxPatch((38, 26), 26, 44, boxstyle="round,pad=0.8",
                                   facecolor="#F4F5F7", edgecolor=MUTED, lw=1.3,
                                   linestyle="--"))
    ax.text(51, 65.5, "Sandbox proxy", color=MUTED, fontsize=9, ha="center")
    ax.text(51, 61.5, "different origin, web hosts only", color=MUTED,
            fontsize=6.6, ha="center", va="top")
    ax.add_patch(mp.FancyBboxPatch((41, 30), 20, 26, boxstyle="round,pad=0.6",
                                   facecolor="#FFFFFF", edgecolor=ACCENT, lw=1.8))
    ax.text(51, 49, "View", color=ACCENT, fontsize=11, ha="center")
    ax.text(51, 44, "your HTML,\nopaque origin,\nno storage",
            color=MUTED, fontsize=7.2, ha="center", va="top")

    ax.add_patch(mp.FancyBboxPatch((75, 26), 23, 44, boxstyle="round,pad=0.8",
                                   facecolor="#FFFFFF", edgecolor=GOOD, lw=1.8))
    ax.text(86.5, 65, "MCP server", color=GOOD, fontsize=12, ha="center")
    ax.text(86.5, 60, "tools and ui:// resources", color=MUTED, fontsize=7.5,
            ha="center", va="top")
    ax.text(86.5, 45, "the view never\nholds this\nconnection",
            color=MUTED, fontsize=7.2, ha="center", va="center")

    ax.annotate("", xy=(37.4, 34), xytext=(27.6, 34),
                arrowprops=dict(arrowstyle="<->", color=ACCENT, lw=1.6))
    ax.text(32.5, 36.5, "JSON-RPC", color=ACCENT, fontsize=6.8, ha="center")

    ax.annotate("", xy=(74.4, 34), xytext=(64.6, 34),
                arrowprops=dict(arrowstyle="<->", color=GOOD, lw=1.6))
    ax.text(69.5, 36.5, "stdio", color=GOOD, fontsize=6.8, ha="center")

    ax.text(50, 20, "the view sends", color=ACCENT, fontsize=8, ha="center")
    ax.text(50, 15.5,
            "ui/initialize    ui/open-link    ui/download-file    ui/message\n"
            "ui/update-model-context    ui/request-display-mode    tools/call\n"
            "resources/read    sampling/createMessage    ui/notifications/size-changed",
            color=ACCENT, fontsize=6.8, ha="center", va="top", family="monospace")

    caption(fig, "About twenty methods in total. Half of this book is about "
                 "what is not on the list.", y=0.02)

fig.savefig(sys.argv[1], bbox_inches="tight", facecolor="white")
