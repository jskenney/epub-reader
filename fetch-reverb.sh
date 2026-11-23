#!/usr/bin/env bash
# Download Reverb-TTS's files into ./reverb/models/ next to index.html, so the reader's Reverb voice loads them from this
# site instead of huggingface.co (REVIEW.md E-50).
#
#   ./fetch-reverb.sh          the int4 model, the audio codec, the tokenizer and the 16 preset voices (about 385 MB):
#                              what the reader uses by default
#   ./fetch-reverb.sh --full   also the int8 and fp16 models (about 900 MB more), which the reader uses when
#                              FULL_PRECISION is on (fp16 on a GPU with shader-f16, int8 otherwise)
#
# Reverb's weights are CC BY-NC 4.0: non-commercial use only, with attribution (README: "Reverb").
# The engine itself (reverb/engine/reverb.js) is part of the reader, built by tools/build-reverb-engine.sh.
#
# Safe to re-run: finished files are skipped and interrupted downloads resume. Every file is checked against
# checksums/reverb.sha256; any that don't match are removed (run it again).
set -euo pipefail
cd "$(dirname "$0")"

REV=f5759ca1b6c4efc4a5b7113068560323730628a5          # software-mansion/Reverb-TTS: must match REVERB.rev in index.html
CODEC_REV=e0d9ccd2935d7f953764a83b09444dc0677a44a0    # its codec: must match REVERB.codecRev
HUB=https://huggingface.co/software-mansion/Reverb-TTS/resolve/$REV
CODEC=https://huggingface.co/software-mansion/higgs-audio-v2-tokenizer-Reverb/resolve/$CODEC_REV/combined/safetensors/d8e8/model.safetensors
DEST=reverb/models
SUMS=checksums/reverb.sha256

FULL=0 VERIFY=1
for arg in "$@"; do
  case "$arg" in
    --full) FULL=1 ;;
    --no-verify) VERIFY=0 ;;
    *) echo "Unknown option: $arg (options: --full, --no-verify)" >&2; exit 2 ;;
  esac
done
command -v curl >/dev/null || { echo "curl is required" >&2; exit 1; }
[ -f "$SUMS" ] || { echo "Missing $SUMS" >&2; exit 1; }
if [ "$VERIFY" = 1 ]; then
  if command -v sha256sum >/dev/null; then SHA=(sha256sum); elif command -v shasum >/dev/null; then SHA=(shasum -a 256)
  else echo "Neither sha256sum nor shasum is installed: run again with --no-verify to skip the check." >&2; exit 1; fi
fi

get() {   # get PATH-UNDER-DEST
  local f=$1 out=$DEST/$1 url
  case "$f" in codec/model.safetensors) url=$CODEC ;; *) url=$HUB/$f ;; esac
  [ -s "$out" ] && return
  mkdir -p "$(dirname "$out")"
  echo "  fetch  $f"
  local rc=0
  curl -fsSL --retry 3 --retry-delay 2 -C - -o "$out.part" "$url" || rc=$?
  if [ "$rc" = 33 ]; then rm -f "$out.part"; rc=0; curl -fsSL --retry 3 --retry-delay 2 -o "$out.part" "$url" || rc=$?; fi
  [ "$rc" = 0 ] || { echo "  failed $f (curl exit $rc; run the script again to resume)" >&2; exit 1; }
  mv "$out.part" "$out"
}

echo "Reverb-TTS (revision ${REV:0:8}): $([ "$FULL" = 1 ] && echo 'every model, about 1.3 GB' || echo 'int4, about 385 MB')"
# NOTICE.txt is written only once every file is here and checked: the reader uses the folder only then.
rm -f "$DEST/NOTICE.txt"
bad=0
while read -r hash path; do
  f=${path#"$DEST"/}
  case "$f" in model/runntime/int8/*|model/safetensors/fp16/*) [ "$FULL" = 1 ] || continue ;; esac
  get "$f"
  if [ "$VERIFY" = 1 ] && [ "$("${SHA[@]}" "$path" | cut -d' ' -f1)" != "$hash" ]; then
    echo "  BAD    $f (removed)"; rm -f "$path"; bad=1
  fi
done < "$SUMS"
[ "$bad" = 0 ] || { echo "Some files didn't match their checksums and were removed; run this script again." >&2; exit 1; }
[ "$VERIFY" = 1 ] && echo "All files match their checksums."
cat > "$DEST/NOTICE.txt" <<NOTICE
Self-hosted copies of the files the reader's Reverb voice uses, fetched by fetch-reverb.sh.

Reverb-TTS (reverb/models/model/, voices/)   CC BY-NC 4.0 (non-commercial, with attribution)
  https://huggingface.co/software-mansion/Reverb-TTS (revision $REV)
Its audio codec, the Higgs Audio v2 tokenizer (reverb/models/codec/)
  https://huggingface.co/software-mansion/higgs-audio-v2-tokenizer-Reverb (revision $CODEC_REV)
The engine (reverb/engine/) bundles MIT and Apache-2.0 code: see reverb/engine/LICENSES.txt.
NOTICE
du -sh "$DEST" | awk '{print "Done: " $1 " in " $2 "/"}'
