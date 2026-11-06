# Spine Reader

A browser-based EPUB reader.

Everything is in one file, `index.html`. Open it, then
click **Open EPUB** or drop an `.epub` file onto the page. It opens on a
built-in sample book.

## Other formats

Besides EPUB, the reader opens **plain text** (`.txt`), **Markdown** (`.md`,
`.markdown`) and **HTML** (`.html`, `.htm`) files, by Open book, drag and
drop, or a `?book=` link. Each is converted to HTML, split into sections at
its main headings (and at about 40,000 characters), and given a contents
list built from its headings; everything else (pages, fonts, read-aloud,
saved position) works as for EPUBs.

- **Plain text:** hard-wrapped lines are joined into paragraphs, while
  short-line passages such as verse keep their line breaks. Lines like
  "CHAPTER IV", "Book One" or short all-caps titles become chapter headings;
  a run of them is treated as a contents list. Project Gutenberg's licence
  header and footer are removed and its title, author and language are
  used. `_word_` becomes italic. Files that aren't UTF-8 are read as
  Windows-1252.
- **Markdown:** rendered with [marked](https://marked.js.org/) (GitHub
  flavour), loaded from cdnjs only when a Markdown file is opened. YAML front
  matter `title`, `author` and `lang` are used. Links to headings
  (`[see](#a-heading)`) work.
- **HTML:** the page's title, `meta name="author"` and `lang` are used, and
  its scripts are removed. Opened by a `?book=` link, its images,
  stylesheets and relative links load from its folder on the server; an
  uploaded single file can't bring those along.

## Opening a book from the address

When `index.html` is served from a web server, a `book` query parameter opens
a book from the same site on page load:

- `index.html?book=books/moby-dick.epub`: fetches the `.epub` and unzips it
  in the browser
- `index.html?book=books/notes.md` (or `.txt`, `.html`): opens that document
- `index.html?book=books/moby-dick/`: reads an already-extracted EPUB folder
  (the folder that contains `META-INF/` and `mimetype`); files are fetched
  one at a time as they're needed. The trailing slash is optional.

A relative path is looked up in two places, in this order:

1. relative to `index.html` (`?book=books/moby-dick/` → `books/moby-dick/`)
2. under `/bookshelf/` at the root of the site
   (`?book=books/moby-dick/` → `/bookshelf/books/moby-dick/`)

The first location that has the book wins. A path that starts with `/`
(`?book=/library/x.epub`) is used as-is. To change the root folder, edit the
`BOOKSHELF` constant near the top of the script in `index.html`. Books on other sites are refused. If the book
can't be loaded, the reader shows why and falls back to the sample book.
This needs a real web server (for example `npx vite` or
`python3 -m http.server`); browsers block these requests on `file://` pages.

## Features

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
  pitch preserved). Switch between "Publisher narration" and "Device voice"
  in the read-aloud bar. Narrator and narration length appear under
  Information.
- Natural voice (Kokoro): choose "Natural voice (Kokoro)" in the read-aloud
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
- Natural voice (Pocket TTS): Kyutai's Pocket TTS through
  [pocket-tts-js](https://www.npmjs.com/package/pocket-tts-js), running on
  the CPU (WebAssembly) in a Web Worker. Unlike Kokoro it reads English,
  French, German, Italian, Portuguese and Spanish books, with 8 built-in
  voices per language. Each language is a one-time download of the
  full-precision models (about 430 MB; French about 1.25 GB) after pressing
  Download. It has no speed control of
  its own, so the speed setting changes playback instantly with pitch
  preserved. The model is CC BY 4.0 (Kyutai).
- Server voice: Breeze TTS 2 running on your own NVIDIA GPU behind the same
  website (English and Chinese). It appears in the read-aloud bar when
  `/tts/health` on the site root answers; voices are reference clips listed
  in `tts-voices/voices.json` next to `index.html`. Setup, Docker Compose,
  reverse-proxy examples and the voice script are in
  [jskenney/epub-reader-tts-server](https://github.com/jskenney/epub-reader-tts-server).
  The model and its output are for non-commercial use.
- Natural voices read a whole paragraph at a time where they can (up to
  about 350 characters for Kokoro and 600 for Pocket TTS), which phrases
  better than sentence by sentence; the sentence and word highlights move
  through the paragraph as it plays. Device voices are listed with the
  vendors' higher tiers (Natural, Neural, Premium, Enhanced, Online) first.
  The natural voices use full-precision models by default; set
  `FULL_PRECISION = false` in `index.html` for the smaller 8-bit models.
- Press C (or the Contents button) to collapse or expand the contents sidebar
- Full-screen reading: the corner button or F hides the top bar, sidebar and
  footer (and uses the browser's full screen where allowed). Esc, F, or the
  Exit button that appears when you move the mouse brings them back.
- Text size (A− / A+) and line spacing (the tighter / looser line buttons,
  1.00–2.60) can be adjusted from the top bar
- Reading font picker (the Aa button): keep the book's own font, or override
  it with Literata, Source Serif 4, EB Garamond, Crimson Pro, Atkinson
  Hyperlegible, Georgia or your system sans-serif. Code keeps its monospace.
  Add more in the `FONTS` list in `index.html`.
- Light/dark toggle in the top bar (or press T). Until you pick one, it
  follows your system setting.
- Remembers your position, text size, line spacing, font and theme

## Self-hosting Pocket TTS

```bash
./fetch-pocket.sh            # English (about 430 MB)
./fetch-pocket.sh en fr de   # several languages (French is about 1.25 GB)
./fetch-pocket.sh all        # en fr de it pt es
./fetch-pocket.sh --int8 en  # 8-bit models instead (for FULL_PRECISION = false)
```

This fills `./pocket/` with pocket-tts-js 0.1.0 (`lib/`), ONNX Runtime Web
1.20.0 (`ort/`), the full-precision model bundle and voices for each language
(`model/<bundle>/`, pinned to a fixed revision of
`vlapky/pocket-tts-onnx`), and `LICENSES/` with a NOTICE that includes the
CC BY 4.0 attribution for Kyutai's model. As with Kokoro, each piece falls
back to the CDN if it's missing, re-runs skip finished files, and `pocket/`
is git-ignored.

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
| `kokoro/model/` | Kokoro-82M-v1.0-ONNX: config, tokenizer, `onnx/model.onnx` (fp32, WebGPU) and `onnx/model_quantized.onnx` (q8, CPU) |
| `kokoro/model/voices/` | the 27 voices the reader offers (read from `index.html`) |
| `kokoro/LICENSES/` | licences and a NOTICE listing each component |

The reader checks for these files when you press Download and uses each
local piece it finds, falling back to the CDN for anything missing. The
script is safe to re-run: finished files are skipped and interrupted
downloads resume. `kokoro/` is in `.gitignore` because the fp32 model alone
is larger than GitHub's 100 MB file limit. Serve `.wasm` files as
`application/wasm`.

## Requirements

No build step. The only dependency is JSZip 3.10.1, loaded from cdnjs, plus
Google Fonts for the UI and reading typefaces (with system fallbacks).
