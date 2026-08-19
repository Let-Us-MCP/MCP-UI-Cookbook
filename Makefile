# The MCP UI Cookbook
#
# `make` builds everything a reader sees. `make check` is what CI runs.

PY   := $(shell [ -x .venv/bin/python ] && echo .venv/bin/python || echo python3)
NODE := node

.PHONY: all registry site demos figures fixtures check lint refs listings counts \
        claims transcripts serve venv clean

all: registry fixtures demos figures site

registry:
	python3 capabilities/registry.py

fixtures:
	$(NODE) tools/record_fixtures.mjs

demos:
	python3 tools/build_demos.py

figures:
	python3 tools/build_figures.py

site:
	python3 tools/build_site.py

check: lint density refs listings counts claims identifiers webclaims transcripts render

lint:
	python3 tools/lint_prose.py

# Measures whether sentences carry anything a reader can act on, rather than
# measuring their length, which is a proxy that rewards staccato waffle.
density:
	python3 tools/audit_density.py

refs:
	python3 tools/check_refs.py

listings:
	python3 tools/check_listings.py

counts:
	python3 tools/check_counts.py

# Both need proto/, the pair of specification clones. They skip cleanly without
# them so CI stays green; run them locally before publishing.
claims:
	python3 tools/check_claims.py

identifiers:
	python3 tools/check_identifiers.py

webclaims:
	python3 tools/check_web_claims.py

# Downloads the W3C, WHATWG and ecosystem references the book cites into
# proto/refs/, which is never committed.
refs-fetch:
	bash tools/fetch_refs.sh

# Drives every demonstration in headless Chrome and diffs the recorded
# JSON-RPC log. UPDATE_TRANSCRIPTS=1 accepts a new one.
transcripts:
	$(NODE) tools/check_demos.mjs

# Starts each recipe's real MCP server, renders the view it delivers, feeds it
# that server's real tool output, and asserts on the resulting DOM.
render:
	$(NODE) tools/check_render.mjs

serve:
	$(NODE) tools/serve.mjs

venv:
	python3 -m venv .venv && .venv/bin/pip install -q matplotlib

clean:
	rm -rf docs/*.html docs/demos
