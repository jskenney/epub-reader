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

Paths are relative to `index.html`; absolute paths on the same site
(`/library/x.epub`) work too. Books on other sites are refused. If the book
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
- Full-screen reading: the corner button or F hides the top bar, sidebar and
  footer (and uses the browser's full screen where allowed). Esc, F, or the
  Exit button that appears when you move the mouse brings them back.
- Text size (A− / A+) and line spacing (the tighter / looser line buttons,
  1.00–2.60) can be adjusted from the top bar
- Remembers your position, text size and line spacing, and follows light/dark mode

## Requirements

No build step. The only dependency is JSZip 3.10.1, loaded from cdnjs, plus
Google Fonts for the UI and reading typefaces (with system fallbacks).
