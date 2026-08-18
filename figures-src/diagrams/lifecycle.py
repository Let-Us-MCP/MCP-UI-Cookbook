"""The lifecycle, as a sequence."""
import sys; sys.path.insert(0, "figures-src")
from _style import ACCENT, GOOD, INK, MUTED, WARM, bare, caption, diagram

STEPS = [
    ("view", "ui/initialize", ACCENT),
    ("host", "McpUiInitializeResult", MUTED),
    ("view", "ui/notifications/initialized", ACCENT),
    ("host", "ui/notifications/tool-input-partial  (0..n)", MUTED),
    ("host", "ui/notifications/tool-input", MUTED),
    ("host", "ui/notifications/tool-result  or  tool-cancelled", MUTED),
    ("view", "ui/notifications/size-changed  (whenever)", ACCENT),
    ("view", "tools/call, ui/message, ui/update-model-context", ACCENT),
    ("host", "ui/resource-teardown", WARM),
    ("view", "response, after flushing anything unsaved", GOOD),
]

with diagram(figsize=(7.4, 4.4)) as (fig, ax):
    bare(ax, (0, 100), (0, 100))
    ax.plot([22, 22], [4, 92], color="#C9CED6", lw=1.2)
    ax.plot([78, 78], [4, 92], color="#C9CED6", lw=1.2)
    ax.text(22, 95, "View", color=ACCENT, fontsize=10, ha="center")
    ax.text(78, 95, "Host", color=INK, fontsize=10, ha="center")

    for i, (side, label, colour) in enumerate(STEPS):
        y = 87 - i * 8.6
        if side == "view":
            ax.annotate("", xy=(77, y), xytext=(23, y),
                        arrowprops=dict(arrowstyle="->", color=colour, lw=1.3))
        else:
            ax.annotate("", xy=(23, y), xytext=(77, y),
                        arrowprops=dict(arrowstyle="->", color=colour, lw=1.3))
        ax.text(50, y + 1.4, label, color=colour, fontsize=7.4, ha="center",
                family="monospace")

    ax.text(50, 6, "nothing may be sent to the view before line 3",
            color=WARM, fontsize=7.6, ha="center")

    caption(fig, "The only pause a view ever gets is between the last two lines.",
            y=0.02)

fig.savefig(sys.argv[1], bbox_inches="tight", facecolor="white")
