#!/usr/bin/env bash
# Download the reader's JavaScript libraries into ./libs/ next to index.html, so the reader loads them from
# this site instead of cdnjs:
#
#   ./fetch-libs.sh            run from anywhere; files go next to this script (or into LIB_FILES' folder:
#                              put a copy of this script there, with checksums/ beside it: it works in its
#                              own folder)
#
# JSZip opens EPUB and comic files; marked renders Markdown; lamejs encodes MP3 audiobooks; CodeMirror is the
# editor's text view (E-21). The reader checks
# every copy against the same pinned hashes (Subresource Integrity), and this script checks them against
# checksums/libs.sha256.
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
LAMEJS=1.2.1     # must match LIBS.lamejs in index.html
CODEMIRROR=5.65.21   # must match CM_VERSION in index.html
GOT=()
DEST=libs
CDNJS=https://cdnjs.cloudflare.com/ajax/libs
JSD=https://cdn.jsdelivr.net/npm
SPDX=https://cdn.jsdelivr.net/gh/spdx/license-list-data@v3.25.0/text   # (pinned licence texts)

command -v curl >/dev/null || { echo "curl is required" >&2; exit 1; }

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

say "Libraries"
get "$CDNJS/jszip/$JSZIP/jszip.min.js"     jszip.min.js
get "$CDNJS/marked/$MARKED/marked.min.js"  marked.min.js
get "$CDNJS/lamejs/$LAMEJS/lame.min.js"    lame.min.js
# CodeMirror 5: the core, the Markdown (GFM) and HTML modes with what they use, search, and list continuation.
for f in codemirror.min.js codemirror.min.css addon/mode/overlay.min.js mode/xml/xml.min.js mode/javascript/javascript.min.js \
    mode/css/css.min.js mode/htmlmixed/htmlmixed.min.js mode/markdown/markdown.min.js mode/gfm/gfm.min.js \
    addon/dialog/dialog.min.js addon/dialog/dialog.min.css addon/search/searchcursor.min.js addon/search/search.min.js \
    addon/edit/continuelist.min.js; do
  get "$CDNJS/codemirror/$CODEMIRROR/$f" "codemirror/$f"
done

say "Licences"
get "$JSD/jszip@$JSZIP/LICENSE.markdown"   LICENSES/jszip.md
get "$JSD/marked@$MARKED/LICENSE.md"       LICENSES/marked.md
get "$JSD/lamejs@$LAMEJS/LICENSE"          LICENSES/lamejs.txt
get "$JSD/codemirror@$CODEMIRROR/LICENSE"  LICENSES/codemirror.txt
get "$SPDX/LGPL-3.0-only.txt"              LICENSES/LGPL-3.0.txt   # (lamejs's licence; the GPL-3.0 text follows it)
[ "$LIST" = 1 ] && exit 0
verify libs
cat > "$DEST/LICENSES/NOTICE.txt" <<NOTICE
Self-hosted copies of the reader's libraries, fetched by fetch-libs.sh.

JSZip $JSZIP (jszip.min.js)    MIT or GPL-3.0 (your choice)   https://stuk.github.io/jszip/
marked $MARKED (marked.min.js) MIT                            https://marked.js.org/
lamejs $LAMEJS (lame.min.js)   LGPL-3.0 (LGPL-3.0.txt)        https://github.com/zhuker/lamejs
                               (a port of LAME, LGPL-2.0 or later; lamejs.txt is its licence FAQ)
CodeMirror $CODEMIRROR (codemirror/)  MIT (codemirror.txt)     https://codemirror.net/5/
NOTICE

echo
du -sh "$DEST" | awk '{print "Done: " $1 " in " $2 "/"}'
