#!/usr/bin/env bash
# Download the reader's fonts from Google Fonts into ./fonts/ next to index.html, so the reader loads them
# from this site instead of fonts.googleapis.com and fonts.gstatic.com:
#
#   ./fetch-fonts.sh           run from anywhere; files go next to this script (or into LIB_FILES' folder:
#                              put a copy of this script there, with index.html beside it: it works in
#                              its own folder)
#
# It writes fonts/ui.css (the interface fonts: IBM Plex Sans and Mono, and Literata), one CSS file per reading
# font in the font menu (fonts/<id>.css, read from FONTS in index.html), and the WOFF2 files they use under
# fonts/files/. Google changes its font files from time to time, so they can't be pinned in advance:
# instead every file must be a real WOFF2 font, and fonts/SHA256SUMS records each one so later runs can
# check nothing has changed on disk. Delete fonts/ and run it again to update. The fonts are under the SIL
# Open Font License.
#
#   --strict   check against fonts/SHA256SUMS and fail instead of fetching again: a changed or missing file
#              on disk, or a font file Google now serves that isn't in the list, stops the run (nothing is
#              replaced, and the list isn't rewritten). Needs the list: run once without --strict first.
set -euo pipefail
cd "$(dirname "$0")"

STRICT=0
for arg in "$@"; do
  case "$arg" in
    --strict) STRICT=1 ;;
    *) echo "Unknown option: $arg (options: --strict)" >&2; exit 2 ;;
  esac
done

DEST=fonts
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'   # asks for WOFF2
command -v curl >/dev/null || { echo "curl is required" >&2; exit 1; }
if command -v sha256sum >/dev/null; then SHA=(sha256sum); elif command -v shasum >/dev/null; then SHA=(shasum -a 256)
else echo "sha256sum or shasum is required" >&2; exit 1; fi
mkdir -p "$DEST/files"

# Files already downloaded must still match what was recorded.
if [ "$STRICT" = 1 ] && [ ! -s "$DEST/SHA256SUMS" ]; then
  echo "No fonts/SHA256SUMS to check against (--strict): run ./fetch-fonts.sh once without it first" >&2; exit 1
fi
if [ -f "$DEST/SHA256SUMS" ]; then
  echo "Checking existing font files"
  bad=0
  while read -r hash path; do
    if [ ! -f "$DEST/$path" ]; then
      if [ "$STRICT" = 1 ]; then echo "  MISSING $path" >&2; bad=1; fi
      continue
    fi
    if [ "$("${SHA[@]}" "$DEST/$path" | cut -d' ' -f1)" != "$hash" ]; then
      if [ "$STRICT" = 1 ]; then echo "  BAD    $path" >&2; bad=1; continue; fi
      echo "  BAD    $path (removed)"; rm -f "$DEST/$path"; bad=1
    fi
  done < "$DEST/SHA256SUMS"
  if [ "$bad" = 1 ] && [ "$STRICT" = 1 ]; then echo "Font files changed or missing on disk (--strict: nothing was replaced)" >&2; exit 1; fi
  [ "$bad" = 0 ] || echo "  (removed files are downloaded again below)"
fi
KNOWN=""
[ "$STRICT" = 1 ] && [ -f "$DEST/SHA256SUMS" ] && KNOWN=$(cut -d' ' -f3- "$DEST/SHA256SUMS")

# fetch NAME CSS-URL: the stylesheet, its font files, and a local copy of the stylesheet pointing at them.
fetch() {
  local name=$1 url=$2 css font file out
  echo "$name"
  css=$(curl -fsSL --retry 3 -A "$UA" "$url")
  for font in $(printf '%s\n' "$css" | grep -o 'https://fonts\.gstatic\.com/[^)]*' | sort -u); do
    file=files/${font#https://fonts.gstatic.com/s/}
    case "/$file/" in */../*|*/./*) echo "  $font: a path that leaves fonts/files/ (refused)" >&2; exit 1 ;; esac
    out=$DEST/$file
    if [ -n "$KNOWN" ] && ! printf '%s\n' "$KNOWN" | grep -qxF "$file"; then
      echo "  $file isn't in fonts/SHA256SUMS: Google serves a different file now (--strict: stopping)" >&2; exit 1
    fi
    if [ ! -s "$out" ]; then
      mkdir -p "$(dirname "$out")"
      curl -fsSL --retry 3 -o "$out.part" "$font"
      if [ "$(head -c 4 "$out.part")" != "wOF2" ]; then rm -f "$out.part"; echo "  $font isn't a WOFF2 font" >&2; exit 1; fi
      mv "$out.part" "$out"
      echo "  fetch  $file"
    fi
    css=${css//"$font"/"$file"}
  done
  printf '%s\n' "/* $name: from Google Fonts by fetch-fonts.sh (SIL Open Font License) */" "$css" > "$DEST/$name.css"
}

echo "Interface fonts"
ui=$(grep -o "const UI_FONTS = '[^']*'" index.html | sed "s/const UI_FONTS = '//; s/'\$//")
[ -n "$ui" ] || { echo "Couldn't find UI_FONTS in index.html" >&2; exit 1; }
fetch ui "$ui"

echo "Reading fonts"
# FONTS entries with a Google Fonts family: { id: 'literata', ..., css: 'Literata:ital,...', ... }
found=0
# (Ids and family specs contain no spaces, so a space separates them: "\t" in a sed replacement is GNU-only.)
while read -r id spec; do
  fetch "$id" "https://fonts.googleapis.com/css2?family=$spec&display=swap"
  found=1
done < <(grep -o "{ id: '[a-z0-9-]*'[^}]*css: '[^']*'" index.html | sed -E "s/^\{ id: '([^']*)'.*css: '([^']*)'.*/\1 \2/")
[ "$found" = 1 ] || { echo "Couldn't find the FONTS list in index.html" >&2; exit 1; }

# Record every font file for later runs (not with --strict: the list is what was checked against).
[ "$STRICT" = 1 ] || (cd "$DEST" && find files -type f ! -name '*.part' | sort | while read -r f; do "${SHA[@]}" "$f"; done) > "$DEST/SHA256SUMS"
cat > "$DEST/NOTICE.txt" <<NOTICE
Self-hosted copies of the reader's fonts, fetched from Google Fonts by fetch-fonts.sh.
IBM Plex Sans, IBM Plex Mono, Literata, Source Serif 4, EB Garamond, Crimson Pro, Atkinson Hyperlegible,
Gentium Book Plus, Alegreya and Lexend
are licensed under the SIL Open Font License 1.1: https://openfontlicense.org
NOTICE
echo
du -sh "$DEST" | awk '{print "Done: " $1 " in " $2 "/"}'
