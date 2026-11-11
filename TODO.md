# Plan: editing, server saving and EPUB editing (E-21 to E-25)

This file is the plan for five enhancements listed in REVIEW.md. REVIEW.md only names them; the design, the
decisions behind it and the work to do are here. E-21, E-24 and E-23 are built, and E-22's progress and completion calls; E-25 and the rest of E-22 aren't yet.

| ID | What | Depends on |
|---|---|---|
| E-21 | Edit Markdown and HTML documents (WYSIWYG, raw, split), create new ones, save locally | — |
| E-24 | `?edit=path` opens a file straight into the editor; `?get=URL` opens a file by address | E-21 |
| E-23 | Edit an EPUB's existing chapters; download the chapter or the re-packed book | E-21 |
| E-25 | Add, remove and reorder an EPUB's chapters | E-23 |
| E-22 | A server API: saving files and EPUBs, progress and completion, notes and bookmarks, sign-in | E-21, E-23 |

**Order:** E-21 (in its four phases) → E-24 → E-23 → E-25 → E-22. E-22 comes last so its API is designed
against working editing (E-21, E-23) and with E-7 (sync) and E-3 (notes) in view.

**As for every change so far:** each step has tests that fail without it, the README is updated with it, and
a review follows each enhancement (or each E-21 phase).

---

## Decisions already made

- **Whole document.** A Markdown or HTML document is edited as one file, not section by section. The editor
  opens at the section that was being read.
- **The source text is the master copy.** The page the reader shows is not the file: the reader converts
  Markdown, splits documents into sections at their headings, removes scripts, handlers, remote content and
  forms, and adds its own styles, ids, columns and `blob:` addresses. Every editing mode works from the text,
  and only the text is saved.
- **CodeMirror 5** for the raw editor (not 6, which needs a build step).
- **Our own HTML-to-Markdown converter** (no Turndown).
- **Split view in WYSIWYG mode:** the rendered, editable page on the left, the source (read-only) on the right,
  so the contents panel stays valid.
- **The top bar stays.** The Edit button goes between Settings and Open. Font, theme, text size, line spacing
  and width all apply to the rendered side.
- **Read aloud keeps working** on the rendered side in the split views, and keeps going while you type.
- **Saving:** in place to the local file where the browser allows it (Chrome and Edge, for a file opened
  through the file picker), otherwise a download. Part of E-21.
- **`EDITING`** is on by default; reader-config.json can turn it off (and lock it).
- **E-22 is multi-user.** Anyone can try to save to the server; the server accepts or refuses (in practice it
  accepts signed-in users). Anyone can always save to their own computer.
- **`?edit=` for a file that doesn't exist** starts a new, empty file with that name.
- **`?get=URL`** takes same-site or full addresses and is on by default. A file from another site shows a
  banner naming that site, and can be downloaded but not saved to the server (only by a deliberate Save As to
  a place on the server you choose).
- **EPUB:** E-23 edits existing chapters only; adding, removing and reordering chapters is E-25.

---

## E-21. Editing Markdown and HTML

### What the reader sees

- An **Edit** button in the top bar, between Settings and Open. Shown for Markdown, HTML and plain text
  documents (and later, with E-23, EPUB chapters). Hidden when `EDITING` is off.
- In edit mode a small **editor bar** appears under the top bar:
  - the view: **WYSIWYG**, **Raw**, **Split**;
  - in WYSIWYG: bold, italic, heading level, bulleted and numbered lists, quote, inline code, code block,
    link, picture (by address), horizontal rule, undo and redo;
  - **Save**, **Save as**, **Done** (back to reading).
- **New** in the Open menu: "New Markdown document" and "New HTML document". A new document starts with a
  title line (Markdown) or a minimal HTML page with a `<title>` and an `<h1>`.
- The window's title and the editor bar mark unsaved changes.

### The views

**Raw.** CodeMirror 5 with the Markdown (GFM) or HTML mode, line numbers, line wrapping, find and replace
(its search add-on), Tab indenting. What is typed is what is saved, byte for byte.

