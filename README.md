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
only past about 200,000 characters; a text file's paragraph of over 20,000
characters, or block of over 2,000 short lines, is taken in pieces so it can
be, and a code block too long for one part is split by its lines), and the contents entries jump within
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
  (`[see](#a-heading)`) work. Tables are drawn with lines between their cells.
  GitHub's additions work too:
  - **Math:** `$…$` and `` $`…`$ `` in a line, `$$…$$` and ` ```math ` blocks, as GitHub writes them.
    It is turned into MathML by [Temml](https://temml.org/), loaded only for a document with a `$` in it.
    A dollar amount ("$5 and $10") stays text, and TeX that can't be read is shown as written.
  - **Footnotes:** `[^1]` and `[^1]: …`, numbered as they are referred to, gathered at the end, with links both ways.
  - **Alerts:** `> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]` and `[!CAUTION]`, set apart in their colours.
  - **Emoji shortcodes:** `:smile:`, `:+1:` and the rest of [GitHub's names](https://github.com/github/gemoji), as
    the emoji. The list (`libs/emoji.json`, or from jsDelivr when not self-hosted: gemoji isn't on cdnjs) is read
    only for a document with something shaped like `:name:` in it (in code too); a time like 10:30:45 doesn't count.
    Unknown names, code and times stay as written.
  - **Syntax highlighting:** a code block naming its language (` ```js `) is coloured by
    [highlight.js](https://highlightjs.org/) (its common languages), loaded only for a document with such a block;
    other code blocks are shown as they were.

  The editor writes these back with their meaning kept, and mostly as they were written: a formula as its TeX
  (`$…$`, or `` $`…`$ `` where `$…$` can't hold it, so `` $`x`$ `` may come back as `$x$` and a ` ```math ` block
  as `$$…$$`), TeX that couldn't be read as it was, a note's definition where it was, emoji as their `:name:`,
  alerts as `> [!NOTE]`, and highlighted code as fenced code with its whole info string. HTML written in the
  document is written back as it is. A code block over 100,000 characters isn't coloured.

  HTML pages and EPUB chapters get math and highlighting too: TeX between `\(` and `\)` (in a line) or `\[` and
  `\]` (display) is drawn as math, and a code block naming its language (`<pre><code class="language-js">`, or
  `lang-js`, on the `code` or the `pre`) is coloured. `$$…$$` and `$…$` are read too when `MATH_DELIMITERS` (in
  Settings or `reader-config.json`) names them; not by default, as `$` is money far more often in HTML. TeX inside
  `code` or `pre` is left alone. A page's own MathML is drawn by the browser as it is, and code already
  coloured (holding elements, or marked `hljs`) keeps the book's own colours; the reader's colours come with its own
  background. A page spends a few seconds at most on its math and on its code: past that, or in a block with a word of
  over 1,000 characters, the rest is shown as written. While a page is being edited it shows
  its TeX and code as written, and that is what is saved.
- **HTML:** the page's title, `meta name="author"` and `lang` are used, and
  its scripts are removed. Opened by a `?book=` link, its images,
  stylesheets and relative links load from its folder on the server; an
  uploaded single file can't bring those along.

**Links between documents.** A document opened from your site (HTML, Markdown or text) can link to other documents and
books on the same site, beside it or in other folders (`b.html`, `../other/c.md`, `book.epub`). Following one opens it as a
`?book=` link would, once it is found: a link to a missing file leaves the document open, with a notice. It is added to
the browser's history, so Back returns. A link to a place in the document itself stays in it. A link's query string
(`?x=1`) is left out. While editing, such links wait until you press Done, and unsaved changes are asked about before
leaving.

**Fixed-layout EPUBs** (pre-paginated: picture books, comics and magazines
made as EPUB, including EPUB 2 books marked fixed-layout) are shown a page at a
time, each at the size the book gives it (its `viewport`, an SVG page's
`viewBox`, or the book's `rendition:viewport`), scaled to fit the screen. In
the one- and two-column layouts each page is a frame of exactly its own size,
so the book's styles, positions, `vw`/`vh` units and fixed positions work as
the book intends; not the reader's fonts or colours. A page with no colour of
its own is shown white, and the theme colours the space around it. In the
two-column layout pages are shown in two-page spreads, following the pages'
own sides (`page-spread-left`/`right`/`center`), or the cover alone and then
pairs; `rendition:spread` none, a narrow window or the single-column layout
shows one page. The facing page only shows: search highlights, the word read
aloud and the book's links are on the current page, and a click on the facing
page (on a link there too) goes to that page; reading aloud on into it shows
the spread again with it current. A book with
`page-progression-direction="rtl"` is read right to left, as manga are. The
scroll layout fits each page to the width (up to twice its size), zoomed in
the reader's frame, where `vw`/`vh` measure the frame; there a page with no
colour of its own is shown white within the theme's colour, and one that
colours its whole page keeps it. Their text can still be searched and read
aloud; the text size, line spacing and font buttons don't
change these pages. A page whose size isn't given, or marked
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
(or a swipe to the right, on a touch screen or a trackpad) goes on. Page Down, Next and the single-column and
scroll layouts keep the pages in order.

**Right-to-left books.** Every book marked right to left turns right to left:
EPUBs with `page-progression-direction="rtl"` (reflowable ones too, so a
Japanese or Arabic novel turns the way its fixed cover does) and right-to-left
manga. The left arrow key and a swipe to the right go on, and two-page spreads
of fixed-layout pages and comics show the later page on the left (a reflowable
book's columns follow its text: right to left for Arabic or Hebrew, left to right
otherwise). The book's information (I) shows its direction. If a book is marked right to left by mistake, turn on **Turn every
book left to right** in Settings (`FORCE_LTR`).

## Editing documents

Markdown, HTML and plain text documents can be edited in the reader. The
**Edit** button (the pencil, between Settings and Open) has **Edit this
document**, **New Markdown document** and **New HTML document**.

- **WYSIWYG** (the default) edits the page itself; **Raw** edits the Markdown
  or HTML in a text editor. **Split** shows both side by side: in WYSIWYG the
  page is on the left and the source on the right (read-only, following your
  edits); in Raw the text is on the left and the page on the right, made from
  the text a moment after you stop typing. On a narrow screen Split shows one
  at a time, with Text and Page tabs. Plain text is edited raw.
- In WYSIWYG the toolbar sets the paragraph style (paragraph, headings, quote,
  code block) and has bold, italic, code, link (Ctrl+K), picture (by its
  address), bulleted and numbered lists, a horizontal rule, undo and redo.
  Pasted or dropped content keeps only text and simple formatting: no styles,
  classes, scripts or handlers.
- What the reader would leave out of a page (scripts, frames, embedded
  objects, templates and the like) shows in WYSIWYG as a small locked chip,
  and is saved exactly as it was; so are the attributes the reader changes for
  display (link and picture addresses, handlers).
- WYSIWYG writes the text again only once you've typed something: switching
  between WYSIWYG and Raw without typing keeps the file exactly as it was.
  Once written from the page, HTML keeps everything outside its body as it
  was, but the body is written out by the browser (attribute quotes and
  entities normalised, `<tbody>` added to tables); XHTML is written as XML,
  so it stays well-formed. Comments are kept. Markdown comes back in one
  consistent style (`#` headings, `-` bullets, `*` and `**` emphasis, `***`
  rules, fenced code), with anything Markdown can't say kept as HTML; front
  matter is kept as it was. A paragraph's lines are joined into one, and
  reference links become inline links.
- The raw text is edited in CodeMirror, with Markdown or HTML highlighting,
  line numbers, Ctrl+F to find and replace, and Tab to indent. If CodeMirror
  can't be loaded, a plain text box does the same, and the editor bar says why.
- While editing, the page is one long page (the layout button is off), and in
  Split the two sides scroll together: block by block for Markdown, in
  proportion for HTML. The contents list follows the headings as you write,
  and its entries take both sides there. The font, theme, text size, line
  spacing and width apply to the page as usual; the text follows the theme
  and the text size. None of these are written into the file.
- Reading aloud reads the page (it isn't available in Raw without Split), and
  keeps going while you edit the page: the sentence being spoken finishes, and
  the ones after it are read as they now are.
- The reader's single-letter shortcuts don't fire while you type. Ctrl+S
  saves, Ctrl+Shift+S saves as, and Escape (or Done) goes back to reading.
- **Done** goes back to reading and keeps your changes: the page shows them,
  they're kept as a draft, and Edit carries on from them (Save saves them).
  **Discard** goes back to the text as last saved, throwing away the changes
  since (it asks first).
- **Save** writes back to the file where the browser allows it: a document
  opened with the Open button in Chrome or Edge (which use the system's file
  picker) or dropped onto the page. Otherwise Save, and **Save as**, ask
  where to save a copy (Chrome and Edge) or download it. HTML is saved as
  UTF-8, and a `<meta charset>` naming another encoding is changed to say so.
  A file whose lines end in CRLF keeps CRLF. If the file has changed on disk
  since it was opened, Save asks before writing over it.
- What you write is kept in the browser as a draft a moment after each
  change, and as you leave the page. Opening the document again offers it
  back (Edit restores it) as long as the file is as it was when you began, and
  so does starting a new document after an unsaved one. While a save is being
  written, Done and opening another book wait for it. Opening another book,
  or leaving the page, asks first when there are unsaved changes.
- Nothing in the document runs while it is edited: the page is made exactly
  as the reader makes any page, scripts removed, in the same locked-down frame.
- A site can turn editing off with `EDITING` in `reader-config.json`.

**EPUB chapters.** In an EPUB, **Edit this chapter** edits the chapter on screen
the same way (its XHTML, in WYSIWYG or raw), and the page stays on it until
Done. Done keeps the chapter as edited, so several chapters can be edited
before saving; the reader shows them as edited, and asks before another book
is opened while some aren't saved. **Save** (in the editor) saves the whole
book, re-packed: every file as it was, the edited chapters replaced (written
as UTF-8, their declaration saying so), the `mimetype` file first and
uncompressed (as readers require), and the package's own `dcterms:modified`
set to now (added to an EPUB 3 package without one; the package is read in
its own encoding and written as UTF-8 only then). A book opened with the Open
button in Chrome or Edge (or dropped onto the page there) is saved over its file, and read on from it; otherwise
Save asks where, or downloads it. A book read from a folder on the server is
saved as a packed `.epub` of its container, package and listed files (and the
usual `META-INF` files); if one of them can't be fetched (no connection, an
error from the server) it isn't saved, while files the book lists but doesn't
have, or lists on other sites, are left out. **Chapter** downloads just the chapter's file. Every
edited XHTML chapter has to be well-formed XML: if one isn't, saving and
switching to WYSIWYG stop with the error and its line, and the cursor goes
there. Fixed-layout and SVG pages are edited raw. A chapter encrypted with DRM
can't be edited. Adding, removing and reordering chapters isn't possible yet
(E-25).

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

Two more parameters open files by address:

- `index.html?edit=notes/today.md` opens a Markdown, HTML or text file
  (`.md`, `.markdown`, `.html`, `.htm`, `.txt`) straight into the editor (see
  [Editing documents](#editing-documents)), found the same way as `?book=`.
  If there's no such file, a new, empty one with that name is started in the
  text editor, ready to save. Other kinds of file are refused; an EPUB opens
  with the chapter it opens at in the editor (see the EPUB chapters part of
  [Editing documents](#editing-documents)). With editing turned off on the site
  (`EDITING`), the document opens to read and nothing new is started.
- `index.html?get=https://example.com/notes.md` opens a book or document by its
  address, on this site (like `?book=`) or another. The other site has to allow
  it, with CORS headers (`Access-Control-Allow-Origin`); if it doesn't, the
  reader says so. An `http` address can't be read from a page served over
  `https` (the browser blocks it). A note says which site it came from; it can
  be edited and saved as a copy on your computer. An EPUB from another site is
  downloaded whole (its size and ranges aren't shown to other sites). A site
  address that sends the reader on to another site is refused by `?book=`
  and `?edit=`; `?get=` follows it and names the site it ended up on. If
  several of `?edit=`, `?get=` and `?book=` are given, the first in that
  order is used. The reader's policy in
  `nginx.conf.example` allows `https:` in `connect-src` for this; a site can
  turn `?get=` off with `GET_URLS` in `reader-config.json` (and then take
  `https:` out of the policy).

## Reading progress sent to your site

For a book opened from a web address (from this site with `?book=`,
`?get=`, `?edit=` or as the folder's default book, or from another site
with `?get=`), the reader tells your site where the reader is, so a site
with signed-in users can keep everyone's place. Books opened from the
reader's own computer (picked or dropped) and the built-in sample send
nothing. The requests go to addresses on the reader's own site, with its
cookies, so whatever session your site has applies; the reader does no
signing in of its own.

- **`POST /api/position`** (`API_START`): as the book opens, to ask where the
  reader is in it (see below). The book opens where this browser left it,
  and moves to your site's place when the answer comes, unless the reader
  has already turned a page, started editing or reading aloud.
- **`POST /api/progress`** (`API_PROGRESS`): a moment (2 seconds) after the
  pages stop turning, or when the page stops scrolling a screen or more
  away from the last place sent, and on leaving the page (or opening
  another book) if a place hasn't been sent yet. Opening a book sends
  nothing; nor does editing. (A change of layout or text size, which moves
  the pages, can also send one.)
- **`POST /api/complete`** (`API_COMPLETE`): once, the first time the last
  page of the last section is reached (a document that fits on one page,
  or a book whose saved place is its last page, is finished as it opens;
  one opened with `?edit=` isn't, and a new one made by `?edit=` sends
  nothing). Once your site has answered, the reader remembers
  it with the book's position and doesn't send it again.

Both send JSON (`Content-Type: application/json`):

```json
{
  "identifier": "urn:uuid:1234…",
  "fingerprint": "1x2y3z…",
  "path": "/books/moby-dick.epub",
  "url": "https://example.com/books/moby-dick.epub",
  "kind": "epub",
  "file_name": "moby-dick.epub",
  "size": 734512,
  "title": "Moby-Dick",
  "section": 4,
  "section_percentage": 37.5,
  "book_percentage": 21.8
}
```

| Field | What it is |
|---|---|
| `identifier` | The EPUB's own identifier (`dc:identifier`), or `null` (documents, comics, EPUBs without one). |
| `fingerprint` | A hash of the book's contents: for an EPUB, its title, chapter files and last chapter (what the reader keys positions by when there's no identifier); for a document, its text; for a comic, its page names. |
| `path` | The address's path on this site, or `null` for a book from another site. |
| `url` | The full address it was opened from. |
| `kind` | `epub`, `cbz`, `markdown`, `html` or `text`. |
| `file_name` | The last part of the address (the folder's name for an EPUB folder). |
| `size` | The file's size in bytes, or `null` where it isn't known (an EPUB folder). |
| `title` | The book's title. |
| `section` | Which section the reader is in, counting from 0 (a chapter, or a part of a comic or long document). |
| `section_percentage` | How far through that section, 0 to 100. |
| `book_percentage` | How far through the book, 0 to 100: each section counted by its size (an EPUB chapter's size in the archive, a comic section's pages, a document part's text), or all the same for an EPUB folder, whose sizes aren't known. The progress bar shows the same number. |

`/api/complete` sends the first eight fields and `"completed": true`.
`/api/position` sends the first eight fields, and your site answers with the
place it has for that book:

```json
{ "section": 4, "section_percentage": 37.5, "book_percentage": 21.8 }
```

or all three `null` for a book it doesn't know (the book then stays where
this browser left it). `section` and `section_percentage` are used when
`section` is a section the book has (for a comic, `book_percentage` comes
first, as its sections depend on `COMIC_PART`); otherwise `book_percentage`
alone. A
place gone to this way isn't sent back to `/api/progress`. An answer to
`/api/position` that isn't JSON means your site keeps no places: progress
isn't sent either, until the page is reloaded.

Your site should answer with JSON (anything, such as `{"ok": true}`, with a
2xx status). An empty answer counts as no JSON: answer 200 with a body, not 204. An answer that isn't JSON (a missing address, an error, a web
page such as a "not found" or sign-in page, or no connection) is taken to
mean there's no API there: the reader stops sending to that address until
the page is reloaded. So a site without one sees at most one request per
address per page load. (A `/api/position` answer that isn't JSON stops
progress too, but not `/api/complete`.)

Updates can arrive out of order (one sent on leaving the page may overtake
one still waiting for its answer), and the finished mark is kept per browser,
not per user: a site should accept `/api/complete` more than once (another
browser, cleared storage, or a book already finished) and not count on
getting it.

Key what you store by `path` or `url` as well as `identifier`: a book from
another site can carry any identifier, including one of your books'. (The
reader keeps such a book's place apart, by its address.) Set `API_PROGRESS` or `API_COMPLETE` to `""` (in `reader-config.json`,
or in Settings) to send nothing at all (and `API_START` to ask nothing). They must be addresses on the same
site as the reader.

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
  1.00–2.60) can be adjusted from the top bar (on a phone narrower than 400 px,
  line spacing is in Settings → Text settings instead, unless Settings is hidden; on the narrowest phones the
  bar's buttons take two rows)
- Reading font picker (the Aa button): keep the book's own font, or override
  it with Literata, Source Serif 4, EB Garamond, Crimson Pro, Gentium Book Plus,
  Alegreya, Atkinson Hyperlegible, Lexend, Georgia or your system sans-serif. Code keeps its monospace.
  Add any Google Fonts family with `ADDITIONAL_FONTS` (see [Settings](#settings)),
  or add one to the `FONTS` list in `index.html`.
- The browser tab shows the book's cover as its icon (EPUB 3 `cover-image`,
  EPUB 2 `<meta name="cover">`, an image named "cover", or the first image on
  a cover page), and the site's favicon for books without one.
- The contents beside the page, the bottom bar (progress, Previous and Next)
  and the top bar are shown unless turned off in Settings or by their keys:
  C, P and N, which are remembered. With the top bar hidden, a tap or click
  at the top right corner brings it back (in the scroll layout the corner
  steps aside while you read down, and comes back as you scroll up). On a narrow screen the contents
  start closed and C only opens or closes them.
- Single-key shortcuts (C contents, P bottom bar, N top bar, I information,
  F full screen, T theme, L layout, R read aloud, / search, [ and ] speed) can
  be turned off under
  Keyboard in the Aa menu or in Settings if they clash with a screen reader;
  arrow keys, Page Up/Down, Space and Ctrl+F keep working.
- Themes: System, Light, Sepia, Dark and Black (for OLED screens), in
  Settings. The moon/sun button in the top bar (or T) switches between the
  light and dark themes you last chose (Light or Sepia, Dark or Black). Until
  you pick one, the page uses the folder's default theme if its
  `reader-config.json` sets one, otherwise your system setting.
- Settings (the gear button in the top bar): the theme, and reader options
  that otherwise only the site sets: the contents, bottom bar and top bar,
  the time left in the footer, turning
  every book left to right, web links,
  pictures from other sites, shortcuts, how long positions are kept, how many
  search matches are listed, comic section size, the sleep timer, how much
  speech is prepared ahead and saved, full-precision voice models, and the
  more reading fonts (`ADDITIONAL_FONTS`), the marks around math in HTML and EPUB (`MATH_DELIMITERS`), and the addresses reading progress is
  asked for and sent to (see
  [Reading progress sent to your site](#reading-progress-sent-to-your-site)). Each
  starts at the site's value (see [Settings](#settings) below); one you change
  is marked with the site's default beside it, and Restore defaults puts them
  all back. They're saved in the browser. The dialog's first line gives the
  reader's version and links to the project on GitHub. **Generate config**
  shows every setting in use (the site's, the folder's and your own, the
  starting preferences and the folder's `LOCKED` list) as a
  `reader-config.json`, to copy or download and put in a folder.
- Remembers your position, text size, line spacing, font and theme. An EPUB's
  position is kept by its identifier, so it resumes wherever the book is opened
  from; a book without one is kept by a fingerprint of its title and chapter
  files, so books that merely share a title don't share a position, and
  editing its metadata (author, date, cover) keeps it.

## Self-hosting the libraries and fonts

```bash
./fetch-libs.sh     # JSZip, marked, Temml, highlight.js, the emoji list, lamejs and CodeMirror into ./libs/ (about 1.5 MB)
./fetch-fonts.sh    # the interface and reading fonts into ./fonts/ (about 3 MB)
```

With these (and the voice scripts below), the reader loads nothing from other
sites. Without them it falls back to cdnjs and Google Fonts.

- **Libraries:** `libs/jszip.min.js` (opens EPUB and comic files),
  `libs/marked.min.js` (Markdown), `libs/temml.min.js` (math in Markdown, HTML and EPUB), `libs/highlight.min.js` (code in them), `libs/emoji.json` (emoji in Markdown), `libs/lame.min.js` (MP3 audiobooks) and
  `libs/codemirror/` (the editor's text view) are tried first. The local and the cdnjs
  copy must both match hashes pinned in `index.html` (Subresource Integrity),
  so a changed or damaged file is refused rather than run.
- **Fonts:** `fetch-fonts.sh` writes `fonts/ui.css` (IBM Plex Sans and Mono,
  Literata), one stylesheet per reading font in the font menu (read from
  `FONTS` in `index.html`), one for each font a site names in `ADDITIONAL_FONTS`
  (`fonts/g-<name>.css`, from `./reader-config.json` beside the script and any
  `--config path/to/reader-config.json` given; reading the configs needs python3;
  `--list` prints what it would fetch) and the WOFF2 files under `fonts/files/`. Google
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
downloading it, as does `fetch-fonts.sh` (which keeps its own checksums in `fonts/SHA256SUMS`).

### Upgrading a pinned version

Library versions and model revisions are pinned in two places each, which must agree
(`tests/scripts.test.js` checks this):

| What | In `index.html` | In the fetch script |
| --- | --- | --- |
| JSZip | `LIBS.jszip.cdn` | `JSZIP` in `fetch-libs.sh` |
| marked | `MARKED_URL` | `MARKED` in `fetch-libs.sh` |
| Temml | `LIBS.temml.cdn` | `TEMML` in `fetch-libs.sh` |
| highlight.js | `LIBS.hljs.cdn` | `HLJS` in `fetch-libs.sh` |
| gemoji (emoji names) | `LIBS.emoji.cdn` | `GEMOJI` in `fetch-libs.sh` |
| lamejs | `LIBS.lamejs.cdn` | `LAMEJS` in `fetch-libs.sh` |
| CodeMirror | `CM_VERSION` (and a hash per file in `CM_FILES`) | `CODEMIRROR` in `fetch-libs.sh` |
| kokoro-js | `KOKORO.lib` | `KOKORO_JS` in `fetch-kokoro.sh` (and `TRANSFORMERS`, the transformers.js it bundles) |
| Kokoro model | `KOKORO.revision` | `REV` in `fetch-kokoro.sh` |
| pocket-tts-js | `POCKET.lib` | `POCKET_JS` in `fetch-pocket.sh` |
| ONNX Runtime (Pocket) | `POCKET.ort` | `ORT` in `fetch-pocket.sh` |
| Pocket model | `POCKET.model` | `REV` in `fetch-pocket.sh` |

To upgrade one:

1. Change the version or revision in both places.
2. Run `python3 tools/make-checksums.py libs` (or `kokoro`, `pocket`) to rewrite its list in
   `checksums/`. For a library, it also prints the new `sha384-…` hash: put it in `integrity` in `LIBS`
   (for CodeMirror, each file's in `CM_FILES`), or the browser refuses the new file.
3. Run the fetch script twice (`./fetch-libs.sh`, …): the first run finds the old files, which fail the
   new checksums and are removed (it ends with "run this script again"); the second downloads the new ones.
4. For a new model revision, check that every voice and language still works (the French Pocket TTS bundle
   once had no voices at a revision), and update `POCKET_LANGS` sizes if the files changed.
5. Fonts aren't pinned: rerun `./fetch-fonts.sh` after changing `FONTS` in `index.html`, or `ADDITIONAL_FONTS`
   in a `reader-config.json`.
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
`index.html`, and `fetch-fonts.sh` reads `index.html`, the `reader-config.json` beside it, and each one given with
`--config`: pass every folder's, so the fonts their `ADDITIONAL_FONTS` name are fetched too). The browser treats the same
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
- **Book files sandboxed when opened on their own:** a link straight to a
  chapter, an HTML book or an SVG file would otherwise run its scripts on your
  site, where the reader's settings and saved data are. HTML, XHTML, XML, XSL, MathML, RDF, OPF, NCX,
  RSS, Atom and SVG files under `/reader/` and `/bookshelf/` are sent with
  `Content-Security-Policy: sandbox`, a book's own `index.html` too; the reader's
  page, `/reader/index.html`, is exempted by an exact location. A folder under
  `/reader/` with its own copy of `index.html` needs an exact location of its own
  (`location = /reader/folder/index.html { }`), or that copy is sandboxed and blank:
  add one when you update from an earlier version of the example. The reader reads books with `fetch`, which this
  doesn't affect. (Other servers: send the same header for book files.)
- **Caching that checks first** (`Cache-Control: no-cache`): browsers keep every
  file but ask whether it changed (an unchanged file is a short 304), so a new
  `index.html`, library or model is used at once. Long caching without checks
  would let an old library meet a new `index.html`, whose integrity hash then
  refuses it.
- **`location ^~ /reader/`,** so regular-expression locations elsewhere in your
  server can't take over the reader's files (and drop these headers). Folders
  with their own link to `index.html` need the same block.
- gzip for text and WebAssembly (with `gzip_vary`).
- A location with `add_header` of its own drops the server's: repeat any you
  send site-wide (HSTS, say) inside it.

For Caddy, the same policy goes in a `header` directive:

```
handle /reader/* {
	header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline' data:; img-src 'self' data: blob:; media-src 'self' data: blob:; font-src 'self' data: blob:; connect-src 'self' data: blob: https:; frame-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'self'"
	header X-Content-Type-Options nosniff
	header Referrer-Policy same-origin
	# Revalidate every file (cheap with ETags): a cached old library would fail a new index.html's hash.
	header Cache-Control "no-cache"
	# Book files opened on their own run nothing (not the reader's own page: add each folder's own copy of
	# index.html to "not path", as /reader/index.html is). "defer" makes this header replace the policy above,
	# as Caddy runs a matched header line before an unmatched one. (Recent Caddy also takes the short form
	# header @bookfiles >Content-Security-Policy "sandbox".)
	@bookfiles {
		path_regexp (?i)\.(x?html?|xht|shtml|xml|xsl|xslt|svgz?|rss|atom|mml|mathml|rdf|xpdl|xul|smil|opf|ncx|kml|xspf|wml|wsdl|xsd|gpx|xbl|plist)$
		not path /reader/index.html
	}
	header @bookfiles {
		Content-Security-Policy "sandbox"
		defer
	}
	root * /srv/www
	file_server
}
handle /bookshelf/* {
	@bookfiles path_regexp (?i)\.(x?html?|xht|shtml|xml|xsl|xslt|svgz?|rss|atom|mml|mathml|rdf|xpdl|xul|smil|opf|ncx|kml|xspf|wml|wsdl|xsd|gpx|xbl|plist)$
	header @bookfiles Content-Security-Policy "sandbox"
	header X-Content-Type-Options nosniff
	root * /srv/www
	file_server
}
```

Caddy already serves `.mjs` and `.wasm` with the right types. (Inside the reader, a
book's pictures and files are served so they can't run as pages of your site. A link
straight to a book file on your server is protected only by what the server sends:
its type, `nosniff`, and this sandbox header for the extensions listed. Keep book
folders free of other files, and send `nosniff`.)

The extension list follows the types nginx knows. Caddy and other servers that read the system's `/etc/mime.types` give
many more extensions an XML type (`.tei`, `.ttml` and a hundred others); Chromium downloads those rather than showing them,
but keep such files out of book folders. Caddy also serves a folder's `index.html` when the folder itself is asked for
(`/books/x/`), which the extension list doesn't see: sandbox folder addresses too, except the reader's own folder (and any
folder with its own copy of `index.html`):

```
	@bookdirs {
		path */
		not path /reader/
	}
	header @bookdirs {
		Content-Security-Policy "sandbox"
		defer
	}
```

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
| `EDITING` ✓ | `true` | `false` hides the Edit button: no editing documents or starting new ones (`?edit=` opens the document to read). |
| `CONTENTS_TITLE` ✓ | `'Contents'` | The word on the contents button at the top left: any text, or `''` for the icon alone (screen readers still hear "Contents"). |
| `NAVBAR_ICON` ✓ | `''` | A picture shown just left of the contents button, for a site's logo: its address relative to the page (`'logo.png'`, `'design.svg'`) or a full one. It is shown as tall as the button and at most twice as wide (smaller pictures aren't enlarged). The reader's policy in `nginx.conf.example` allows pictures from this site only. |
| `NAVBAR_LINK` ✓ | `''` | Where clicking that picture goes: an address on this site or a full web address (`'https://example.com/'`). `''`: the picture links nowhere. Only web addresses are taken (not `javascript:` and the like). |
| `SHOW_READ_ALOUD`, `SHOW_FONT_MENU`, `SHOW_THEME_BUTTON`, `SHOW_LAYOUT_BUTTON`, `SHOW_FULLSCREEN_BUTTON`, `SHOW_TEXT_SIZE`, `SHOW_LINE_SPACING`, `SHOW_TEXT_WIDTH`, `SHOW_OPEN_BUTTON` ✓ | `true` | `false` hides that control in the top bar: Read aloud, the reading-font (Aa) menu, the theme switcher, Layout, Full screen, text size, line spacing, text width, Open. Each one is still in Settings → **Text settings** (next to Generate config), and the single-key shortcuts still work for those that have one (R read aloud, T theme, L layout, F full screen). The Aa menu's single-key shortcuts switch is in Settings too. |
| `SHOW_SETTINGS_BUTTON` ✓ | `true` | `false` hides the Settings (gear) button, so readers can't open Settings or Text settings. Fix what they would have chosen with the folder's other settings (and `LOCKED`). |
| `NAVBAR_ALT` ✓ | `''` | What the logo is called, for screen readers: the link's name when `NAVBAR_LINK` is set, the picture's description otherwise (`'Example Press'`). `''`: the link is named by where it goes. |
| `GET_URLS` ✓ | `true` | `false` refuses `?get=` addresses (books and documents by their address, on this site or another). |
| `SLEEP_TIMER` ✓ ⚙ | `false` | `true` shows the sleep timer in the read-aloud bar. |
| `ADDITIONAL_FONTS` ✓ ⚙ | `''` | More reading fonts for the Aa menu: any Google Fonts family, by its name as written on fonts.google.com. In `reader-config.json` a name or a list (`["Lora", "Merriweather:ital,wght@0,400;1,400"]`); in Settings, names separated by commas. A name alone loads the regular style (the browser makes bold and italic from it); add the styles to load after a colon, as Google Fonts writes them. Fonts already in the menu are left out. Each is loaded from `fonts/g-<name>.css` when `fetch-fonts.sh` has fetched it (it reads the names from `reader-config.json`), otherwise from Google Fonts, which sees the reader's address (not with `ALLOW_CDN` off, and the self-hosted policy in `nginx.conf.example` blocks Google: use its CDN version for fonts you don't self-host). A font a reader adds in Settings can only come from Google. |
| `MATH_DELIMITERS` ✓ ⚙ | `"\\( \\["` | The marks around TeX that is drawn as math in HTML pages and EPUB chapters, separated by spaces (in `reader-config.json` a list too): any of `\(` for `\(…\)`, `\[` for `\[…\]`, `$$` for `$$…$$` (display) and `$` for `$…$`, which is read as GitHub reads it, so "$5 and $10" stays text. `""` reads none. Markdown always reads its own (`$…$`, `$$…$$`, ` ```math `). Applies when the page is reloaded. |
| `API_START` ✓ ⚙ | `'/api/position'` | Asked for the reader's place as a book from the site opens; `''` asks nothing. |
| `API_PROGRESS` ✓ ⚙ | `'/api/progress'` | Where reading progress is sent (see [Reading progress sent to your site](#reading-progress-sent-to-your-site)): an address on this site; `''` sends nothing. |
| `API_COMPLETE` ✓ ⚙ | `'/api/complete'` | Where finishing a book is sent, once; `''` sends nothing. |
| `FORCE_LTR` ✓ ⚙ | `false` | `true` turns every book left to right, even those marked right to left (`page-progression-direction="rtl"`, right-to-left manga): for books marked so by mistake. Text right to left by its own direction (Arabic, Hebrew) still pages right to left, as its columns run that way, and the information panel says so. |
| `SHOW_CONTENTS` ✓ ⚙ | `true` | `false` starts with the contents closed (on a narrow screen they always start closed). C shows or hides them, and is remembered. |
| `SHOW_PROGRESS` ✓ ⚙ | `true` | `false` hides the bottom bar (progress, position, Previous and Next). P shows or hides it, and is remembered. |
| `SHOW_TOPBAR` ✓ ⚙ | `true` | `false` hides the top bar. N shows or hides it, and is remembered; while it's hidden, a tap or click at the top right corner brings it back (unless the site locks it; in the scroll layout once you scroll up). |
| `TIME_LEFT` ✓ ⚙ | `false` | `true` shows the reading time left in the footer ("12 min left in chapter · 3 h 10 min in book"). |
| `KEEP_POSITIONS_DAYS` ✓ ⚙ | `730` | Reading positions of books not opened for this many days are forgotten (checked once a day), in whole days (under one counts as one). `0` keeps them forever. Positions are kept per site, so the longest value any folder of the site has asked for applies (a folder's `0` keeps them all). The browser remembers that value, so lowering it later (or removing a folder's `0`) doesn't shorten it in browsers that have already run the page. A time a reader sets in Settings is used as it is, for the whole site (except in a folder that locks it). |
| `TTS_SERVER` ✓ | `/tts/` and `/tts-voices/` on the site root | Where the Server voice's API and voice list are. Change both paths if your proxy serves them somewhere else; in a config file: `"TTS_SERVER": {"api": "/tts/", "voices": "/tts-voices/"}`. |
| `FULL_PRECISION` ✓ ⚙ | `true` | Full-precision Kokoro and Pocket TTS models (best quality, larger downloads). `false` uses the 8-bit models: Pocket TTS always, Kokoro on the CPU only (on WebGPU it stays full precision). Self-host them with `./fetch-pocket.sh --int8`. Readers can change it in Settings; with `ALLOW_CDN` false (or a policy that blocks the CDNs), Pocket TTS then needs both precisions self-hosted (`./fetch-pocket.sh` and `./fetch-pocket.sh --int8`), or it tells the reader to set it back. |
| `LOOKAHEAD_SEC` ✓ ⚙ | `120` | Seconds of natural-voice audio prepared ahead of the passage being read, into the next chapters. Lower it to keep a laptop's CPU or GPU less busy. Whole seconds. |
| `SAVED_AUDIO_MB` ✓ ⚙ | `500` | Finished natural-voice audio kept in the browser (IndexedDB) for rereading; the least recently used passages are dropped past this. About 170 MB per hour of audio. `0` saves nothing. Whole MB. |
| `NCACHE_SEC` ✓ | `900` | Seconds of finished audio also kept in memory for instant replay. Lower it on low-memory devices (it never goes below twice `LOOKAHEAD_SEC` plus a minute, so prepared audio isn't dropped before it plays). |
| `SPAN_MAX` ✓ | Kokoro `350`, Pocket TTS `600`, server `600` | Most characters sent to a natural voice in one request (a paragraph or part of one): sentences are joined up to it, and a single sentence longer than this is still sent on its own (sentences over 220 characters are first split at a comma or space). The server's limit matches its warmup profile in epub-reader-tts-server: raise it there first, or long paragraphs fail. In a config file: `"SPAN_MAX": {"kokoro": 350, "pocket": 600, "server": 600}` (any of the three); a value outside 21–5000 is ignored. |
| `FONTS` | Literata and others | The reading-font menu. Each entry has an `id`, a `name`, a short `note` shown beside it, an optional `css` (a Google Fonts family spec, loaded when chosen) and a CSS font `stack`. |
| `WIDTHS` | Narrow, Medium, Wide, Full | Text-width steps: a name, then the widest the text gets in the one-column layout and in the two-column layout (`null` for no limit). |
| `SEARCH_MAX` ✓ ⚙ | `500` | Most search results listed. |
| `COMIC_PART` ✓ ⚙ | `40` | Comic pages per section. Keep it even so two-page spreads stay paired. A comic's place is kept as the page on screen, so changing it doesn't move readers to another page (a place saved by a version before this one follows the old sections once). |

External code is pinned to exact versions in `index.html`: `LIBS` (JSZip
3.10.1, marked 18.1.3, Temml 0.14.0, highlight.js 11.12.0, gemoji 4.1.0's emoji list and lamejs 1.2.1, with their SRI hashes), `CM_VERSION` and
`CM_FILES` (CodeMirror 5.65.21, with its files' hashes), the `lib`/`ort` URLs and
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
  such as `"literata"`, or `g-` and the name of a font of `ADDITIONAL_FONTS` in lower case with hyphens, such as
  `"g-merriweather"`), `fontSize` (percent, 70–200), `lineSpacing`
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

## Version

The version in Settings is one patch release above the latest release tag
(after `v0.60.0` it reads `v0.60.1`), with the date and time it was stamped in
UTC: `Version v0.60.1 - 20261111.1430`. Run `python3 tools/stamp-version.py`
before committing a change to `index.html` to bring it up to date
(`--check` prints what it would write). `.githooks/pre-commit` does that on
every commit that includes `index.html`; turn it on once per clone with
`git config core.hooksPath .githooks` (skip it for one commit with
`git commit --no-verify`). If `index.html` also has unstaged changes it stamps
nothing and says so, rather than commit them too; nor does it stamp a commit
of named paths (`git commit -- index.html`, or `-o`), where git gives it a
temporary index.

## Tests

```bash
cd tests && npm install && npx playwright install chromium && cd ..   # once
tests/run.sh                        # all tests (about 50 minutes)
tests/run.sh tests/urls.test.js     # one file
SLOW=1 tests/run.sh                 # also load the real self-hosted Kokoro and Pocket TTS on the CPU
NETWORK=1 tests/run.sh              # also load everything from the CDNs under the CDN version of the policy
```

`run.sh` fetches the libraries and fonts if they're missing, builds a test
site under `tests/site/` (books, documents, comics and a voice, made by
`tests/build_fixtures.py`), and starts six local servers (`tests/server.py`, ports
8790 to 8795): the site with a mock Breeze voice server, the same site answering
missing files with 200 "not found" pages, one ignoring range requests, one sending
the CDN version of the reader policy, one with no reader policy at all (as any
static server), and an "other site" that records any request a book makes to it. The browser is blocked from every other site, so the tests
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

No build step. The libraries (JSZip, marked for Markdown with Temml, highlight.js and gemoji's emoji list, lamejs for MP3 audiobooks, CodeMirror for
editing) and fonts come
from `libs/` and `fonts/` when self-hosted, otherwise from cdnjs and Google
Fonts (with system font fallbacks).

## Licence

The reader (`index.html`, the fetch scripts, the tests and the rest of this
repository) is under the [MIT licence](LICENSE).

The parts the fetch scripts download aren't part of this repository and keep
their own licences, which the scripts save beside them (a `LICENSES/` folder
with the licence texts and a `NOTICE.txt` in `libs/`, `kokoro/` and `pocket/`;
a `NOTICE.txt` in `fonts/`):

- JSZip: MIT or GPLv3 (your choice); marked: MIT; Temml: MIT; highlight.js: BSD-3-Clause; gemoji: MIT; lamejs: LGPL-3.0 (a port of
  LAME; `LICENSES/LGPL-3.0.txt` holds the LGPL and the GPL text it builds on);
  CodeMirror: MIT.
- The fonts (IBM Plex Sans and Mono, Literata and the reading fonts): SIL Open
  Font License 1.1.
- Kokoro-82M and kokoro-js: Apache-2.0 (kokoro-js bundles a phonemizer built
  from eSpeak NG, which is GPL-3.0); ONNX Runtime: MIT.
- Pocket TTS's model: CC-BY-4.0 (credit its authors when redistributing it);
  pocket-tts-js: MIT.
