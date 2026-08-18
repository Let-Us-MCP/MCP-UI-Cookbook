#!/usr/bin/env bash
# Download the references the book cites, for the claim checkers to grep.
# Everything lands in proto/refs/, which is never committed.
set -u
cd "$(dirname "$0")/.."
mkdir -p proto/refs
get() {
  curl -sL --max-time 90 -A "Mozilla/5.0 (cookbook reference fetch)" "$2" \
    -o "proto/refs/$1" && printf "  %-26s %8s bytes\n" "$1" "$(wc -c < "proto/refs/$1")"
}
get csp3.html                https://www.w3.org/TR/CSP3/
get permissions-policy.html  https://www.w3.org/TR/permissions-policy/
get clipboard.html           https://www.w3.org/TR/clipboard-apis/
get pointerevents3.html      https://www.w3.org/TR/pointerevents3/
get webshare.html            https://www.w3.org/TR/web-share/
get wai-aria.html            https://www.w3.org/TR/wai-aria-1.2/
get wcag22.html              https://www.w3.org/TR/WCAG22/
get apg.html                 https://www.w3.org/WAI/ARIA/apg/patterns/
get html-sandbox.html        https://html.spec.whatwg.org/multipage/browsers.html
get html-iframe.html         https://html.spec.whatwg.org/multipage/iframe-embed-object.html
get html-dnd.html            https://html.spec.whatwg.org/multipage/dnd.html
get html-dialog.html         https://html.spec.whatwg.org/multipage/interactive-elements.html
get dtcg.html                https://tr.designtokens.org/format/
get appssdk.html             https://developers.openai.com/apps-sdk/
[ -d proto/refs/mcp-ui ] || git clone -q --depth 1 https://github.com/idosal/mcp-ui.git proto/refs/mcp-ui
[ -d proto/ext-apps ] || git clone -q --depth 1 https://github.com/modelcontextprotocol/ext-apps.git proto/ext-apps
[ -d proto/modelcontextprotocol ] || git clone -q --depth 1 https://github.com/modelcontextprotocol/modelcontextprotocol.git proto/modelcontextprotocol
echo "references in proto/refs/"
