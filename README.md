# Spine Reader

A browser-based EPUB reader.

Everything is in one file, `index.html`. Open it, then
click **Open EPUB** or drop an `.epub` file onto the page. It opens on a
built-in sample book.

## Opening a book from the address

When `index.html` is served from a web server, a `book` query parameter opens
a book from the same site on page load:

- `index.html?book=books/moby-dick.epub`: fetches the `.epub` and unzips it
  in the browser
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
- Paged, not scrolled: text flows into two columns per screen (one on narrow
  screens), and images are scaled to fit the page height. Next / Previous,
  the arrow keys, PageUp / PageDown, the mouse wheel or a swipe turn the page.
  Next on a chapter's last page opens the next chapter.
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
  Nothing downloads until you press Download: about 330 MB with WebGPU
  (fast; recent Chrome or Edge), otherwise about 90 MB for the CPU version,
  cached by the browser after the first time. It has 27 English voices
  (American and British) and uses the speed setting when generating.
  Sentences are prepared ahead of time; the highlighted word is estimated
  from playback position, since Kokoro doesn't report word timings. It is
  English-only, so books in other languages use the device voice. On the
  CPU, generation can be slower than real time, which causes pauses between
  sentences. The model and library load from cdn.jsdelivr.net and
  huggingface.co.
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

## Requirements

No build step. The only dependency is JSZip 3.10.1, loaded from cdnjs, plus
Google Fonts for the UI and reading typefaces (with system fallbacks).