**WYSIWYG.** The document is rendered into the page frame as one long editable page (`contenteditable`):
no columns and no splitting into sections. The frame keeps its book security policy and sandbox, so nothing in
the document runs. When the view changes, and when saving, the page is written back to text:
- HTML: serialised from the edited page (XHTML, later, with the XML serialiser so it stays well-formed);
- Markdown: through our converter (below).

WYSIWYG tidies formatting: HTML comes back re-indented with normalised attributes; Markdown comes back in one
consistent style. Front matter is kept as it was. **If nothing was typed in WYSIWYG, the original text is kept
exactly**: the text is only regenerated after an edit.

**Split.**
- Raw view: CodeMirror on the left, the rendered page on the right, updated a moment after typing stops.
- WYSIWYG view: the editable rendered page on the left, the source on the right (read-only, CodeMirror),
  updated as you edit.
- Both sides scroll together, matched block by block (for Markdown, marked's tokens give each block's place in
  the text; for HTML, by top-level elements).
- On a narrow screen there is no room for two sides: the split becomes two tabs.

**Switching** between views carries the text across. Undo history is per view and starts fresh on a switch.

### Keeping what the cleaner removes (HTML in WYSIWYG)

When an HTML document is shown for editing, what the reader would normally remove is kept, not lost:
- `<script>`, `<form>`, `<iframe>`, `<object>`, `<embed>` and the like become locked placeholder chips
  (not editable, but movable and deletable) holding their original markup;
- event-handler attributes (`onclick` and so on) are moved aside onto the element (`data-spine-keep-*`);
- remote pictures and media (when remote content is off) show a placeholder, keeping their original address;
- the reader's own additions (styles, ids it gave headings, `blob:` addresses for the document's own
  pictures) are recorded so they can be taken off again.

When the page is written back, everything is restored exactly and the reader's additions are removed.
**Pasting** is cleaned on the way in: scripts, handlers, comments, Office markup and inline styles from other
programs are dropped; links, emphasis, headings, lists, tables and pictures by address are kept.

### Our HTML-to-Markdown converter

Covers what marked produces from GFM: headings (`#`), paragraphs, emphasis and strong, inline code, fenced code
blocks (keeping the language), bulleted, numbered and task lists (nested), block quotes, links and pictures
(with titles), horizontal rules, tables (with alignment), strikethrough, and hard line breaks. Anything else
is written as an HTML block inside the Markdown, which Markdown allows, so nothing is lost. Text is escaped
where it would otherwise become Markdown (`*`, `_`, `#` at a line start, and so on).

Tested by round trips: Markdown → marked → converter → marked gives the same HTML, over a corpus of samples
(including the test fixtures' documents).

### The top bar and the panels in edit mode

| Control | Rendered / WYSIWYG side | Source side (CodeMirror) |
|---|---|---|
| Theme | yes | yes, matching colours |
| Font face | yes | no, monospace |
| Text size A−/A+ | yes | yes |
| Line spacing, width | yes | no |
| Layout (one/two/scroll) | always one long page while editing | — |

The layout button is disabled while editing, with a tooltip saying why. None of these settings are written
into the file.

- **Contents panel:** follows the rendered side; entries scroll to their headings in the long page, and the
  contents are rebuilt a moment after headings are added, changed or removed.
- **Search box:** searches the rendered side. **Ctrl+F in CodeMirror** is CodeMirror's own find and replace.
- **Information (I):** shows the document's details as now, plus the file name and whether it has unsaved
  changes.

### Read aloud while editing

- In the split views it reads the rendered side and highlights the words, as now.
- It keeps going while you type. The sentence being spoken finishes as it is; sentences prepared ahead that
  are then edited are prepared again; the highlight follows the edited text. (Read aloud works from the
  page's text split into sentences, with ranges into the page: edits mean marking the changed blocks and
  rebuilding their sentences and ranges, without restarting.)
- In the raw view alone (no rendered side) read aloud isn't available.

### What edit mode turns off

- **The reader's single-letter shortcuts and arrow keys** while typing (the frame currently passes every key
  to the reader). Escape (leave the editor, asking if there are unsaved changes) and Ctrl+S (save) remain.
