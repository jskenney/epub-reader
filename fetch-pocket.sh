#!/usr/bin/env bash
# Download what the Pocket TTS natural voice needs into ./pocket/ next to index.html, so the reader
# loads it from this site instead of cdn.jsdelivr.net and huggingface.co.
#
#   ./fetch-pocket.sh                  English only (about 430 MB)
#   ./fetch-pocket.sh en de it         the listed languages
#   ./fetch-pocket.sh all              English, German, Italian, Portuguese and Spanish
#   (French isn't offered: its model bundle has no built-in voices at this revision, so it can't speak.)
#   ./fetch-pocket.sh --int8 en        the 8-bit models instead (about 170 MB per language), for a
#                                      reader with FULL_PRECISION set to false in index.html
#
# Safe to re-run: finished files are skipped and interrupted downloads resume.
# Every file is checked against checksums/pocket.sha256; any that don't match are removed (run it again).
# The reader uses each folder here (lib/, ort/, model/<bundle>/) only when all its files are there, the
# model's in the precision it uses, and takes the rest from the CDNs.
set -euo pipefail
cd "$(dirname "$0")"

POCKET_JS=0.1.0                                         # must match POCKET.lib in index.html
ORT=1.20.0                                              # must match POCKET.ort in index.html
REPO=vlapky/pocket-tts-onnx
REV=c469236dbc5f68287fa2fbf175b66de3b80123af            # must match POCKET.model in index.html
GOT=()
DEST=pocket

JSD=https://cdn.jsdelivr.net/npm
HF=https://huggingface.co/$REPO/resolve/$REV/onnx

command -v curl >/dev/null || { echo "curl is required" >&2; exit 1; }

bundle_for() {   # language code -> model bundle (keep in sync with POCKET_LANGS in index.html)
  case "$1" in
    en) echo english_2026-04 ;; de) echo german ;;
    it) echo italian ;; pt) echo portuguese ;; es) echo spanish ;;
    fr) echo "French isn't available: its model bundle has no built-in voices at this revision" >&2; exit 1 ;;
    *) echo "Unknown language '$1' (use en, de, it, pt, es or all)" >&2; exit 1 ;;
  esac
}
# Arguments, in any order: language codes (or all), and the options
#   --int8        the 8-bit models instead of full precision (the reader's default)
#   --list        print the URL and path of each file and download nothing (tools/make-checksums.py uses it)
#   --no-verify   skip the checksum check (not recommended)
LIST=0 VERIFY=1 suffix="" langs=()
for arg in "$@"; do
  case "$arg" in
    --list) LIST=1 ;;
    --no-verify) VERIFY=0 ;;
    --int8) suffix=_int8 ;;
    -*) echo "Unknown option: $arg (options: --int8, --list, --no-verify)" >&2; exit 2 ;;
    *) langs+=("$arg") ;;
  esac
done
[ ${#langs[@]} -gt 0 ] || langs=(en)
for l in "${langs[@]}"; do [ "$l" = all ] && langs=(en de it pt es) && break; done   # ("all" anywhere in the list)

say() { [ "$LIST" = 1 ] || echo "$@"; }
get() {   # get URL PATH-UNDER-DEST
  local url=$1 out=$DEST/$2
  GOT+=("$out")   # (every file this script downloads must have a pinned checksum: verify)
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
  local sums=checksums/$1.sha256 bad=0 unpinned=0 hash path tool
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
    awk -v p="$path" 'substr($0, 67) == p { found = 1 } END { exit !found }' "$sums" && continue
    # A file this script downloads but the list doesn't name can't be checked: that fails, rather than passing
    # unchecked (REVIEW.md L-89). Other files someone put here are only noted.
    if printf '%s\n' "${GOT[@]}" | grep -qxF -- "$path"; then echo "  UNPINNED $path: not in $sums, so it can't be checked"; unpinned=1
    else echo "  note   $path has no pinned checksum"; fi
  done < <(find "$DEST" -type f ! -name NOTICE.txt ! -name '*.part' ! -name '*.part.url' | sort)
  if [ "$bad" = 1 ]; then echo "Some files didn't match their checksums and were removed; run this script again." >&2; exit 1; fi
  if [ "$unpinned" = 1 ]; then echo "Some downloaded files have no pinned checksum: update $sums (python3 tools/make-checksums.py), or run with --no-verify." >&2; exit 1; fi
  echo "All files match their checksums."
}

say "Library (pocket-tts-js $POCKET_JS)"
for f in worker.js binary.js tokenizer.js; do get "$JSD/pocket-tts-js@$POCKET_JS/src/$f" "lib/$f"; done

say "ONNX Runtime Web $ORT"
for f in ort.min.mjs ort-wasm-simd-threaded.mjs ort-wasm-simd-threaded.wasm; do get "$JSD/onnxruntime-web@$ORT/dist/$f" "ort/$f"; done

for lang in "${langs[@]}"; do
  b=$(bundle_for "$lang")
  say "Model: $b"
  # the four models (full precision, or 8-bit with --int8) plus the built-in voices;
  # the voice-cloning encoder isn't used
  for f in bundle.json tokenizer.model voices.bin text_conditioner$suffix.onnx flow_lm_main$suffix.onnx \
           flow_lm_flow$suffix.onnx mimi_decoder$suffix.onnx; do
    get "$HF/$b/$f" "model/$b/$f"
  done
done

say "Licences"
get "$JSD/pocket-tts-js@$POCKET_JS/LICENSE"  LICENSES/pocket-tts-js.txt
get "$HF/LICENSE"                            LICENSES/pocket-tts-model-LICENSE.txt
get "https://huggingface.co/$REPO/resolve/$REV/README.md" LICENSES/pocket-tts-onnx-model-card.md
[ "$LIST" = 1 ] && exit 0
verify pocket
cat > "$DEST/LICENSES/NOTICE.txt" <<NOTICE
Self-hosted copies of the files the reader's Pocket TTS voice uses, fetched by fetch-pocket.sh.

pocket-tts-js $POCKET_JS (lib/)         MIT          https://github.com/vlapky/pocket-tts-js
ONNX Runtime Web $ORT (ort/)        MIT          https://github.com/microsoft/onnxruntime
Pocket TTS ONNX export (model/)       CC-BY-4.0    https://huggingface.co/$REPO (revision $REV)
  Pocket TTS by Kyutai                CC-BY-4.0    https://huggingface.co/kyutai/pocket-tts
Attribution: "Pocket TTS" by Kyutai, licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/).
NOTICE

echo
du -sh "$DEST" | awk '{print "Done: " $1 " in " $2 "/"}'
