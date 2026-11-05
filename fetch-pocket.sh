#!/usr/bin/env bash
# Download what the Pocket TTS natural voice needs into ./pocket/ next to index.html, so the reader
# loads it from this site instead of cdn.jsdelivr.net and huggingface.co.
#
#   ./fetch-pocket.sh                  English only (about 430 MB)
#   ./fetch-pocket.sh en fr de         the listed languages (French is about 1.25 GB)
#   ./fetch-pocket.sh all              English, French, German, Italian, Portuguese and Spanish
#   ./fetch-pocket.sh --int8 en        the 8-bit models instead (about 170 MB per language), for a
#                                      reader with FULL_PRECISION set to false in index.html
#
# Safe to re-run: finished files are skipped and interrupted downloads resume.
# The reader uses whichever of these files exist and falls back to the CDNs for the rest.
set -euo pipefail
cd "$(dirname "$0")"

POCKET_JS=0.1.0                                         # must match POCKET.lib in index.html
ORT=1.20.0                                              # must match POCKET.ort in index.html
REPO=vlapky/pocket-tts-onnx
REV=c469236dbc5f68287fa2fbf175b66de3b80123af            # must match POCKET.model in index.html
DEST=pocket

JSD=https://cdn.jsdelivr.net/npm
HF=https://huggingface.co/$REPO/resolve/$REV/onnx

command -v curl >/dev/null || { echo "curl is required" >&2; exit 1; }

bundle_for() {   # language code -> model bundle (keep in sync with POCKET_LANGS in index.html)
  case "$1" in
    en) echo english_2026-04 ;; fr) echo french_24l ;; de) echo german ;;
    it) echo italian ;; pt) echo portuguese ;; es) echo spanish ;;
    *) echo "Unknown language '$1' (use en, fr, de, it, pt, es or all)" >&2; exit 1 ;;
  esac
}
suffix=""   # full precision (the reader's default)
if [ "${1:-}" = --int8 ]; then suffix=_int8; shift; fi
langs=("$@"); [ ${#langs[@]} -gt 0 ] || langs=(en)
[ "${langs[0]}" = all ] && langs=(en fr de it pt es)

get() {   # get URL PATH-UNDER-pocket/
  local url=$1 out=$DEST/$2
  if [ -s "$out" ]; then echo "  have   $2"; return; fi
  mkdir -p "$(dirname "$out")"
  echo "  fetch  $2"
  curl -fL --retry 3 --retry-delay 2 -C - --progress-bar -o "$out.part" "$url"
  mv "$out.part" "$out"
}

echo "Library (pocket-tts-js $POCKET_JS)"
for f in worker.js binary.js tokenizer.js; do get "$JSD/pocket-tts-js@$POCKET_JS/src/$f" "lib/$f"; done

echo "ONNX Runtime Web $ORT"
for f in ort.min.mjs ort-wasm-simd-threaded.mjs ort-wasm-simd-threaded.wasm; do get "$JSD/onnxruntime-web@$ORT/dist/$f" "ort/$f"; done

for lang in "${langs[@]}"; do
  b=$(bundle_for "$lang")
  echo "Model: $b"
  # the four models (full precision, or 8-bit with --int8) plus the built-in voices;
  # the voice-cloning encoder isn't used
  for f in bundle.json tokenizer.model voices.bin text_conditioner$suffix.onnx flow_lm_main$suffix.onnx \
           flow_lm_flow$suffix.onnx mimi_decoder$suffix.onnx; do
    get "$HF/$b/$f" "model/$b/$f"
  done
done

echo "Licences"
get "$JSD/pocket-tts-js@$POCKET_JS/LICENSE"  LICENSES/pocket-tts-js.txt
get "$HF/LICENSE"                            LICENSES/pocket-tts-model-LICENSE.txt
get "https://huggingface.co/$REPO/resolve/$REV/README.md" LICENSES/pocket-tts-onnx-model-card.md
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
