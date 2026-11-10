# Spine Reader

A browser-based EPUB reader.

Everything is in one file, `index.html`. Open it, then
click the folder button (Open a book) at the right of the top bar, or drop a
file onto the page. Without a `?book=` link it opens `default.epub` from the
same folder as `index.html` if there is one, or else `default.md` (each must
really be there: a "not found" page served in its place is ignored, even by a
server that answers every missing file with a 200 page), and otherwise a built-in sample
book.

Everything it needs can be served from your own site (see
[Self-hosting](#self-hosting-the-libraries-and-fonts)), and one `index.html`
can be linked into several folders, each with its own default book and
[settings](#per-folder-settings-reader-configjson).

## Other formats

Besides EPUB, the reader opens **plain text** (`.txt`), **Markdown** (`.md`,
`.markdown`) and **HTML** (`.html`, `.htm`) files, by the folder button, drag and
drop, or a `?book=` link. Each is converted to HTML and given a contents
list built from its headings. It reads as one continuous document (split
only past about 200,000 characters), and the contents entries jump within
it; everything else (pages, fonts, read-aloud,
saved position) works as for EPUBs.

- **Plain text:** hard-wrapped lines are joined into paragraphs, while
  short-line passages such as verse keep their line breaks. Lines like
  "CHAPTER IV", "Book One" or short all-caps titles become chapter headings;
  a run of them is treated as a contents list. Project Gutenberg's licence
  header and footer are removed and its title, author and language are
  used. `_word_` becomes italic. Files that aren't UTF-8 are read as
  Windows-1252.
- **Markdown:** rendered with [marked](https://marked.js.org/) (GitHub
  flavour), loaded only when a Markdown file is opened: from `libs/` when
  self-hosted, otherwise from cdnjs. YAML front
  matter `title`, `author` and `lang` are used. Links to headings
  (`[see](#a-heading)`) work.
- **HTML:** the page's title, `meta name="author"` and `lang` are used, and
  its scripts are removed. Opened by a `?book=` link, its images,
  stylesheets and relative links load from its folder on the server; an
  uploaded single file can't bring those along.

**Fixed-layout EPUBs** (pre-paginated: picture books, comics and magazines
made as EPUB) are shown a page at a time, each at the size the book gives it
(its `viewport`, an SVG page's `viewBox`, or the book's
`rendition:viewport`), scaled to fit the screen, with the book's own styles
and positions; the scroll layout fits each page to the width. Their text can
still be searched and read aloud. A page whose size isn't given, or marked
`rendition:layout-reflowable`, is reflowed like any other.

**Comic books** (`.cbz`, a ZIP of page images) open too. Pages are shown in
name order (page2 before page10), each as large as fits: a two-page spread
in the two-column layout, one page in the single-column layout, and a
continuous strip in the scroll layout. A `ComicInfo.xml` supplies the
title, series and number, writer and artist, summary, year and language;
the first page is the cover. Archives that keep chapters in folders get a
contents entry per folder. A ZIP with images and no EPUB container is
opened as a comic whatever its name. Right-to-left manga (`ComicInfo.xml`'s
`<Manga>YesAndRightToLeft</Manga>`) is read right to left: in the two-column
layout each spread shows its later page on the left, and the left arrow key
(or a swipe to the right) goes on. Page Down, Next and the single-column and
scroll layouts keep the pages in order.

## Opening a book from the address

When `index.html` is served from a web server, a `book` query parameter opens
a book from the same site on page load:

- `index.html?book=books/moby-dick.epub`: reads the `.epub` in the browser.
  When the server answers range requests (nginx, Caddy and most others do),
  only the parts needed are fetched: the archive's directory, then each
  chapter, picture or audio clip as it's shown. A large narrated book or
  comic therefore isn't downloaded or held in memory whole. Otherwise the
  file is downloaded whole, as before. Uploaded files are read in place the
  same way. Each file is checked against the archive's checksum, and if the
  book is replaced on the server (or on disk) while it's open, the reader
  says so instead of mixing the two versions.
- `index.html?book=books/notes.md` (or `.txt`, `.html`): opens that document
- `index.html?book=books/issue-3.cbz`: opens a comic book
- `index.html?book=books/moby-dick/`: reads an already-extracted EPUB folder
  (the folder that contains `META-INF/` and `mimetype`); files are fetched
  one at a time as they're needed. The trailing slash is optional.

A relative path is looked up in two places, in this order:

1. relative to `index.html` (`?book=books/moby-dick/` → `books/moby-dick/`)
2. under `/bookshelf/` at the root of the site
   (`?book=books/moby-dick/` → `/bookshelf/books/moby-dick/`)

The first location that has the book wins. A path that starts with `/`
(`?book=/library/x.epub`) is used as-is. To change the root folder, edit the
`BOOKSHELF` constant (see [Settings](#settings)). Books on other sites are refused. If the book
can't be loaded, the reader shows why and opens the folder's default book
(`default.epub`, else `default.md`, else the sample book).
This needs a real web server (for example `npx vite` or
`python3 -m http.server`); browsers block these requests on `file://` pages.

## Features

- Search the whole book from the box above the contents (/ or Ctrl+F / ⌘F).
  Matches ignore case, accents and curly versus straight quotes, and are
  listed under their chapter or heading with some context; click one, or
  press Enter / Shift+Enter (or the arrows) to step through them. The
  current match is highlighted strongly, other matches on the page lightly.
  Esc clears the search and brings the contents back.
- Handles EPUB 3 contents pages (`nav.xhtml`) and EPUB 2 `toc.ncx`
- Shows chapters in a sandboxed iframe, with the book's images, CSS and fonts
  loaded from inside the archive. The book's scripts are removed.
- Three layouts, switched with the layout button or L and remembered:
  - **Two columns** (the default): text flows into two columns per page (one
    on narrow screens). Next / Previous, the arrow keys, PageUp / PageDown,
    the mouse wheel or a swipe turn the page; Next on a chapter's last page
    opens the next chapter.
  - **One column**: one column per page, kept to a comfortable line length.
  - **Scrolling**: the chapter is one continuous column that scrolls
    normally. Next / Previous and PageUp / PageDown move a screen at a time
    and continue into the next or previous chapter at the ends.
  Images are scaled to fit the page. Switching layouts keeps your place.
- Text width (the narrower / wider buttons): Narrow, Medium (default), Wide
  or Full. It caps how wide the text gets, about 32 / 38 / 50 rem for one
  column and scrolling and 1000 / 1240 / 1600 px for both columns together,
  with anything beyond that becoming side margin; Full uses the whole page
  with minimal margins. Hidden on phones, where the screen is narrower than
  every cap.
  When reading aloud in scrolling mode, the page scrolls to keep the spoken
  text in view; scrolling away yourself shows "Back to reading".
- Information panel in the sidebar: publisher, publication date, ISBN,
  series and number (EPUB 3 collections or Calibre metadata), subjects,
  language, fixed or reflowable layout, reading direction, and package
  details. Fields the book doesn't provide are left out. A collapsible
  Description under the title shows the book's blurb as plain text.
- Read aloud with the device's voices (the speaker button, or R). Reading
  starts at your text selection if there is one, otherwise at the first word
  on the current page; while the read-aloud bar is open, clicking any word
  jumps there. The current sentence and word are highlighted and pages turn
  by themselves, continuing into the next chapter. The bar has previous /
  next sentence, play/pause (Space), speed 0.5×–2× ([ and ]), and a voice
  list filtered to the book's language. Paging away by hand while listening
  shows a "Back to reading" button. Speed and voice are remembered.
- Publisher narration (EPUB 3 Media Overlays): when a book includes recorded
  audio synced to its text, Read aloud plays that instead of a synthetic
  voice. The narrated passage is highlighted (and gets the book's own
  active-class styling), pages turn with the audio, reading continues into
  the next chapter, and the same controls apply: click or select to start
  anywhere, Space to pause, previous / next clip, and speed (instant, with
  pitch preserved). Switch between "Publisher narration" and "Device"
  in the read-aloud bar. Narrator and narration length appear under
  Information.
- Natural voice (Kokoro): choose "Kokoro" in the read-aloud
  bar to use the Kokoro-82M model, running entirely in the browser through
  [kokoro-js](https://www.npmjs.com/package/kokoro-js) in a Web Worker.
  Nothing downloads until you press Download: the full-precision model
  (about 330 MB), cached by the browser after the first time. It runs on
  WebGPU where available (fast; recent Chrome or Edge) and otherwise on the
  CPU. It has 28 English voices (American and British), listed best first
  with kokoro-js's quality grade (A for Heart down to F+ for Adam), and
  uses the speed setting when generating.
  Sentences are prepared ahead of time; the highlighted word is estimated
  from playback position, since Kokoro doesn't report word timings. It is
  English-only, so books in other languages use the device voice. On the
  CPU, generation can be slower than real time, which causes pauses between
  sentences. Files load from `./kokoro/` when you self-host them (see below),
  otherwise from cdn.jsdelivr.net and huggingface.co.
- Natural voice (Pocket TTS, "Pocket" in the read-aloud bar): Kyutai's Pocket TTS through
  [pocket-tts-js](https://www.npmjs.com/package/pocket-tts-js), running on
  the CPU (WebAssembly) in a Web Worker. Unlike Kokoro it reads English,
  German, Italian, Portuguese and Spanish books, with 8 built-in
  voices per language. Each language is a one-time download of the
  full-precision models (about 430 MB) after pressing
  Download. It has no speed control of
  its own, so the speed setting changes playback instantly with pitch
  preserved. The model is CC BY 4.0 (Kyutai).
- Server voice ("Server" in the read-aloud bar): Breeze TTS 2 running on your own NVIDIA GPU behind the same
  website (English and Chinese). It appears in the read-aloud bar when
  `/tts/health` on the site root answers; voices are reference clips listed
  in `/tts-voices/voices.json`, created and managed in the server's voice
  studio at `/tts-studio/`. Setup, Docker Compose,
  reverse-proxy examples and the voice script are in
  [jskenney/epub-reader-tts-server](https://github.com/jskenney/epub-reader-tts-server).
  The model and its output are for non-commercial use.
- Natural voices read a whole paragraph at a time where they can (up to
  about 350 characters for Kokoro and 600 for Pocket TTS), which phrases
  better than sentence by sentence; the sentence and word highlights move
  through the paragraph as it plays. Device voices are listed with the
  vendors' higher tiers (Natural, Neural, Premium, Enhanced, Online) first.
  When you start reading or jump to a new spot, the first piece is a single
  sentence so speech begins quickly, and work for the old position is
  cancelled. The server voice and Pocket TTS play audio as it arrives at
  1x speed; at other speeds the whole piece is made first so the pitch
  stays natural.
  While one passage plays, the next ones are made in the background until
  about two minutes of audio is ready (`LOOKAHEAD_SEC`), carrying on into
  the next chapter so chapter breaks don't pause.
- Finished natural-voice audio is saved in the browser (IndexedDB), so
  rereading, reloading or reopening a book plays at once without making it
  again. The oldest passages are dropped past 500 MB (`SAVED_AUDIO_MB`);
  the stack button in the read-aloud bar shows how much is saved and clears
  it.
  The natural voices use full-precision models by default; set
  `FULL_PRECISION = false` in `index.html` for the smaller 8-bit models.
- Lock-screen, headphone and media-key controls while reading aloud
  (play/pause, next and previous sentence), showing the chapter, book,
  author and cover. Browsers only offer these to a page playing audio, so a
  silent clip plays alongside read-aloud. (iPhones and iPads stop device
  voices when the screen locks, whatever the page does.)
- Audiobook export: the headphones button in the read-aloud bar makes
  audiobooks with the natural voice chosen (Kokoro, Pocket or Server; the
  device voice can't be recorded). Tick the chapters you want (All / None,
  shift-click for a range; the cover and contents pages start unticked), then
  choose one file with a chapter marker at each, or a file per chapter
  (`01 - Title.m4b`, with track numbers, so audiobook apps group them). Three
  formats, each with chapters, title, author, track and cover; those the
  browser can't make are greyed out, with the reason:
  - `.m4b` (AAC, the default): plays in Apple Books, most audiobook apps and
    VLC. It needs the browser's AAC encoder (WebCodecs): Chrome and Edge on
    Windows and macOS, and Safari, have one; Chrome on Linux and Firefox
    don't. 64 kbps (about 29 MB an hour; on Windows 96 kbps, as its encoder
    takes no less).
  - `.opus` (Opus in Ogg): VLC, mpv, foobar2000 and several Android
    audiobook apps play it, Apple's apps don't. Every Chromium can make it,
    Linux included. 32 kbps (about 14 MB an hour), which suits speech.
  - `.mp3`: plays almost everywhere, though not every player shows the
    chapters. Encoded in the page by lamejs (LGPL; self-hosted by
    `fetch-libs.sh`, or from cdnjs, when the dialog opens), so it works in
    any browser. 64 kbps. Its tags are ID3v2.3, which Windows reads best.

  AAC and Opus use WebCodecs, which browsers only offer to secure pages: serve
  the reader over `https://` (or open it as `localhost`). The choice is
  remembered. Chrome and Edge ask where to save and write as they go; other
  browsers download each file when it's finished (with a "Download all as a
  ZIP" button for a file per chapter). Passages made in an earlier export, or
  already read aloud (with Kokoro, only those heard at 1×, as its speed is part
  of the audio), are reused from the saved audio, so a cancelled export picks up
  quickly. If the voice goes away (a server restarting, say), the export waits
  for it for up to five minutes; a sentence the voice can't say is left silent.
  Reading aloud waits while an export runs, and the dialog can be closed
  meanwhile (the button shows it is still working).
- Sleep timer in the read-aloud bar (off unless `SLEEP_TIMER` is turned on):
  stop after 15, 30, 45, 60 or 90 minutes
  of listening, or at the end of the chapter. It counts down only while
  reading aloud plays, and stops at the end of the sentence or passage being
  read; play carries on from there. The note saying why it stopped stays
  until you play again.
- Time left, in the footer (off unless `TIME_LEFT` is turned on): "12 min
  left in chapter · 3 h 10 min in book",
  from your reading speed (learned from how fast you turn pages, starting at
  about 200 words a minute) or, while reading aloud, from the voice's actual
  pace. Phones show the chapter part only.
- Books can't contact other sites (`ALLOW_REMOTE_CONTENT`, off by default),
  in two layers:
  - **Cleaning:** each page is cleaned as the browser will read it. That
    removes references to other sites in images, media, stylesheets and
    fonts, plus autoplay, link pings, `<link>`, `<iframe>`, `<base>` and
    `<meta>` refresh, and references to files the book doesn't contain.
  - **A Content-Security-Policy on every book page:** the browser itself
    refuses anything that isn't part of the book (or the reader's fonts),
    whatever the cleaning missed.

  Web links still open in a new tab (`ALLOW_EXTERNAL_LINKS`), SVG links and
  image maps work like other links, and nothing in a book can navigate the
  page away.
- Press C (or the Contents button) to collapse or expand the contents sidebar
- Press I to show or hide the book's information (publisher, language,
  format, file…) below the contents; it is hidden when the page opens
- Full-screen reading: the corner button or F hides the top bar, sidebar and
  footer (and uses the browser's full screen where allowed). Esc, F, or the
  Exit button that appears when you move the mouse brings them back.
- Text size (A− / A+) and line spacing (the tighter / looser line buttons,
  1.00–2.60) can be adjusted from the top bar
- Reading font picker (the Aa button): keep the book's own font, or override
  it with Literata, Source Serif 4, EB Garamond, Crimson Pro, Atkinson
  Hyperlegible, Georgia or your system sans-serif. Code keeps its monospace.
  Add more in the `FONTS` list in `index.html`.
- The browser tab shows the book's cover as its icon (EPUB 3 `cover-image`,
  EPUB 2 `<meta name="cover">`, an image named "cover", or the first image on
  a cover page), and the site's favicon for books without one.
- Single-key shortcuts (C contents, I information, F full screen, T theme,
  L layout, R read aloud, / search, [ and ] speed) can be turned off under
  Keyboard in the Aa menu or in Settings if they clash with a screen reader;
  arrow keys, Page Up/Down, Space and Ctrl+F keep working.
- Themes: System, Light, Sepia, Dark and Black (for OLED screens), in
  Settings. The moon/sun button in the top bar (or T) switches between the
  light and dark themes you last chose (Light or Sepia, Dark or Black). Until
  you pick one, the page uses the folder's default theme if its
  `reader-config.json` sets one, otherwise your system setting.
- Settings (the gear button in the top bar): the theme, and reader options
  that otherwise only the site sets: the time left in the footer, web links,
  pictures from other sites, shortcuts, how long positions are kept, how many
  search matches are listed, comic section size, the sleep timer, how much
  speech is prepared ahead and saved, and full-precision voice models. Each
  starts at the site's value (see [Settings](#settings) below); one you change
  is marked with the site's default beside it, and Restore defaults puts them
  all back. They're saved in the browser.
- Remembers your position, text size, line spacing, font and theme. An EPUB's
  position is kept by its identifier, so it resumes wherever the book is opened
  from; a book without one is kept by a fingerprint of its title and chapter
  files, so books that merely share a title don't share a position, and
  editing its metadata (author, date, cover) keeps it.

## Self-hosting the libraries and fonts

```bash
./fetch-libs.sh     # JSZip and marked into ./libs/ (about 190 KB)
./fetch-fonts.sh    # the interface and reading fonts into ./fonts/ (about 2 MB)
```

With these (and the voice scripts below), the reader loads nothing from other
sites. Without them it falls back to cdnjs and Google Fonts.

- **Libraries:** `libs/jszip.min.js` (opens EPUB and comic files) and
  `libs/marked.min.js` (Markdown) are tried first. The local and the cdnjs
  copy must both match hashes pinned in `index.html` (Subresource Integrity),
  so a changed or damaged file is refused rather than run.
- **Fonts:** `fetch-fonts.sh` writes `fonts/ui.css` (IBM Plex Sans and Mono,
  Literata), one stylesheet per reading font in the font menu (read from
  `FONTS` in `index.html`) and the WOFF2 files under `fonts/files/`. Google
  changes its font files from time to time, so they can't be pinned in
  advance: each download must be a real WOFF2 file, and `fonts/SHA256SUMS`
  records them so later runs can check nothing has changed on disk. With
  `--strict` (once that list exists), a changed or missing file, or a font file
  Google now serves that isn't in the list, stops the run instead of being
  fetched again, and the list is left as it was.
- `LIB_FILES` says where `libs/` and `fonts/` are (default: next to the
  page), like `VOICE_FILES` for the voices.
- `ALLOW_CDN = false` makes the reader refuse CDNs entirely: missing libraries
  or voice files are reported instead of fetched elsewhere, and missing fonts
  fall back to the device's own.

### Checksums

Every file `fetch-libs.sh`, `fetch-kokoro.sh` and `fetch-pocket.sh` download
is checked against SHA-256 hashes committed in `checksums/`. A file that
doesn't match is deleted, with a message to run the script again. Files
already on disk are checked on every run too. The check fails closed: without
`sha256sum` or `shasum`, or without the checksum list, the script stops
instead of carrying on unchecked. `--no-verify` skips the check if you really
need to. Options can go in any order (`./fetch-pocket.sh de --int8`), and the
scripts stick to what macOS's older bash and BSD tools support. After changing a pinned version
or model revision, regenerate the lists with `python3 tools/make-checksums.py`;
large model files aren't downloaded for this, since Hugging Face records
their SHA-256. `fetch-libs.sh`, `fetch-kokoro.sh` and `fetch-pocket.sh` also
have a `--list` option that prints what they would download without
downloading it (`fetch-fonts.sh` keeps its own list in `fonts/SHA256SUMS`).

### Upgrading a pinned version

Library versions and model revisions are pinned in two places each, which must agree
(`tests/scripts.test.js` checks this):

| What | In `index.html` | In the fetch script |
| --- | --- | --- |
| JSZip | `LIBS.jszip.cdn` | `JSZIP` in `fetch-libs.sh` |
| marked | `MARKED_URL` | `MARKED` in `fetch-libs.sh` |
| lamejs | `LIBS.lamejs.cdn` | `LAMEJS` in `fetch-libs.sh` |
| kokoro-js | `KOKORO.lib` | `KOKORO_JS` in `fetch-kokoro.sh` (and `TRANSFORMERS`, the transformers.js it bundles) |
| Kokoro model | `KOKORO.revision` | `REV` in `fetch-kokoro.sh` |
| pocket-tts-js | `POCKET.lib` | `POCKET_JS` in `fetch-pocket.sh` |
| ONNX Runtime (Pocket) | `POCKET.ort` | `ORT` in `fetch-pocket.sh` |
| Pocket model | `POCKET.model` | `REV` in `fetch-pocket.sh` |

To upgrade one:

1. Change the version or revision in both places.
2. Run `python3 tools/make-checksums.py libs` (or `kokoro`, `pocket`) to rewrite its list in
   `checksums/`. For a library, it also prints the new `sha384-…` hash: put it in `integrity` in `LIBS`,
   or the browser refuses the new file.
3. Run the fetch script twice (`./fetch-libs.sh`, …): the first run finds the old files, which fail the
   new checksums and are removed (it ends with "run this script again"); the second downloads the new ones.
4. For a new model revision, check that every voice and language still works (the French Pocket TTS bundle
   once had no voices at a revision), and update `POCKET_LANGS` sizes if the files changed.
5. Fonts aren't pinned: rerun `./fetch-fonts.sh` after changing `FONTS` in `index.html`.
6. If your server caches `libs/`, `kokoro/` or `pocket/` for long without checking (nginx.conf.example
   doesn't), returning readers need a hard reload once, or the old library fails the new hash.
7. Run the tests (`tests/run.sh`, and `SLOW=1 tests/run.sh` for the voice models), and commit
   `index.html`, the script and `checksums/` together.

## Self-hosting Pocket TTS

```bash
./fetch-pocket.sh            # English (about 430 MB)
./fetch-pocket.sh en de it   # several languages
./fetch-pocket.sh all        # en de it pt es
./fetch-pocket.sh --int8 en  # 8-bit models instead (for FULL_PRECISION = false)
```

This fills `./pocket/` with pocket-tts-js 0.1.0 (`lib/`), ONNX Runtime Web
1.20.0 (`ort/`), the full-precision model bundle and voices for each language
(`model/<bundle>/`, pinned to a fixed revision of
`vlapky/pocket-tts-onnx`), and `LICENSES/` with a NOTICE that includes the
CC BY 4.0 attribution for Kyutai's model. Each folder (`lib/`, `ort/`, a
language's `model/<bundle>/`) is used from your site only when all its files
are there (the model's in the precision `FULL_PRECISION` picks), and otherwise
comes from the CDN, so a download that stopped partway doesn't break the voice.
Re-runs skip finished files, every file is checked against
`checksums/pocket.sha256`, and `pocket/` is git-ignored.

French isn't offered: its model bundle at this revision has no built-in
voices (`voices.bin`), so it can't speak. French books are read by device
voices (Kokoro reads English, and the server voice English and Chinese).

## Self-hosting the natural voice

Run the download script once, next to `index.html` on your web server:

```bash
./fetch-kokoro.sh
```

It fetches about 435 MB into `./kokoro/`:

| Path | What |
|---|---|
| `kokoro/kokoro.web.js` | kokoro-js 1.2.1 |
| `kokoro/ort/` | ONNX Runtime WebAssembly/WebGPU files (from transformers.js 3.5.1) |
| `kokoro/model/` | Kokoro-82M-v1.0-ONNX at a pinned revision (the same one the reader asks Hugging Face for): config, tokenizer, `onnx/model.onnx` (fp32: used by default, and always on WebGPU) and `onnx/model_quantized.onnx` (q8: on the CPU when `FULL_PRECISION` is false) |
| `kokoro/model/voices/` | the 28 voices the reader offers (read from `index.html`) |
| `kokoro/LICENSES/` | licences and a NOTICE listing each component |

The reader checks for these files when you press Download and uses each
local piece it finds, falling back to the CDN for anything missing. A site
that answers a missing file with a "not found" page and status 200 is
handled: the reader looks at what came back, not just the status. The
script is safe to re-run: finished files are skipped, interrupted
downloads resume, and every file is checked against
`checksums/kokoro.sha256`. `kokoro/` is in `.gitignore` because the fp32 model alone
is larger than GitHub's 100 MB file limit. Serve `.wasm` files as
`application/wasm` (see [Serving the reader](#serving-the-reader)).

### One copy of the voice files for several folders

By default the reader looks for `kokoro/` and `pocket/` next to the page it
was opened from. If `index.html` is linked (or copied) into several folders,
for example one per book with its own `default.epub`, set `VOICE_FILES` near
the top of `index.html` to the site path that holds them:

```js
const VOICE_FILES = '/reader/';   // '' (the default) = this page's folder
```

Every copy then loads from `/reader/kokoro/` and `/reader/pocket/`, so the
files are downloaded and cached by the browser once. Put a copy of the fetch
scripts in that folder and run them there: each works in its own folder, and
reads `checksums/` beside it (`fetch-kokoro.sh` also reads the voice list from
`index.html`, and `fetch-fonts.sh` reads only `index.html`). The browser treats the same
file under two different paths as two files, which is why sharing one
folder matters.

## Serving the reader

Any static web server works. [`nginx.conf.example`](nginx.conf.example) is a
complete nginx setup for the reader at `/reader/`:

- **A Content-Security-Policy for the reader page:** code, styles, fonts and
  data only from your site, workers from `blob:` and WebAssembly for the voices,
  nothing else allowed to frame the reader. Book pages inherit it, on top of
  their own stricter policy.
  - There are two versions. The active one is for a fully self-hosted reader
    (all four fetch scripts run). The commented one adds the CDNs, for the
    default `ALLOW_CDN = true`.
  - With `ALLOW_REMOTE_CONTENT = true`, also allow the sites books load from.
  - The test suite sends exactly the active policy from that file, so the
    tests (including real Kokoro and Pocket TTS with `SLOW=1`) check that it
    works.
- **The types the reader needs:** `.mjs` as `text/javascript` (with `nosniff`,
  a wrong type is refused) and `.wasm` as `application/wasm`.
- **Caching that checks first** (`Cache-Control: no-cache`): browsers keep every
  file but ask whether it changed (an unchanged file is a short 304), so a new
  `index.html`, library or model is used at once. Long caching without checks
  would let an old library meet a new `index.html`, whose integrity hash then
  refuses it.
- **`location ^~ /reader/`,** so regular-expression locations elsewhere in your
  server can't take over the reader's files (and drop these headers). Folders
  with their own link to `index.html` need the same block.
- gzip for text and WebAssembly.

For Caddy, the same policy goes in a `header` directive:

```
handle /reader/* {
	header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline' data:; img-src 'self' data: blob:; media-src 'self' data: blob:; font-src 'self' data: blob:; connect-src 'self' data: blob:; frame-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'self'"
	header X-Content-Type-Options nosniff
	header Referrer-Policy same-origin
	# Revalidate every file (cheap with ETags): a cached old library would fail a new index.html's hash.
	header Cache-Control "no-cache"
	root * /srv/www
	file_server
}
```

Caddy already serves `.mjs` and `.wasm` with the right types.

## Settings

These constants near the top of the script in `index.html` are meant to be
changed. Edit the file and reload the page, or set them for one folder in a
[`reader-config.json`](#per-folder-settings-reader-configjson) (the ones
marked ✓). Readers can change some of them for themselves in the Settings
dialog (marked ⚙): yours is then the default they start from, and their
choice is saved in their browser. A folder can keep any of the ⚙ ones fixed with a
`LOCKED` list in its `reader-config.json`. The paths, the CDN policy, the voice server,
default books and the memory and request sizes stay the site's to set.

| Constant | Default | What it does / when to change it |
|---|---|---|
| `DEFAULT_BOOK` ✓ | `['default.epub', 'default.md']` | Opened when the address has no `?book=`: the first of these that is really there, from the same folder as `index.html` (an EPUB or comic must be a valid archive; a text, Markdown or HTML document mustn't be the site's "not found" page). Otherwise the built-in sample opens. A single name works too; names must be on the same site. |
| `BOOKSHELF` ✓ | `'/bookshelf/'` | Site folder searched for a relative `?book=` path that isn't found next to `index.html`. |
| `VOICE_FILES` ✓ | `''` | Where the self-hosted `kokoro/` and `pocket/` folders are. `''` is this page's folder; set a site path such as `'/reader/'` when `index.html` is linked into several folders (see [One copy of the voice files](#one-copy-of-the-voice-files-for-several-folders)). |
| `LIB_FILES` ✓ | `''` | Where the self-hosted `libs/` and `fonts/` folders are, like `VOICE_FILES`. |
| `ALLOW_CDN` ✓ | `true` | `false` never loads code, models or fonts from CDNs (cdnjs, jsDelivr, Hugging Face, Google Fonts): everything must be self-hosted. |
| `ALLOW_REMOTE_CONTENT` ✓ ⚙ | `false` | `true` lets book pages load images, media, stylesheets and fonts from other sites (which can tell when a book is being read), and drops the book pages' security policy. Readers can turn it on for themselves in Settings unless a folder's config lists it in `LOCKED`; the reader policy from `nginx.conf.example` also blocks other sites whatever the reader chooses. |
| `ALLOW_EXTERNAL_LINKS` ✓ ⚙ | `true` | `false` turns a book's web and e-mail links into plain text. |
| `SLEEP_TIMER` ✓ ⚙ | `false` | `true` shows the sleep timer in the read-aloud bar. |
| `TIME_LEFT` ✓ ⚙ | `false` | `true` shows the reading time left in the footer ("12 min left in chapter · 3 h 10 min in book"). |
| `KEEP_POSITIONS_DAYS` ✓ ⚙ | `730` | Reading positions of books not opened for this many days are forgotten (checked once a day), in whole days (under one counts as one). `0` keeps them forever. Positions are kept per site, so the longest value any folder of the site has asked for applies (a folder's `0` keeps them all). The browser remembers that value, so lowering it later (or removing a folder's `0`) doesn't shorten it in browsers that have already run the page. A time a reader sets in Settings is used as it is, for the whole site (except in a folder that locks it). |
| `TTS_SERVER` ✓ | `/tts/` and `/tts-voices/` on the site root | Where the Server voice's API and voice list are. Change both paths if your proxy serves them somewhere else; in a config file: `"TTS_SERVER": {"api": "/tts/", "voices": "/tts-voices/"}`. |
| `FULL_PRECISION` ✓ ⚙ | `true` | Full-precision Kokoro and Pocket TTS models (best quality, larger downloads). `false` uses the 8-bit models: Pocket TTS always, Kokoro on the CPU only (on WebGPU it stays full precision). Self-host them with `./fetch-pocket.sh --int8`. Readers can change it in Settings; with `ALLOW_CDN` false (or a policy that blocks the CDNs), Pocket TTS then needs both precisions self-hosted (`./fetch-pocket.sh` and `./fetch-pocket.sh --int8`), or it tells the reader to set it back. |
| `LOOKAHEAD_SEC` ✓ ⚙ | `120` | Seconds of natural-voice audio prepared ahead of the passage being read, into the next chapters. Lower it to keep a laptop's CPU or GPU less busy. Whole seconds. |
| `SAVED_AUDIO_MB` ✓ ⚙ | `500` | Finished natural-voice audio kept in the browser (IndexedDB) for rereading; the least recently used passages are dropped past this. About 170 MB per hour of audio. `0` saves nothing. Whole MB. |
| `NCACHE_SEC` ✓ | `900` | Seconds of finished audio also kept in memory for instant replay. Lower it on low-memory devices (it never goes below twice `LOOKAHEAD_SEC` plus a minute, so prepared audio isn't dropped before it plays). |
| `SPAN_MAX` ✓ | Kokoro `350`, Pocket TTS `600`, server `600` | Most characters sent to a natural voice in one request (a paragraph or part of one): sentences are joined up to it, and a single longer sentence (they are cut at 220 characters) is still sent whole. The server's limit matches its warmup profile in epub-reader-tts-server: raise it there first, or long paragraphs fail. |
| `FONTS` | Literata and others | The reading-font menu. Each entry has an `id`, a `name`, a short `note` shown beside it, an optional `css` (a Google Fonts family spec, loaded when chosen) and a CSS font `stack`. |
| `WIDTHS` | Narrow, Medium, Wide, Full | Text-width steps: a name, then the widest the text gets in the one-column layout and in the two-column layout (`null` for no limit). |
| `SEARCH_MAX` ✓ ⚙ | `500` | Most search results listed. |
| `COMIC_PART` ✓ ⚙ | `40` | Comic pages per section. Keep it even so two-page spreads stay paired. A comic's place is kept as the page on screen, so changing it doesn't move readers to another page (a place saved by a version before this one follows the old sections once). |

External code is pinned to exact versions in `index.html`: `LIBS` (JSZip
3.10.1 and marked 15.0.12, with their SRI hashes), the `lib`/`ort` URLs and
model `revision` in `KOKORO` (kokoro-js 1.2.1), and `POCKET` (pocket-tts-js
0.1.0, onnxruntime-web 1.20.0, a fixed model revision). When upgrading, change
the matching version in the fetch script too (their comments say which line
has to match) and regenerate `checksums/` with `tools/make-checksums.py`.

## Per-folder settings (reader-config.json)

An optional `reader-config.json` next to the page changes settings for that
folder only. This is useful when `index.html` is linked into several folders,
each with its own `default.epub`:

```json
{
  "LIB_FILES": "/reader/",
  "VOICE_FILES": "/reader/",
  "DEFAULT_BOOK": ["default.epub", "notes.md"],
  "theme": "dark",
  "layout": "one",
  "readAloud": "server"
}
```

- Any setting marked ✓ in the table above, by name.
- Starting preferences, used until the reader picks their own: `theme`
  (`"light"`, `"sepia"`, `"dark"` or `"black"`; without one the page follows
  the system), `layout` (`"two"`, `"one"`, `"scroll"`), `width`
  (`"Narrow"`, `"Medium"`, `"Wide"`, `"Full"`), `font` (an id from `FONTS`,
  such as `"literata"`), `fontSize` (percent, 70–200), `lineSpacing`
  (1–2.6), `readAloud` (`"device"`, `"kokoro"`, `"pocket"`, `"server"`) and
  `shortcuts` (`false` starts with single-key shortcuts off).
- `LOCKED`: a list of options readers can't change in this folder's
  Settings, such as `["ALLOW_REMOTE_CONTENT", "ALLOW_EXTERNAL_LINKS",
  "theme"]`. Any option marked ⚙ can be named, plus `theme` and `shortcuts`.
  A locked option is this folder's value (or `index.html`'s) whatever the
  reader chose; the dialog shows it as set by the site, and a locked theme
  also disables the theme button and T (a locked `shortcuts`, its option in
  the Aa menu). The reader's own choice is kept for folders that don't lock
  it. A locked `KEEP_POSITIONS_DAYS` doesn't shorten it for the whole
  site: the longest of the folders' times and the reader's own applies.
- Unknown names and wrong values are ignored with a warning in the browser
  console. A missing file, or a "not found" page in its place, means no
  config.

## Tests

```bash
cd tests && npm install && npx playwright install chromium && cd ..   # once
tests/run.sh                        # all tests (about eight minutes)
tests/run.sh tests/urls.test.js     # one file
SLOW=1 tests/run.sh                 # also load the real self-hosted Kokoro and Pocket TTS on the CPU
NETWORK=1 tests/run.sh              # also load everything from the CDNs under the CDN version of the policy
```

`run.sh` fetches the libraries and fonts if they're missing, builds a test
site under `tests/site/` (books, documents, comics and a voice, made by
`tests/build_fixtures.py`), and starts five local servers (`tests/server.py`):
the site with a mock Breeze voice server, the same site answering missing files
with 200 "not found" pages, one ignoring range requests, one sending the CDN
version of the reader policy, and an "other site" that records any request a
book makes to it. The browser is blocked from every other site, so the tests
also check that nothing is fetched from elsewhere. They cover opening books and
the `/bookshelf/` fallback, the default book (`default.epub`, `default.md`), per-folder configs, remote-content
stripping and links, self-hosting and integrity checks, search, layouts,
comics, the server voice (streaming, cancelling, preparing ahead, saved audio),
media controls, the sleep timer, time left and audiobook export. The export
tests need `ffmpeg` and `ffprobe` (they're skipped without them): the test
browser has no AAC encoder, so a stand-in hands out real AAC frames made by
ffmpeg, and the `.m4b` files are checked and decoded with ffprobe and ffmpeg.

The tests need Python 3, Node 20.10 or later, Playwright's Chromium, `unzip`, and (for the export tests)
`ffmpeg` and `ffprobe`.

`.github/workflows/slow.yml` runs the whole suite weekly on GitHub, and on
demand, with the real models (`SLOW=1`) and the CDNs (`NETWORK=1`), so changes
upstream (a CDN, Hugging Face's download hosts, a model file) show up.

## Requirements

No build step. The libraries (JSZip, marked for Markdown, lamejs for MP3 audiobooks) and fonts come
from `libs/` and `fonts/` when self-hosted, otherwise from cdnjs and Google
Fonts (with system font fallbacks).

## Licence

The reader (`index.html`, the fetch scripts, the tests and the rest of this
repository) is under the [MIT licence](LICENSE).

The parts the fetch scripts download aren't part of this repository and keep
their own licences, which the scripts save beside them (a `LICENSES/` folder
with the licence texts and a `NOTICE.txt` in `libs/`, `kokoro/` and `pocket/`;
a `NOTICE.txt` in `fonts/`):

- JSZip: MIT or GPLv3 (your choice); marked: MIT; lamejs: LGPL-3.0 (a port of
  LAME; `LICENSES/LGPL-3.0.txt` holds the LGPL and the GPL text it builds on).
- The fonts (IBM Plex Sans and Mono, Literata and the reading fonts): SIL Open
  Font License 1.1.
- Kokoro-82M and kokoro-js: Apache-2.0 (kokoro-js bundles a phonemizer built
  from eSpeak NG, which is GPL-3.0); ONNX Runtime: MIT.
- Pocket TTS's model: CC-BY-4.0 (credit its authors when redistributing it);
  pocket-tts-js: MIT.
