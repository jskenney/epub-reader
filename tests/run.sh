#!/usr/bin/env bash
# Run the reader's browser tests: builds tests/site/, starts the test servers, runs every tests/*.test.js
# with Node's test runner and Playwright, and stops the servers.
#
#   tests/run.sh                    all tests
#   tests/run.sh tests/urls.test.js one file
#
# Needs Python 3, Node 18+ and Playwright with Chromium (cd tests && npm install && npx playwright install chromium).
# Everything runs against local servers on ports 8790-8792; the browser is blocked from reaching other sites.
set -euo pipefail
cd "$(dirname "$0")/.."

export NODE_PATH="$PWD/tests/node_modules${NODE_PATH:+:$NODE_PATH}"   # Playwright from tests/node_modules, or a global install
node -e "require('playwright')" 2>/dev/null || { echo "Playwright not found: cd tests && npm install && npx playwright install chromium" >&2; exit 1; }
# The tests run self-hosted (the browser can't reach CDNs): fetch the libraries and fonts once if missing.
[ -f libs/jszip.min.js ] || ./fetch-libs.sh
[ -f fonts/ui.css ] || ./fetch-fonts.sh
python3 tests/build_fixtures.py

pids=()
cleanup() { kill "${pids[@]}" 2>/dev/null || true; }
trap cleanup EXIT
# The site sends the reader policy from nginx.conf.example, so the tests check that documented policy works.
# Folders whose config uses CDNs or remote content (which that policy forbids, by design) are left out.
skip=/folder-remote/,/folder-cdn/,/folder-partial/
python3 tests/server.py --root tests/site --port 8790 --breeze --csp-from nginx.conf.example --csp-skip "$skip" & pids+=($!)
python3 tests/server.py --root tests/site --port 8791 --soft404 --csp-from nginx.conf.example --csp-skip "$skip" & pids+=($!)
# A server that ignores range requests, so books there are downloaded whole (the fallback path).
python3 tests/server.py --root tests/site --port 8793 --no-range --csp-from nginx.conf.example --csp-skip "$skip" & pids+=($!)
python3 tests/server.py --root tests/site --port 8792 --log & pids+=($!)
for port in 8790 8791 8792 8793; do
  for _ in $(seq 1 50); do curl -s -o /dev/null "http://localhost:$port/" && break; sleep 0.1; done
done

if [ $# -gt 0 ]; then files=("$@"); else files=(tests/*.test.js); fi
NO_PROXY=localhost,127.0.0.1 no_proxy=localhost,127.0.0.1 node --test --test-concurrency=1 "${files[@]}"
