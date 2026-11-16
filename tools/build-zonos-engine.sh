#!/usr/bin/env bash
# Rebuild zonos/engine/ (the ZONOS3-Mini browser engine: engine.js, worker.js, codec-worker.js) from ZONOS3-Mini's
# source at the pinned commit, and check it against checksums/zonos-engine.sha256. The build is reproducible, so a
# match means the committed files are exactly what that source builds to.
#
#   tools/build-zonos-engine.sh           build in a temporary folder and compare (changes nothing)
#   tools/build-zonos-engine.sh --write   also copy the build into zonos/engine/ and rewrite the checksums
#                                         (after changing ZONOS3_COMMIT here and ZONOS.commit in index.html)
#
# Needs git, Node 20+ and pnpm (corepack enable).
set -euo pipefail
cd "$(dirname "$0")/.."

ZONOS3_COMMIT=96d9e0ec1e39083ed336ac78f24e3dbc93721c0f   # must match ZONOS.commit in index.html
WRITE=0
[ "${1:-}" = --write ] && WRITE=1

for tool in git node pnpm; do command -v "$tool" >/dev/null || { echo "$tool is required" >&2; exit 1; }; done
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
echo "ZONOS3-Mini at ${ZONOS3_COMMIT:0:7}"
git init -q "$tmp/src"
git -C "$tmp/src" fetch -q --depth 1 https://github.com/Zyphra/ZONOS3-Mini.git "$ZONOS3_COMMIT"
git -C "$tmp/src" checkout -q FETCH_HEAD
(cd "$tmp/src" && pnpm install --silent --frozen-lockfile --filter 'zonos3-web...' && pnpm --silent --dir servers/web build)
dist=$tmp/src/servers/web/dist

if [ "$WRITE" = 1 ]; then
  mkdir -p zonos/engine
  cp "$dist"/engine.js "$dist"/worker.js "$dist"/codec-worker.js zonos/engine/
  cp "$tmp/src/LICENSE" zonos/engine/LICENSE; cp "$tmp/src/NOTICE" zonos/engine/NOTICE
  (cd zonos/engine && sha256sum engine.js worker.js codec-worker.js | sed 's|  |  zonos/engine/|') > checksums/zonos-engine.sha256
  echo "Wrote zonos/engine/ and checksums/zonos-engine.sha256."
else
  mkdir -p "$tmp/check/zonos/engine"
  cp "$dist"/engine.js "$dist"/worker.js "$dist"/codec-worker.js "$tmp/check/zonos/engine/"
  (cd "$tmp/check" && sha256sum -c --quiet "$OLDPWD/checksums/zonos-engine.sha256") \
    && echo "The build matches checksums/zonos-engine.sha256." \
    || { echo "The build doesn't match checksums/zonos-engine.sha256." >&2; exit 1; }
  (sha256sum -c --quiet checksums/zonos-engine.sha256) \
    && echo "zonos/engine/ matches it too." || { echo "zonos/engine/ doesn't match it." >&2; exit 1; }
fi