- Columns and page turning by swipe or wheel, search highlights in the page, and saving the reading position.

### Saving

- **Save:** writes back to the file in place where possible: a document opened through the file picker
  (`showOpenFilePicker`, Chrome and Edge) keeps its file handle, and Save writes to it (asking for permission
  the first time). Otherwise Save behaves as Save as.
- **Save as:** the save picker where the browser has one (as the audiobook export already does), otherwise a
  download. The name defaults to the document's file name (`Untitled.md` / `Untitled.html` for new ones).
- Files opened by dropping, from a plain file input or from the server can't be written in place; their Save
  is Save as. (Saving to the server is E-22.)
- After saving, the reading view shows the saved text.

### Not losing work

- A **draft** is kept in this browser (IndexedDB) a moment after each change, keyed by the document. Opening the
  document again offers to restore it. A draft is removed when the document is saved or the changes are
  discarded.
- **Leaving the page** or **opening another book** with unsaved changes asks first.

### Settings and the site

- `EDITING` (default `true`): `false` hides the Edit button and New. In reader-config.json, and lockable through
  `LOCKED` like the other options. Not a Settings dialog option (it's the site's choice).
- CodeMirror's files are fetched by `fetch-libs.sh` with pinned checksums in `checksums/libs.sha256`, loaded
  from the site first and the CDN second (cdnjs), as JSZip and marked are. If CodeMirror can't load, the raw
  view falls back to a plain text box, and says so.
- The nginx example needs no change for E-21.

### As built (differences from the plan above)

- The views are a mode, **WYSIWYG** or **Raw**, and a **Split** toggle, rather than three buttons: Split
  in WYSIWYG puts the page on the left and the source on the right; in Raw, the text on the left and the page
  on the right.
