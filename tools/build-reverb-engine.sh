#!/usr/bin/env bash
# Rebuild reverb/engine/reverb.js (the Reverb-TTS browser engine: runntime's text to speech and voice maker on WebGPU,
# TypeGPU, and Verbalis for spelling text out) from the npm releases pinned in tools/reverb-engine/package-lock.json,
# and check it against checksums/reverb-engine.sha256. The build is reproducible, so a match means the committed file
# is exactly what those releases build to.
#
#   tools/build-reverb-engine.sh           build in a temporary folder and compare (changes nothing)
#   tools/build-reverb-engine.sh --write   also copy the build into reverb/engine/ and rewrite the checksum (after
#                                          changing the versions in tools/reverb-engine/package.json and running
#                                          npm install there to update its lock file)
#
# Needs Node 20+ and npm (npm ci fetches the exact versions and checks them against the lock file's integrity hashes).
set -euo pipefail
cd "$(dirname "$0")/.."

WRITE=0
for arg in "$@"; do
  case "$arg" in
    --write) WRITE=1 ;;
    *) echo "Unknown option: $arg (options: --write)" >&2; exit 2 ;;
  esac
done
for tool in node npm; do command -v "$tool" >/dev/null || { echo "$tool is required" >&2; exit 1; }; done
if command -v sha256sum >/dev/null; then SHA=(sha256sum); elif command -v shasum >/dev/null; then SHA=(shasum -a 256)
else echo "sha256sum or shasum is required" >&2; exit 1; fi

tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
cp tools/reverb-engine/package.json tools/reverb-engine/package-lock.json tools/reverb-engine/entry.js "$tmp/"
(cd "$tmp" && npm ci --silent --no-audit --no-fund --ignore-scripts \
  && node node_modules/esbuild/bin/esbuild entry.js --bundle --format=esm --platform=browser --target=es2022 \
       --minify --legal-comments=eof --log-level=warning --outfile=reverb.js)
# The licences of what it bundles, beside it (runntime and TypeGPU MIT, the tokenizers Apache-2.0, Verbalis MIT).
{ for p in runntime typegpu verbalis @huggingface/tokenizers; do
    f=$(ls "$tmp/node_modules/$p"/LICENSE* 2>/dev/null | head -1 || true)
    echo "== $p $(node -p "require('$tmp/node_modules/$p/package.json').version") ($(node -p "require('$tmp/node_modules/$p/package.json').license"))"
    [ -n "$f" ] && cat "$f"; echo
  done; } > "$tmp/LICENSES.txt"

if [ "$WRITE" = 1 ]; then
  mkdir -p reverb/engine
  cp "$tmp/reverb.js" "$tmp/LICENSES.txt" reverb/engine/
  (cd reverb/engine && "${SHA[@]}" reverb.js | sed 's|  |  reverb/engine/|') > checksums/reverb-engine.sha256
  echo "Wrote reverb/engine/ and checksums/reverb-engine.sha256."
else
  mkdir -p "$tmp/check/reverb/engine" && cp "$tmp/reverb.js" "$tmp/check/reverb/engine/"
  (cd "$tmp/check" && "${SHA[@]}" -c --quiet "$OLDPWD/checksums/reverb-engine.sha256") \
    && echo "The build matches checksums/reverb-engine.sha256." \
    || { echo "The build doesn't match checksums/reverb-engine.sha256." >&2; exit 1; }
  ("${SHA[@]}" -c --quiet checksums/reverb-engine.sha256) \
    && echo "reverb/engine/ matches it too." || { echo "reverb/engine/ doesn't match it." >&2; exit 1; }
fi
