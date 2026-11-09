#!/usr/bin/env bash
# Download everything the natural voice (Kokoro) needs into ./kokoro/ next to index.html, so the
# reader loads it from this site instead of cdn.jsdelivr.net and huggingface.co.
#
#   ./fetch-kokoro.sh            run from anywhere; files go next to this script
#
# Safe to re-run: finished files are skipped and interrupted downloads resume. Total is about 450 MB.
# Every file is checked against checksums/kokoro.sha256; any that don't match are removed (run it again).
# The reader uses kokoro.web.js and ort/ (when all its files are there) from here, and each model file it
# finds here, and takes the rest from the CDNs.
set -euo pipefail
cd "$(dirname "$0")"
# Options, in any order:
#   --list        print the URL and path of each file and download nothing (tools/make-checksums.py uses it)
#   --no-verify   skip the checksum check (not recommended)
LIST=0 VERIFY=1
for arg in "$@"; do
  case "$arg" in
    --list) LIST=1 ;;
    --no-verify) VERIFY=0 ;;
    *) echo "Unknown option: $arg (options: --list, --no-verify)" >&2; exit 2 ;;
  esac
done

KOKORO_JS=1.2.1      # must match KOKORO.lib in index.html
TRANSFORMERS=3.5.1   # transformers.js version bundled in kokoro-js 1.2.1; its dist/ holds the ONNX Runtime files it loads
PHONEMIZER=1.2.1     # bundled in kokoro-js 1.2.1 (licence only)
MODEL=onnx-community/Kokoro-82M-v1.0-ONNX
REV=1939ad2a8e416c0acfeecc08a694d14ef25f2231     # model revision: must match KOKORO.revision in index.html
DEST=kokoro

JSD=https://cdn.jsdelivr.net/npm
HF=https://huggingface.co/$MODEL/resolve/$REV

command -v curl >/dev/null || { echo "curl is required" >&2; exit 1; }

say() { [ "$LIST" = 1 ] || echo "$@"; }
get() {   # get URL PATH-UNDER-DEST
  local url=$1 out=$DEST/$2
  if [ "$LIST" = 1 ]; then printf '%s	%s
' "$url" "$out"; return; fi
  if [ -s "$out" ]; then echo "  have   $2"; return; fi
  mkdir -p "$(dirname "$out")"
  echo "  fetch  $2"
  # A partial download is resumed only if it came from the same address (after a version change it starts
  # afresh), and from the beginning if the server can't resume (curl's exit code 33).
  if [ -f "$out.part" ] && [ "$(cat "$out.part.url" 2>/dev/null)" != "$url" ]; then rm -f "$out.part"; fi
  printf '%s\n' "$url" > "$out.part.url"
  local rc=0
  curl -fL --retry 3 --retry-delay 2 -C - --progress-bar -o "$out.part" "$url" || rc=$?
  if [ "$rc" = 33 ]; then rm -f "$out.part"; rc=0; curl -fL --retry 3 --retry-delay 2 --progress-bar -o "$out.part" "$url" || rc=$?; fi
  [ "$rc" = 0 ] || { echo "  failed $2 (curl exit $rc; run the script again to resume)" >&2; exit 1; }
  mv "$out.part" "$out"; rm -f "$out.part.url"
}

# Check every downloaded file against the pinned SHA-256 list in checksums/ (committed with this script).
# Files that don't match are removed, so running the script again downloads them afresh.
verify() {
  local sums=checksums/$1.sha256 bad=0 hash path tool
  if [ "$VERIFY" = 0 ]; then echo "Checksums not checked (--no-verify)."; return; fi
  [ -f "$sums" ] || { echo "Missing $sums, so the downloads can't be checked. Run --no-verify to skip the check." >&2; exit 1; }
  if command -v sha256sum >/dev/null; then tool=(sha256sum); elif command -v shasum >/dev/null; then tool=(shasum -a 256)
  else echo "Neither sha256sum nor shasum is installed, so the downloads can't be checked." >&2
       echo "Install one (coreutils, or perl for shasum), or run again with --no-verify to skip the check." >&2; exit 1; fi
  echo "Checking files against $sums"
  while read -r hash path; do
    [ -f "$path" ] || continue
    if [ "$("${tool[@]}" "$path" | cut -d' ' -f1)" != "$hash" ]; then echo "  BAD    $path (removed)"; rm -f "$path"; bad=1; fi
  done < "$sums"
  while IFS= read -r path; do   # lines are "<64 hex digits>  <path>": compare whole paths
    awk -v p="$path" 'substr($0, 67) == p { found = 1 } END { exit !found }' "$sums" || echo "  note   $path has no pinned checksum"
  done < <(find "$DEST" -type f ! -name NOTICE.txt ! -name '*.part' ! -name '*.part.url' | sort)
  if [ "$bad" = 1 ]; then echo "Some files didn't match their checksums and were removed; run this script again." >&2; exit 1; fi
  echo "All files match their checksums."
}

say "Library"
get "$JSD/kokoro-js@$KOKORO_JS/dist/kokoro.web.js"                                   kokoro.web.js

say "ONNX Runtime (WebAssembly + WebGPU)"
get "$JSD/@huggingface/transformers@$TRANSFORMERS/dist/ort-wasm-simd-threaded.jsep.mjs"  ort/ort-wasm-simd-threaded.jsep.mjs
get "$JSD/@huggingface/transformers@$TRANSFORMERS/dist/ort-wasm-simd-threaded.jsep.wasm" ort/ort-wasm-simd-threaded.jsep.wasm

say "Model ($MODEL)"
for f in config.json tokenizer.json tokenizer_config.json \
         onnx/model.onnx onnx/model_quantized.onnx; do   # fp32 for WebGPU, q8 for the CPU
  get "$HF/$f" "model/$f"
done

say "Voices"
# The voice ids the reader offers, read from KOKORO_VOICES in index.html so the two stay in sync.
voices=$(grep -o "\['[ab][fm]_[a-z]*'" index.html | tr -d "['" | sort -u)
[ -n "$voices" ] || { echo "Couldn't find the voice list in index.html" >&2; exit 1; }
for v in $voices; do get "$HF/voices/$v.bin" "model/voices/$v.bin"; done

say "Licences"
get "$JSD/kokoro-js@$KOKORO_JS/LICENSE"                 LICENSES/kokoro-js.txt
get "$JSD/@huggingface/transformers@$TRANSFORMERS/LICENSE" LICENSES/transformers.js.txt
get "$JSD/phonemizer@$PHONEMIZER/LICENSE"               LICENSES/phonemizer.txt
get "$HF/README.md"                                      LICENSES/Kokoro-82M-v1.0-ONNX-model-card.md
[ "$LIST" = 1 ] && exit 0
verify kokoro
cat > "$DEST/LICENSES/NOTICE.txt" <<NOTICE
Self-hosted copies of the files the reader's natural voice uses, fetched by fetch-kokoro.sh.

kokoro-js $KOKORO_JS (kokoro.web.js)  Apache-2.0        https://www.npmjs.com/package/kokoro-js
  bundles transformers.js $TRANSFORMERS     Apache-2.0  https://github.com/huggingface/transformers.js
  bundles phonemizer $PHONEMIZER            Apache-2.0 as published; built from eSpeak NG, which is GPL-3.0
ONNX Runtime Web (ort/)              MIT               https://github.com/microsoft/onnxruntime
Kokoro-82M v1.0 ONNX (model/)        Apache-2.0        https://huggingface.co/$MODEL (revision $REV)
NOTICE

echo
du -sh "$DEST" | awk '{print "Done: " $1 " in " $2 "/"}'