- `EDITING` is a reader-config.json setting only (the site's choice); `LOCKED` doesn't apply, as it isn't in
  the Settings dialog.
- The Open button uses the system file picker where the browser has one (so Save can write back); a dropped
  file's handle is used too where the browser gives one.

### Phases and tasks

**Phase 1: raw editor, split preview, new documents, saving, drafts**
- [x] Edit button (between Settings and Open), editor bar, Done; edit mode state, entered and left cleanly
      (the reading view restored at the same section).
- [x] CodeMirror 5 (5.65, the last release, pinned): core, Markdown, GFM (and the overlay add-on it needs), XML,
      HTML, CSS and JavaScript modes, search and dialog add-ons; in `fetch-libs.sh`, `checksums/libs.sha256`,
      `LIBS` in index.html (local first, CDN second); plain text box fallback.
- [x] Raw view: theme colours, text size, Tab, Ctrl+S, line wrapping.
- [x] Rendered side: the document as one long page through the existing pipeline (conversion, cleaning, the
      frame's policy), the reader's font, theme, size, spacing and width; updated after typing pauses.
- [x] Split view and the two-tab layout on narrow screens; scrolling kept together.
- [x] Contents panel rebuilt from the rendered side; entries scroll within it.
- [x] Keys: single-letter shortcuts and arrows off while typing; Escape and Ctrl+S.
- [x] New Markdown / New HTML in the Open menu.
- [x] Save in place (file handle from the file picker), Save as (save picker or download).
- [x] Drafts in IndexedDB, restore offer, unsaved-changes prompts (leaving, opening another book, Done).
- [x] Read aloud on the rendered side in split view.
- [x] `EDITING` in reader-config.json and `LOCKED`.
- [x] Tests (see below); README: an "Editing" section, `EDITING` in the settings table.

**Phase 2: WYSIWYG for HTML**
- [x] Editable rendered page (`contenteditable` on the long page in the frame), editor toolbar commands.
- [x] Keeping what the cleaner removes (placeholders, handlers, remote addresses) and removing the reader's
      additions when writing back.
- [x] Cleaning pasted content.
- [x] Writing back only after an edit (otherwise the original text, exactly).
- [x] WYSIWYG split (editable page left, read-only source right).
- [x] Read aloud continuing while typing (changed blocks re-split and re-prepared).
- [x] Tests; README.

**Phase 3: WYSIWYG for Markdown**
- [x] The HTML-to-Markdown converter, with round-trip tests over a corpus.
- [x] Front matter kept as it was.
- [x] Tests; README.

**Phase 4: polish**
- [x] Undo and redo across the toolbar commands, keyboard shortcuts for the toolbar (Ctrl+B, Ctrl+I, Ctrl+K).
- [x] Accessibility: the editor bar and toolbar reachable and labelled; focus handling between the two sides.
- [ ] A review of the whole of E-21.

### Tests (E-21)

- The Edit button's place and visibility (Markdown, HTML, text: shown; EPUB, comics: hidden until E-23;
  `EDITING` false: hidden).
- Raw edits are saved byte for byte (download content checked); Save in place writes to the file handle (a
  stand-in file system, as the audiobook tests use).
- Switching views without typing keeps the original text exactly.
- HTML with scripts, handlers, forms and remote pictures: edited in WYSIWYG and saved, all of them come back
  exactly; nothing runs while editing; the reader's additions are not in the saved file.
- Pasting HTML with scripts and handlers: none of them get in.
- Markdown round trips over the corpus.
- The top bar's settings change the rendered side and not the saved text.
- Read aloud in split view, and while typing (the edited sentence is spoken as edited).
- Keys: typing `f`, `t`, `r` types letters; Escape and Ctrl+S work.
- Drafts restored after a reload; the unsaved-changes prompts.
- CodeMirror not available: the text box fallback works and says so.

### Risks

- `contenteditable` differs between browsers (what Enter, Backspace and pasting produce). The toolbar's commands
  should be our own DOM operations rather than the deprecated `execCommand` where they can be, and the tests run
  in Chromium only, so Firefox and Safari need checking by hand.
- Read aloud continuing while typing is the most intricate part; it can land after the rest of phase 2 if needed.
- CodeMirror 5 is in maintenance mode: stable, but no new features.

---

## E-24. Opening files by address: `?edit=` and `?get=`

### `?edit=path/file`

- Looks the file up exactly as `?book=` does: next to `index.html`, then in the bookshelf folder; a path
  starting with `/` is used as it is.
- Opens it straight into the editor (E-21), in the raw view for a file that's new and the last view used
  otherwise.
- **If the file doesn't exist:** starts a new, empty file with that name (Markdown or HTML by its extension),
  ready to save. A name without a supported extension (`.md`, `.markdown`, `.html`, `.htm`, `.txt`) is refused
  with a message.
- **If `EDITING` is off:** opens for reading, with a note that editing is turned off on this site (and a
  missing file is reported as missing, not created).
- **An `.epub`:** opens for reading with a note until E-23; with E-23, opens the current chapter in the editor.
- Saving: Save as (download or save picker), or to the server with E-22.

### `?get=URL`

- Takes a same-site path or a full address (`https://…`), and is on by default.
- **Same site:** behaves as `?book=` with that address.
- **Another site:**
  - that site must allow the fetch with CORS headers; when it doesn't, the reader says so (the browser gives
    no detail, so the message explains the likely cause);
  - `http://` addresses can't be fetched from an `https://` reader (the browser blocks it), and the reader says
    so;
  - a **banner** names the site the file came from;
  - the file can be edited (if `EDITING` is on) and **downloaded**, but not saved to the server; saving it to
    the server (E-22) is only by a deliberate Save as to a place you choose there.
- Documents (Markdown, HTML, text), EPUBs and comics, as `?book=` takes them.
- `GET_URLS` (default `true`) in reader-config.json turns it off; lockable.
- **nginx example:** the reader page's policy needs `connect-src` to allow `https:` for other sites' files. Only
  the reader page changes; book pages keep their own policy. The README explains the change and how to keep
  `connect-src 'self'` on a site that turns `GET_URLS` off.

