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
# It also fetches the fonts a site names in ADDITIONAL_FONTS, from ./reader-config.json (next to this script) and
# from each reader-config.json given with --config, as fonts/g-<name>.css: the reader then loads them from here
# instead of from Google Fonts. (Reading the configs needs python3.)
#
#   --strict       check against fonts/SHA256SUMS and fail instead of fetching again: a changed or missing file
#                  on disk, or a font file Google now serves that isn't in the list, stops the run (nothing is
#                  replaced, and the list isn't rewritten). Needs the list: run once without --strict first.
#   --config FILE  another reader-config.json whose ADDITIONAL_FONTS to fetch (as many as you like)
#   --list         print the reading fonts it would fetch (their ids and addresses) and stop: nothing is fetched
set -euo pipefail

STRICT=0 LIST=0
CONFIGS=()
# (Options first, from the folder it was run in: a --config path is as typed there: round 26 review, L-349.)
while [ $# -gt 0 ]; do
  case "$1" in
    --strict) STRICT=1 ;;
    --list) LIST=1 ;;
    --config) [ $# -ge 2 ] || { echo "--config needs a file" >&2; exit 2; }; [ -f "$2" ] || { echo "No such file: $2" >&2; exit 2; }
              case "$2" in /*) CONFIGS+=("$2") ;; *) CONFIGS+=("$PWD/$2") ;; esac; shift ;;
    *) echo "Unknown option: $1 (options: --strict, --config FILE, --list)" >&2; exit 2 ;;
  esac
  shift
done
cd "$(dirname "$0")"
[ -f reader-config.json ] && CONFIGS=("$PWD/reader-config.json" ${CONFIGS[@]+"${CONFIGS[@]}"})

# The reading fonts: "id family-spec" lines. FONTS entries with a Google Fonts family ({ id: 'literata', ...,
# css: 'Literata:ital,...', ... }), then ADDITIONAL_FONTS from the configs, read by the same rules as the reader
# (a family name as on fonts.google.com, optionally with its styles: "Lexend:wght@400;700"; id g-<name>).
# (Ids and family specs contain no spaces, so a space separates them: "\t" in a sed replacement is GNU-only.)
menu_fonts() { grep -o "{ id: '[a-z0-9-]*'[^}]*css: '[^']*'" index.html | sed -E "s/^\{ id: '([^']*)'.*css: '([^']*)'.*/\1 \2/"; }
reading_fonts() {
  menu_fonts
  [ ${#CONFIGS[@]} -gt 0 ] || return 0
  command -v python3 >/dev/null || { echo "python3 is needed to read ADDITIONAL_FONTS from ${CONFIGS[*]} (skipped)" >&2; return 0; }
  # (The menu's own families, which the reader leaves out of ADDITIONAL_FONTS, are left out here too: L-356.)
  MENU=$(menu_fonts | cut -d' ' -f2 | sed 's/:.*//; s/+/ /g') python3 - "${CONFIGS[@]}" <<'PY'
import json, os, re, sys
menu = {n.strip().lower() for n in os.environ.get("MENU", "").splitlines() if n.strip()}
found = {}   # slug -> (name, styles, where)
for path in sys.argv[1:]:
    try:
        v = json.load(open(path, encoding="utf-8")).get("ADDITIONAL_FONTS")
    except Exception as e:
        print(f"{path}: not read ({e})", file=sys.stderr); continue
    if not v: continue
    items = []
    for part in (v if isinstance(v, list) else str(v).split("|")):   # (a list's entries each stand alone, as in the reader)
        start = len(items)
        for tk in (s.strip() for s in str(part).split(",")):
            if not tk: continue
            if len(items) > start and ":" in items[-1] and re.fullmatch(r"[a-z]+(@[0-9.;]*)?|[0-9.;]+", tk): items[-1] += "," + tk
            else: items.append(tk)
    for s in items:
        m = re.fullmatch(r"([A-Za-z0-9][A-Za-z0-9 ]{0,59}?)\s*(?::\s*([a-z]+(?:,[a-z]+)*@[0-9.,;]+))?", s)
        if not m:
            print(f'{path}: "{s}" isn\'t a Google Fonts family name (skipped)', file=sys.stderr); continue
        name = re.sub(" +", " ", m.group(1)); slug = "g-" + name.lower().replace(" ", "-"); styles = m.group(2) or ""
        if name.lower() in menu: continue
        if slug in found:
            # (One family named twice: the styles given win over none; two different sets, the first, said so.)
            had = found[slug]
            if styles and not had[1]: found[slug] = (name, styles, path)
            elif styles and styles != had[1]: print(f'{path}: "{name}" is also in {had[2]} with other styles ({had[1]}): those are fetched; name the same styles in both', file=sys.stderr)
            continue
        found[slug] = (name, styles, path)
for slug, (name, styles, _) in found.items():
    print(slug, name.replace(" ", "+") + (":" + styles if styles else ""))
PY
}
if [ "$LIST" = 1 ]; then
  reading_fonts | while read -r id spec; do echo "$id https://fonts.googleapis.com/css2?family=$spec&display=swap"; done
  exit 0
fi

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

# fetch NAME CSS-URL [optional]: the stylesheet, its font files, and a local copy of the stylesheet pointing at them.
# An optional one (a family a config names) that Google doesn't give is skipped, with a warning, and the run goes on
# (L-356).
SKIPPED=""
fetch() {
  local name=$1 url=$2 optional=${3:-} css font file out
  echo "$name"
  if ! css=$(curl -fsSL --retry 3 -A "$UA" "$url"); then
    [ -n "$optional" ] || { echo "  Couldn't fetch $url" >&2; exit 1; }
    echo "  Couldn't fetch $url: is the family name as written on fonts.google.com? (skipped)" >&2
    SKIPPED="$SKIPPED $name"; return 0
  fi
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
found=0
while read -r id spec; do
  case "$id" in g-*) fetch "$id" "https://fonts.googleapis.com/css2?family=$spec&display=swap" optional ;;
                *) fetch "$id" "https://fonts.googleapis.com/css2?family=$spec&display=swap" ;; esac
  found=1
done < <(reading_fonts)
[ "$found" = 1 ] || { echo "Couldn't find the FONTS list in index.html" >&2; exit 1; }

# Record every font file for later runs (not with --strict: the list is what was checked against).
[ "$STRICT" = 1 ] || (cd "$DEST" && find files -type f ! -name '*.part' | sort | while read -r f; do "${SHA[@]}" "$f"; done) > "$DEST/SHA256SUMS"
cat > "$DEST/NOTICE.txt" <<NOTICE
Self-hosted copies of the reader's fonts, fetched from Google Fonts by fetch-fonts.sh.
IBM Plex Sans, IBM Plex Mono, Literata, Source Serif 4, EB Garamond, Crimson Pro, Atkinson Hyperlegible,
Gentium Book Plus, Alegreya and Lexend
are licensed under the SIL Open Font License 1.1: https://openfontlicense.org
Fonts named in ADDITIONAL_FONTS (fonts/g-*.css) are under the licences Google Fonts lists for them (most the
SIL Open Font License 1.1, some the Apache License 2.0 or the Ubuntu Font Licence).
NOTICE
echo
du -sh "$DEST" | awk '{print "Done: " $1 " in " $2 "/"}'
if [ -n "$SKIPPED" ]; then echo "Not fetched (see above):$SKIPPED" >&2; exit 1; fi
