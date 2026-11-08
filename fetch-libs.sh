#!/usr/bin/env bash
# Download the reader's JavaScript libraries into ./libs/ next to index.html, so the reader loads them from
# this site instead of cdnjs:
#
#   ./fetch-libs.sh            run from anywhere; files go next to this script (or into LIB_FILES' folder:
#                              run it there)
#
# JSZip opens EPUB and comic files; marked renders Markdown. The reader checks both copies against the same
# pinned hashes (Subresource Integrity), and this script checks them against checksums/libs.sha256.
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

JSZIP=3.10.1     # must match LIBS.jszip in index.html
MARKED=15.0.12   # must match MARKED_URL in index.html
DEST=libs
CDNJS=https://cdnjs.cloudflare.com/ajax/libs
JSD=https://cdn.jsdelivr.net/npm

command -v curl >/dev/null || { echo "curl is required" >&2; exit 1; }

say() { [ "$LIST" = 1 ] || echo "$@"; }
get() {   # get URL PATH-UNDER-DEST
  local url=$1 out=$DEST/$2
  if [ "$LIST" = 1 ]; then printf '%s	%s
' "$url" "$out"; return; fi
  if [ -s "$out" ]; then echo "  have   $2"; return; fi
  mkdir -p "$(dirname "$out")"
  echo "  fetch  $2"
  curl -fL --retry 3 --retry-delay 2 -C - --progress-bar -o "$out.part" "$url"
  mv "$out.part" "$out"
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
  done < <(find "$DEST" -type f ! -name NOTICE.txt ! -name '*.part' | sort)
  if [ "$bad" = 1 ]; then echo "Some files didn't match their checksums and were removed; run this script again." >&2; exit 1; fi
  echo "All files match their checksums."
}

say "Libraries"
get "$CDNJS/jszip/$JSZIP/jszip.min.js"     jszip.min.js
get "$CDNJS/marked/$MARKED/marked.min.js"  marked.min.js

say "Licences"
get "$JSD/jszip@$JSZIP/LICENSE.markdown"   LICENSES/jszip.md
get "$JSD/marked@$MARKED/LICENSE.md"       LICENSES/marked.md
[ "$LIST" = 1 ] && exit 0
verify libs
cat > "$DEST/LICENSES/NOTICE.txt" <<NOTICE
Self-hosted copies of the reader's libraries, fetched by fetch-libs.sh.

JSZip $JSZIP (jszip.min.js)    MIT or GPL-3.0 (your choice)   https://stuk.github.io/jszip/
marked $MARKED (marked.min.js) MIT                            https://marked.js.org/
NOTICE

echo
du -sh "$DEST" | awk '{print "Done: " $1 " in " $2 "/"}'
