#!/usr/bin/env bash
# Run the reader's browser tests: builds tests/site/, starts the test servers, runs every tests/*.test.js
# with Node's test runner and Playwright, and stops the servers.
#
#   tests/run.sh                    all tests
#   tests/run.sh tests/urls.test.js one file
#   SLOW=1 tests/run.sh             also load the real Kokoro and Pocket TTS models
#   NETWORK=1 tests/run.sh          also check the CDN version of the reader policy (needs internet access)
#
# Needs Python 3, Node 20.10+, unzip, Playwright with Chromium, and for the export tests ffmpeg (cd tests && npm install && npx playwright install chromium).
# Everything runs against local servers on ports 8790-8795; the browser is blocked from reaching other sites.
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
# Is something answering on a local port? (Python rather than curl, which minimal systems lack: REVIEW.md T-15.)
listening() { python3 -c 'import socket,sys; s=socket.socket(); s.settimeout(0.2); sys.exit(0 if s.connect_ex(("127.0.0.1", int(sys.argv[1]))) == 0 else 1)' "$1"; }
for port in 8790 8791 8792 8793 8794 8795; do
  if listening "$port"; then echo "Port $port is already in use (an earlier run still going?): stop it and try again." >&2; exit 1; fi
done
# The site sends the reader policy from nginx.conf.example, so the tests check that documented policy works.
# Folders whose config uses CDNs or remote content (which that policy forbids, by design) are left out.
skip=/folder-remote/,/folder-cdn/,/folder-partial/
python3 tests/server.py --root tests/site --port 8790 --breeze --csp-from nginx.conf.example --csp-skip "$skip" & pids+=($!)
python3 tests/server.py --root tests/site --port 8791 --soft404 --csp-from nginx.conf.example --csp-skip "$skip" & pids+=($!)
# A server that ignores range requests, so books there are downloaded whole (the fallback path).
python3 tests/server.py --root tests/site --port 8793 --no-range --csp-from nginx.conf.example --csp-skip "$skip" & pids+=($!)
python3 tests/server.py --root tests/site --port 8792 --log & pids+=($!)
# The same site with the CDN version of the reader policy (tests that reach CDNs run only with NETWORK=1).
python3 tests/server.py --root tests/site --port 8794 --csp-from nginx.conf.example --csp-variant cdn & pids+=($!)
# The same site with no reader policy at all, as any static server: the hostile-book tests run here too, so the
# book pages' own policy and the cleaning are what keep books in (REVIEW.md T-14).
python3 tests/server.py --root tests/site --port 8795 & pids+=($!)
# Wait for each server; stop if one of them exited instead (a failed start).
ports=(8790 8791 8793 8792 8794 8795)
for k in "${!ports[@]}"; do
  for _ in $(seq 1 100); do
    listening "${ports[$k]}" && break
    kill -0 "${pids[$k]}" 2>/dev/null || { echo "The test server for port ${ports[$k]} didn't start." >&2; exit 1; }
    sleep 0.1
  done
  listening "${ports[$k]}" || { echo "The test server for port ${ports[$k]} isn't answering." >&2; exit 1; }
done

if [ $# -gt 0 ]; then files=("$@"); else files=(tests/*.test.js); fi
NO_PROXY=localhost,127.0.0.1 no_proxy=localhost,127.0.0.1 node --test --test-concurrency=1 "${files[@]}"