### Tasks

- [x] `?edit=`: lookup, opening into the editor, new file when missing, `EDITING` off, EPUB note.
- [x] `?get=`: same-site and full addresses, CORS and mixed-content messages, the banner, download-only for
      other sites, `GET_URLS`.
- [x] The test server: a second origin serving files with and without CORS headers.
- [x] nginx example and README.
- [x] Tests: each case above, including a missing file creating a new one, a refused extension, and a
      cross-site file without CORS.

---

## E-23. Editing an EPUB's existing chapters

- The Edit button is shown for EPUBs (reflowable chapters; fixed-layout pages too, as HTML). It edits the
  **current chapter's** XHTML file, with E-21's views.
- The chapter's own stylesheets apply to the rendered side; its pictures and other files come from the book.
- **XHTML must stay well-formed XML.** Before saving (and when switching views), the text is parsed as XHTML;
  an error is shown with its line and column, and the cursor goes there in CodeMirror. Writing back from
  WYSIWYG uses the XML serialiser.
- Edits to several chapters can be made before saving; each edited chapter is kept (with a draft) until saved
  or discarded.
- **Download:**
  - **the chapter** alone (its `.xhtml` file);
  - **the whole book, re-packed:** JSZip writes the archive with `mimetype` first and stored uncompressed, every
    other entry as it was, the edited chapters replaced, and `dcterms:modified` in the package file updated.
- Folder books (an unpacked EPUB on the server) can download the chapter, or a packed `.epub` of the folder.
- Save in place (E-21) applies to an `.epub` opened through the file picker: the re-packed book is written to
  it.

### Tasks

- [x] Edit button for EPUB chapters; the chapter's text from the book; the rendered side with the book's styles
      and files.
- [x] XHTML well-formedness checks with errors shown in CodeMirror.
- [x] Several edited chapters kept until saved.
- [x] Download the chapter; re-pack and download the book (mimetype first, uncompressed; modified date).
- [x] Save in place for a picked `.epub`.
- [x] Tests: the re-packed book opens in the reader and passes a structural check (mimetype first and stored,
      container and package intact, the edited chapter changed and nothing else); malformed XHTML is refused
      with its line; folder books.
- [x] README.

---

## E-25. Adding, removing and reordering an EPUB's chapters

- In edit mode the contents panel gains: **add a chapter** (after the current one), **remove a chapter**, and
  **reorder** (drag, and move up / move down buttons for keyboards).
- Each change updates the package file (manifest and spine), the navigation document (EPUB 3 `nav.xhtml`)
  and the NCX (EPUB 2 `toc.ncx`) where the book has them.
- A new chapter is a minimal XHTML file using the book's main stylesheet, with a title the reader is asked for.
- Removing a chapter that other chapters link to warns first, listing the links.
- Saved with E-23's re-packing.

### Tasks

- [ ] Add, remove, reorder in the contents panel, keyboard-accessible.
- [ ] Package file, nav document and NCX kept in step.
- [ ] Link check before removing.
- [ ] Tests: each change produces a book that opens with the new order and contents; links warned about; EPUB 2
      and EPUB 3 books.
- [ ] README.

---

## E-22. A server API

### Principles

- **Optional.** The reader asks the server once what it supports; without an API (a static site), everything
  works as now and nothing server-related is shown.
- **Multi-user.** Progress, completion, notes and bookmarks belong to the signed-in user. Anyone can try to save
  a file; the server accepts or refuses (normally it accepts signed-in users), and the reader shows its answer.
  Anyone can always save to their own computer instead.
- **One call per action**, JSON in and out (file contents as the request body), one error format
  (`{ "error": "code", "message": "…" }` with a fitting HTTP status).
- **Same site** (under a configurable base path, `API` in reader-config.json, default `/api/`), so the reader
  page's security policy needs no change.

### The calls

**Server and sign-in**
1. **What the server supports:** the calls it has, upload limits, accepted file types, the sign-in method.
2. **Sign in.**
3. **Sign out.**
4. **Current user:** who is signed in, and what they may do.

