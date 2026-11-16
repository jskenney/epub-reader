#!/usr/bin/env bash
# Download the models the ZONOS3-Mini natural voice needs into ./zonos/models/ next to index.html, so the reader
# loads them from this site instead of huggingface.co (REVIEW.md E-46).
#
#   ./fetch-zonos.sh               the backbone, the audio decoder, the steering file, the alignment heads and the
#                                  built-in voices (about 900 MB): everything reading aloud uses
#
# The engine itself (zonos/engine/: engine.js and its two workers) is part of the reader, built from ZONOS3-Mini's
# source by tools/build-zonos-engine.sh. It must be on the same site as index.html (browsers start workers only from
# the page's own site), so it isn't fetched from anywhere.
#
# Safe to re-run: finished files are skipped and interrupted downloads resume. Every file is checked against
# checksums/zonos.sha256; any that don't match are removed (run it again).
set -euo pipefail
cd "$(dirname "$0")"

REPO=Zyphra/ZONOS3-Mini
REV=d2d142a86b1e6aeb4252679673c86ecd86177bf8           # must match ZONOS.model in index.html
DIRS="backbone zac companions laci voices"              # web/ folders reading aloud uses (not cloning or editing)
DEST=zonos/models
HF=https://huggingface.co/$REPO/resolve/$REV/web
GOT=()

command -v curl >/dev/null || { echo "curl is required" >&2; exit 1; }
command -v python3 >/dev/null || { echo "python3 is required" >&2; exit 1; }

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

say() { [ "$LIST" = 1 ] || echo "$@"; }
get() {   # get URL PATH-UNDER-DEST
  local url=$1 out=$DEST/$2
  GOT+=("$out")   # (every file this script downloads must have a pinned checksum: verify)
  if [ "$LIST" = 1 ]; then printf '%s\t%s\n' "$url" "$out"; return; fi
  if [ -s "$out" ]; then return; fi
  mkdir -p "$(dirname "$out")"
  echo "  fetch  $2"
  # A partial download is resumed only if it came from the same address, and from the beginning if the server
  # can't resume (curl's exit code 33).
  if [ -f "$out.part" ] && [ "$(cat "$out.part.url" 2>/dev/null)" != "$url" ]; then rm -f "$out.part"; fi
  printf '%s\n' "$url" > "$out.part.url"
  local rc=0
  curl -fsSL --retry 3 --retry-delay 2 -C - -o "$out.part" "$url" || rc=$?
  if [ "$rc" = 33 ]; then rm -f "$out.part"; rc=0; curl -fsSL --retry 3 --retry-delay 2 -o "$out.part" "$url" || rc=$?; fi
  [ "$rc" = 0 ] || { echo "  failed $2 (curl exit $rc; run the script again to resume)" >&2; exit 1; }
  mv "$out.part" "$out"; rm -f "$out.part.url"
}

# Check every downloaded file against the pinned SHA-256 list (committed with this script). Files that don't match
# are removed, so running the script again downloads them afresh.
verify() {
  local sums=checksums/zonos.sha256 bad=0 unpinned=0 hash path tool
  if [ "$VERIFY" = 0 ]; then echo "Checksums not checked (--no-verify)."; return; fi
  if command -v sha256sum >/dev/null; then tool=(sha256sum); elif command -v shasum >/dev/null; then tool=(shasum -a 256)
  else echo "Neither sha256sum nor shasum is installed, so the downloads can't be checked; run again with --no-verify to skip the check." >&2; exit 1; fi
  echo "Checking files against $sums"
  while read -r hash path; do
    [ -f "$path" ] || continue
    if [ "$("${tool[@]}" "$path" | cut -d' ' -f1)" != "$hash" ]; then echo "  BAD    $path (removed)"; rm -f "$path"; bad=1; fi
  done < "$sums"
  for path in "${GOT[@]}"; do
    awk -v p="$path" 'substr($0, 67) == p { found = 1 } END { exit !found }' "$sums" && continue
    echo "  UNPINNED $path: not in $sums, so it can't be checked"; unpinned=1
  done
  if [ "$bad" = 1 ]; then echo "Some files didn't match their checksums and were removed; run this script again." >&2; exit 1; fi
  if [ "$unpinned" = 1 ]; then echo "Some files have no pinned checksum: update $sums (python3 tools/make-checksums.py zonos), or run with --no-verify." >&2; exit 1; fi
  echo "All files match their checksums."
}

# The files: with --list, as the Hub lists them at the pinned revision (for tools/make-checksums.py); otherwise,
# those named in the pinned checksum list, so nothing unlisted is downloaded.
if [ "$LIST" = 1 ]; then
  files=$(curl -fsS "https://huggingface.co/api/models/$REPO/tree/$REV/web?recursive=true" | python3 -c '
import json, sys
dirs = sys.argv[1].split()
for f in json.load(sys.stdin):
    parts = f["path"].split("/")
    if f["type"] == "file" and len(parts) > 2 and parts[1] in dirs:
        print("/".join(parts[1:]))' "$DIRS")
else
  [ -f checksums/zonos.sha256 ] || { echo "Missing checksums/zonos.sha256" >&2; exit 1; }
  files=$(sed -n "s|^[0-9a-f]\{64\}  $DEST/||p" checksums/zonos.sha256)
fi

say "ZONOS3-Mini models (revision ${REV:0:8}, about 900 MB)"
# NOTICE.txt is written only once every file is here and checked: the reader uses the folder only then, so a run
# that stops partway (or finds a bad file) leaves the reader on Hugging Face's copy.
[ "$LIST" = 1 ] || rm -f "$DEST/NOTICE.txt"
while IFS= read -r f; do
  [ -n "$f" ] || continue
  get "$HF/$(python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1]))' "$f")" "$f"
done <<< "$files"
[ "$LIST" = 1 ] && exit 0
verify
mkdir -p "$DEST"
cat > "$DEST/NOTICE.txt" <<NOTICE
Self-hosted copies of the models the reader's ZONOS3-Mini voice uses, fetched by fetch-zonos.sh.

ZONOS3-Mini web export (zonos/models/)   Apache-2.0   https://huggingface.co/$REPO (revision $REV)
The engine (zonos/engine/) is MIT: see zonos/engine/LICENSE and NOTICE.
NOTICE
echo
du -sh "$DEST" | awk '{print "Done: " $1 " in " $2 "/"}'
