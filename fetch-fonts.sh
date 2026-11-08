#!/usr/bin/env bash
# Download the reader's fonts from Google Fonts into ./fonts/ next to index.html, so the reader loads them
# from this site instead of fonts.googleapis.com and fonts.gstatic.com:
#
#   ./fetch-fonts.sh           run from anywhere; files go next to this script (or into LIB_FILES' folder:
#                              run it there)
#
# It writes fonts/ui.css (the interface fonts: IBM Plex Sans and Mono, and Literata), one CSS file per reading
# font in the font menu (fonts/<id>.css, read from FONTS in index.html), and the WOFF2 files they use under
# fonts/files/. Google changes its font files from time to time, so they can't be pinned in advance:
# instead every file must be a real WOFF2 font, and fonts/SHA256SUMS records each one so later runs can
# check nothing has changed on disk. Delete fonts/ and run it again to update. The fonts are under the SIL
# Open Font License.
set -euo pipefail
cd "$(dirname "$0")"

DEST=fonts
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'   # asks for WOFF2
command -v curl >/dev/null || { echo "curl is required" >&2; exit 1; }
if command -v sha256sum >/dev/null; then SHA=(sha256sum); elif command -v shasum >/dev/null; then SHA=(shasum -a 256)
else echo "sha256sum or shasum is required" >&2; exit 1; fi
mkdir -p "$DEST/files"

# Files already downloaded must still match what was recorded.
if [ -f "$DEST/SHA256SUMS" ]; then
  echo "Checking existing font files"
  bad=0
  while read -r hash path; do
    [ -f "$DEST/$path" ] || continue
    if [ "$("${SHA[@]}" "$DEST/$path" | cut -d' ' -f1)" != "$hash" ]; then echo "  BAD    $path (removed)"; rm -f "$DEST/$path"; bad=1; fi
  done < "$DEST/SHA256SUMS"
  [ "$bad" = 0 ] || echo "  (removed files are downloaded again below)"
fi

# fetch NAME CSS-URL: the stylesheet, its font files, and a local copy of the stylesheet pointing at them.
fetch() {
  local name=$1 url=$2 css font file out
  echo "$name"
  css=$(curl -fsSL --retry 3 -A "$UA" "$url")
  for font in $(printf '%s\n' "$css" | grep -o 'https://fonts\.gstatic\.com/[^)]*' | sort -u); do
    file=files/${font#https://fonts.gstatic.com/s/}
    out=$DEST/$file
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

# Record every font file for later runs.
(cd "$DEST" && find files -type f ! -name '*.part' | sort | while read -r f; do "${SHA[@]}" "$f"; done) > "$DEST/SHA256SUMS"
cat > "$DEST/NOTICE.txt" <<NOTICE
Self-hosted copies of the reader's fonts, fetched from Google Fonts by fetch-fonts.sh.
IBM Plex Sans, IBM Plex Mono, Literata, Source Serif 4, EB Garamond, Crimson Pro and Atkinson Hyperlegible
are licensed under the SIL Open Font License 1.1: https://openfontlicense.org
NOTICE
echo
du -sh "$DEST" | awk '{print "Done: " $1 " in " $2 "/"}'