**Files**

5. **List a folder:** its files and subfolders, with sizes, dates and versions. (Also E-6's data.)
6. **Save a complete file** (Markdown, HTML, text), with the version it started from; refused if the file has
   changed since.
7. **Save a complete EPUB**, checked as a valid EPUB before it is stored, with the same version check.
8. **Upload a picture** (or other file) for a document; returns the address to use in the text.
9. **Rename or move a file.**
10. **Delete a file.**

**Reading progress (E-7)**

11. **Save your place** in a book. *Built:* `POST API_PROGRESS` (default `/api/progress`); see below.
12. **Get your place** in a book.
13. **List your books:** each one's place, when it was last read, and whether it is completed.
14. **Mark a book as completed.** *Built:* `POST API_COMPLETE` (default `/api/complete`), sent once,
    automatically, the first time the end is reached.
15. **Mark a book as not completed.**

**Notes and bookmarks (E-3)**

16. **List your notes and bookmarks** for a book.
17. **Add a note or bookmark** (the server gives it an id).
18. **Change a note or bookmark.**
19. **Delete a note or bookmark.**

**Settings**

20. **Get your reader settings.**
21. **Save your reader settings.**

### Every call

- **Versions and conflicts:** files carry a version (an ETag); saves send it (`If-Match`) and get 412 if the
  file changed meanwhile, and the reader offers to save a copy or download instead. Notes and positions carry
  an updated time for E-7's merging.
- **Paths** are confined to the server's books folder: `..`, absolute paths, symlinks out of it and encoded
  forms of these are refused.
- **Size limits** (nginx's `client_max_body_size` raised for the API location; the server's own limit).
- **Forged requests from other sites:** the session cookie is `SameSite=Strict` and `HttpOnly`, and every
  writing call needs a header a form can't send (and is checked against the `Origin`).
- **Books are identified** the same way the reader keys positions now (the book's identifier, else a hash of its
  package file), so positions saved locally and on the server match.
- A file fetched from another site (`?get=`) is never saved to the server except by an explicit Save as.

### Progress and completion (built)

Agreed and built ahead of the rest, assuming the site's own session (no sign-in in the reader):

- Only for books opened from a web address (this site, or another with `?get=`); not files from the reader's
  computer, not the sample.
- The body: `identifier`, `fingerprint`, `path`, `url`, `kind`, `file_name`, `size`, `title`, `section` (from 0),
  `section_percentage` and `book_percentage` (0 to 100). No time. Completion: the first eight and
  `"completed": true`.
- Sent 2 seconds after the pages stop turning, after scrolling a screen or more, and on leaving the page
  (keepalive); never on opening, never while editing.
- book_percentage counts sections by size where known (EPUB chapter sizes in the archive, comic pages, document
  text); the progress bar shows the same number.
- An address that doesn't answer with JSON (any failure) is no API until the page is reloaded.
- `API_PROGRESS` and `API_COMPLETE` in reader-config.json and Settings (lockable); `""` sends nothing; same site
  only.

### What E-22 ships

- The reader's side: Save to server (Save and Save as in the editor), progress saved and read (E-7 builds its
  syncing on it), completion, the hooks E-3 will use, sign-in and sign-out in Settings.
- **A written spec** (in the README, or `API.md`): each call's method, path, request, response and errors.
- **A small reference server** in Python (users in a file with hashed passwords, data in SQLite), enough to run
  and to test against; the test suite runs the reader against it.
- nginx example: proxying `/api/` to it.

### Tasks

- [ ] The spec, reviewed before code.
- [ ] Reference server: sign-in, sessions, files (with versions and path checks), progress, completion, notes,
      settings.
- [x] Reader: progress and completion calls.
- [ ] Reader: capability check, sign-in UI, Save to server, conflict handling.
- [ ] nginx example, README.
- [ ] Tests: each call through the reader against the reference server; refused saves for signed-out users;
      conflicts; path escapes refused; forged cross-site requests refused.
- [ ] A security review of the API and the reference server.
