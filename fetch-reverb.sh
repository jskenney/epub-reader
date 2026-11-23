#!/usr/bin/env bash
# Download Reverb-TTS's files into ./reverb/models/ next to index.html, so the reader's Reverb voice loads them from this
# site instead of huggingface.co (REVIEW.md E-50).
#
#   ./fetch-reverb.sh          what the reader uses by default (FULL_PRECISION on): the fp16 model (for GPUs with
#                              shader-f16) and the int8 one (for the others), the audio codec, the tokenizer and the
#                              16 preset voices (about 1,050 MB)
#   ./fetch-reverb.sh --int4   the int4 model instead, for FULL_PRECISION off (about 370 MB)
#   ./fetch-reverb.sh --all    every model (about 1,230 MB)
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
# The codec's licence (the Boson Higgs Audio 2 Community License, which takes in Meta's Llama 3 licence), at pinned
# revisions: a site that serves the codec redistributes it, and must ship both (round 40 review, M-213).
CODEC_CARD=https://huggingface.co/software-mansion/higgs-audio-v2-tokenizer-Reverb/resolve/$CODEC_REV/README.md
BOSON_LICENSE=https://huggingface.co/bosonai/higgs-audio-v2-tokenizer/resolve/815a03f1b57dcb5ae918db415f22cd0c8a6f0f54/LICENSE
LLAMA3_LICENSE=https://raw.githubusercontent.com/meta-llama/llama3/a0940f9cf7065d45bb6675660f80d305c041a754/LICENSE
DEST=reverb/models
SUMS=checksums/reverb.sha256

SET=full VERIFY=1
for arg in "$@"; do
  case "$arg" in
    --int4) SET=int4 ;;
    --all) SET=all ;;
    --no-verify) VERIFY=0 ;;
    *) echo "Unknown option: $arg (options: --int4, --all, --no-verify)" >&2; exit 2 ;;
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
  case "$f" in
    codec/model.safetensors) url=$CODEC ;;
    LICENSES/reverb-model-card.md) url=$HUB/README.md ;;
    LICENSES/higgs-audio-v2-tokenizer-Reverb-model-card.md) url=$CODEC_CARD ;;
    LICENSES/higgs-audio-v2-tokenizer-LICENSE.txt) url=$BOSON_LICENSE ;;
    LICENSES/meta-llama-3-LICENSE.txt) url=$LLAMA3_LICENSE ;;
    *) url=$HUB/$f ;;
  esac
  [ -s "$out" ] && return
  mkdir -p "$(dirname "$out")"
  echo "  fetch  $f"
  # (A partial file from another address, an older revision's, isn't resumed from this one: as fetch-zonos.sh, L-58;
  # round 40 review, L-459.)
  if [ -f "$out.part" ] && [ "$(cat "$out.part.url" 2>/dev/null)" != "$url" ]; then rm -f "$out.part"; fi
  printf '%s\n' "$url" > "$out.part.url"
  local rc=0
  curl -fsSL --retry 3 --retry-delay 2 -C - -o "$out.part" "$url" || rc=$?
  if [ "$rc" = 33 ]; then rm -f "$out.part"; rc=0; curl -fsSL --retry 3 --retry-delay 2 -o "$out.part" "$url" || rc=$?; fi
  [ "$rc" = 0 ] || { echo "  failed $f (curl exit $rc; run the script again to resume)" >&2; exit 1; }
  mv "$out.part" "$out"; rm -f "$out.part.url"
}

case "$SET" in full) what='fp16 and int8, about 1,050 MB' ;; int4) what='int4, about 370 MB' ;; all) what='every model, about 1,230 MB' ;; esac
echo "Reverb-TTS (revision ${REV:0:8}): $what"
# NOTICE.txt is written only once every file is here and checked: the reader uses the folder only then.
rm -f "$DEST/NOTICE.txt"
bad=0
# (The list read with sed, so a last line without a newline isn't dropped: round 40 review, L-459.)
list=$(sed -n 's|^\([0-9a-f]\{64\}\)  \(reverb/models/.*\)$|\1 \2|p' "$SUMS")
[ -n "$list" ] || { echo "$SUMS lists no files" >&2; exit 1; }
while read -r hash path; do
  f=${path#"$DEST"/}
  case "$f" in
    model/runntime/int4/*) [ "$SET" = full ] && continue ;;
    model/runntime/int8/*|model/safetensors/fp16/*) [ "$SET" = int4 ] && continue ;;
  esac
  get "$f"
  if [ "$VERIFY" = 1 ] && [ "$("${SHA[@]}" "$path" | cut -d' ' -f1)" != "$hash" ]; then
    echo "  BAD    $f (removed)"; rm -f "$path"; bad=1
  fi
done <<LIST
$list
LIST
[ "$bad" = 0 ] || { echo "Some files didn't match their checksums and were removed; run this script again." >&2; exit 1; }
[ "$VERIFY" = 1 ] && echo "All files match their checksums."
cat > "$DEST/NOTICE.txt" <<NOTICE
Self-hosted copies of the files the reader's Reverb voice uses, fetched by fetch-reverb.sh.

Reverb-TTS (reverb/models/model/, voices/)   CC BY-NC 4.0 (non-commercial, with attribution)
  https://huggingface.co/software-mansion/Reverb-TTS (revision $REV)
  (its model card: LICENSES/reverb-model-card.md; the licence: https://creativecommons.org/licenses/by-nc/4.0/)
  Credit: "Reverb-TTS by Software Mansion".

Its audio codec, the Higgs Audio v2 tokenizer (reverb/models/codec/)   Boson Higgs Audio 2 Community License
  https://huggingface.co/software-mansion/higgs-audio-v2-tokenizer-Reverb (revision $CODEC_REV), from
  https://huggingface.co/bosonai/higgs-audio-v2-tokenizer
  The agreement: LICENSES/higgs-audio-v2-tokenizer-LICENSE.txt, with the Meta Llama 3 Community License it takes in:
  LICENSES/meta-llama-3-LICENSE.txt. A site serving these files must also display, on a related web page, user
  interface, about page or documentation: "Built with Higgs Materials licensed from Boson AI USA, Inc., Copyright
  Boson AI USA, Inc., All Rights Reserved and Meta Llama 3 licensed under the Meta Llama 3 Community License,
  Copyright Meta Platforms, Inc., All Rights Reserved"; follow the Llama 3 Acceptable Use Policy
  (https://llama.meta.com/llama3/use-policy); and, past 100,000 annual active users, ask Boson AI for an expanded
  licence.

Notice (as the Boson Higgs Audio 2 Community License requires):
  Meta Llama 3 is licensed under the Meta Llama 3 Community License, Copyright © Meta Platforms, Inc. All Rights Reserved.
  Boson Higgs Audio 2 is licensed under the Boson Community License, Copyright © Boson AI USA, Inc. All Rights Reserved.

The engine (reverb/engine/) bundles MIT and Apache-2.0 code: see reverb/engine/LICENSES.txt.
NOTICE
du -sh "$DEST" | awk '{print "Done: " $1 " in " $2 "/"}'
