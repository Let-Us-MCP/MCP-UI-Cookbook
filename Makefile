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

check: lint refs listings counts claims transcripts

lint:
	python3 tools/lint_prose.py

refs:
	python3 tools/check_refs.py

listings:
	python3 tools/check_listings.py

counts:
	python3 tools/check_counts.py

# Needs proto/, the pair of specification clones. Skips cleanly without them so
# CI stays green; run it locally before publishing.
claims:
	python3 tools/check_claims.py

# Drives every demonstration in headless Chrome and diffs the recorded
# JSON-RPC log. UPDATE_TRANSCRIPTS=1 accepts a new one.
transcripts:
	$(NODE) tools/check_demos.mjs

serve:
	$(NODE) tools/serve.mjs

venv:
	python3 -m venv .venv && .venv/bin/pip install -q matplotlib

clean:
	rm -rf docs/*.html docs/demos
