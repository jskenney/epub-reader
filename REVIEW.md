# Code and security review

Second review of the repository (2026-11-08): `index.html` (about 3,800 lines), `fetch-libs.sh`,
`fetch-fonts.sh`, `fetch-kokoro.sh`, `fetch-pocket.sh`, `tools/make-checksums.py` and the test suite in
`tests/`. It follows the first review and the changes made in response to it (commits `6832de6` and
`efa4068`). No code was changed as part of this review.

**Method.** The code was read twice: once by the author of the recent changes and once by an independent
reviewer who was given the code but not those conclusions. Findings marked *reproduced* were confirmed in
Chromium against the real `index.html`, using hostile test books served by `tests/server.py`. The rest were
confirmed by reading the code, except where marked *unconfirmed*. The test suite (`tests/run.sh`) passed
three times in a row: 31 tests, with 2 more (real Kokoro and Pocket TTS) passing under `SLOW=1`.

**Labels.** Each item has an ID to ask for by name (for example, "fix H-1 and M-1"):

| Prefix | Meaning |
|---|---|
| **C** | Critical: code running where it shouldn't, data loss, or the reader unusable. *None found.* |
| **H** | High: a security or privacy protection that doesn't hold, or a serious bug. |
| **M** | Medium: a real bug or gap that affects people in normal use. |
| **L** | Low: minor, rare, or defence in depth. |
| **T** | Tests: gaps in the test suite. |
| **D** | Documentation. |
| **E** | Enhancement: a new feature or improvement. |

## Summary

The reader is in good shape:
- No way was found for a book, `voices.json`, `reader-config.json` or the address to run script in the
  reader's own page or escape the sandboxed book frame. There are no critical items.
- The bugs from the first review are fixed, with tests.
- Self-hosting and integrity checks work. With the fetch scripts run, a test confirms nothing is loaded
  from other sites.

The most important items:
- **H-1 and H-2:** the remote-content stripping added in this round can be bypassed. A book can still
  contact another site (a privacy leak, not code running), and uppercase XHTML tags get past the sanitizer.
  A Content-Security-Policy on the book frame closes the whole class at once.
- **M-1:** a small bug that leaves the reader stuck on a malformed link.

## Index

| ID | Item | Area |
|---|---|---|
| [H-1](#h-1-remote-content-stripping-can-be-bypassed) | Remote-content stripping can be bypassed (reproduced) | Security / privacy |
| [H-2](#h-2-uppercase-xhtml-tags-get-past-the-sanitizer) | Uppercase XHTML tags get past the sanitizer (reproduced) | Security |
| [M-1](#m-1-a--in-book-leaves-the-reader-stuck-on-loading) | A `%` in `?book=` leaves the reader stuck on "Loading…" (reproduced) | Bug |
| [M-2](#m-2-the-not-found-check-for-html-documents-only-works-for-identical-pages) | The "not found" check for HTML documents only works for identical pages | Bug |
| [M-3](#m-3-sleep-timer-can-stop-right-after-resuming) | Sleep timer can stop right after resuming | Bug |
| [M-4](#m-4-fetch-fontssh-fails-on-macos) | `fetch-fonts.sh` fails on macOS | Bug |
| [M-5](#m-5-french-pocket-tts-has-no-built-in-voices) | French Pocket TTS has no built-in voices (upstream) | Voices |
| [M-6](#m-6-content-security-policy-for-the-reader-page) | No Content-Security-Policy for the reader page itself | Security |
| [L-1](#l-1-relative-urls-not-in-the-book-request-the-readers-own-site) | Relative URLs not in the book request the reader's own site | Robustness |
| [L-2](#l-2-svg-animation-could-set-a-remote-address) | SVG animation could set a remote address (unconfirmed) | Privacy |
| [L-3](#l-3-verify-fails-open-without-a-sha-256-tool) | `verify()` fails open without a SHA-256 tool | Fetch scripts |
| [L-4](#l-4-the-no-pinned-checksum-note-uses-a-substring-match) | The "no pinned checksum" note uses a substring match | Fetch scripts |
| [L-5](#l-5---list-only-works-as-the-first-argument) | `--list` only works as the first argument | Fetch scripts |
| [L-6](#l-6-fetch-fontssh-is-trust-on-first-use) | `fetch-fonts.sh` is trust-on-first-use | Fetch scripts |
| [L-7](#l-7-kokoros-local-first-fetch-shim-is-weaker-than-realfile) | Kokoro's local-first fetch shim is weaker than `realFile()` | Voices |
| [L-8](#l-8-worker-blob-urls-are-never-revoked) | Worker blob URLs are never revoked | Memory |
| [L-9](#l-9-reading-pace-state-isnt-reset-for-a-new-book) | Reading-pace state isn't reset for a new book | Bug |
| [L-10](#l-10-zipsources-blob-url-list-keeps-growing) | `zipSource`'s blob URL list keeps growing | Memory |
| [L-11](#l-11-a-book-element-with-idspine-end-breaks-page-counting) | A book element with `id="spine-end"` breaks page counting | Robustness |
| [L-12](#l-12-voice-clip-urls-arent-restricted-to-the-voices-folder) | Voice clip URLs aren't restricted to the voices folder | Security |
| [L-13](#l-13-books-without-an-id-share-reading-positions-by-title) | Books without an ID share reading positions by title | Bug |
| [L-14](#l-14-a-bad-book-link-falls-back-to-the-sample-not-defaultepub) | A bad `?book=` link falls back to the sample, not `default.epub` | Behaviour |
| [L-15](#l-15-the-server-voice-cache-key-depends-on-field-order) | The server voice cache key depends on field order | Voices |
| [L-16](#l-16-the-whole-book-file-is-held-in-memory) | The whole book file is held in memory | Memory |
| [L-17](#l-17-single-letter-shortcuts-clash-with-screen-readers) | Single-letter shortcuts clash with screen readers | Accessibility |
| [L-18](#l-18-tts-server-ports-are-open-to-the-network) | TTS server ports are open to the network (server repo) | Security |
| [T-1](#t-1-the-hostile-book-test-misses-most-leaks) | The hostile-book test misses most leaks | Tests |
| [T-2](#t-2-the-soft-404-test-server-always-returns-the-same-page) | The soft-404 test server always returns the same page | Tests |
| [T-3](#t-3-device-voices-and-publisher-narration-have-no-tests) | Device voices and publisher narration have no tests | Tests |
| [T-4](#t-4-real-kokoro-and-pocket-tts-only-run-on-request) | Real Kokoro and Pocket TTS only run on request | Tests |
| [D-1](#d-1-the-readme-overstates-the-remote-content-protection) | The README overstates the remote-content protection | Docs |
| [D-2](#d-2-a-web-server-example-for-the-reader) | A web server example for the reader | Docs |
| [D-3](#d-3-an-upgrade-checklist) | An upgrade checklist for pinned versions | Docs |
| [E-1](#e-1-footnote-pop-ups) | Footnote pop-ups | Reading |
| [E-2](#e-2-image-zoom) | Image zoom | Reading |
| [E-3](#e-3-bookmarks-and-highlights-with-notes) | Bookmarks and highlights with notes | Reading |
| [E-4](#e-4-dictionary-lookup) | Dictionary lookup | Reading |
| [E-5](#e-5-more-themes) | More themes (sepia, true black) | Reading |
| [E-6](#e-6-a-bookshelf-page) | A bookshelf page with covers and progress | Library |
| [E-7](#e-7-sync-positions-across-devices) | Sync positions across devices | Library |
| [E-8](#e-8-install-as-an-offline-app) | Install as an offline app (PWA) | Library |
| [E-9](#e-9-right-to-left-manga) | Right-to-left (manga) page order for comics | Comics |
| [E-10](#e-10-audiobook-export) | Audiobook export through the server | Audio |
| [E-11](#e-11-a-settings-panel) | A settings panel in the page | Settings |
| [E-12](#e-12-hide-french-from-pocket-tts-until-it-works) | Hide French from Pocket TTS until it works | Voices |

## Status of the first review

| First review item | Status |
|---|---|
| 1a. Self-hosted voices fail on soft-404 sites | **Fixed.** `realFile()` checks what came back. Tested, including with real models. |
| 1b. `?book=` gives up instead of trying `/bookshelf/` on soft-404 sites | **Fixed** for EPUB, CBZ, folders, text and Markdown. HTML documents are only partly covered; see M-2. |
| Security 1. CDN code without integrity checks | **Fixed** for JSZip and marked (SRI on local and CDN copies). Voice code can't use SRI (dynamic imports and workers); this is mitigated by the fetch scripts' checksums and `ALLOW_CDN = false`. |
| Security 2. No Content-Security-Policy | **Open.** For the book frame, see H-1; for the reader page, M-6. |
| Security 3. Books can contact other sites | **Partly fixed.** `ALLOW_REMOTE_CONTENT` covers the common cases but can be bypassed; see H-1 and H-2. |
| Security 4. SVG and image-map links navigate the frame | **Fixed.** All links are handled, and clicks can't navigate the frame. Tested. |
| Security 5. Google Fonts on every load | **Fixed.** `fetch-fonts.sh` and local-first fonts. |
| Security 6. `TTS_SERVER` hard-coded; `svRef` follows any URL | **Partly.** `TTS_SERVER` can now be set in a config file; `svRef` is still open, see L-12. |
| Security 7. Breeze and studio ports open to the network (server repo) | **Open**, see L-18. |
| Large comics fill memory | **Fixed.** Other sections' images are released. Tested. |
| Kokoro model not pinned | **Fixed.** The worker redirects to a pinned revision, and `fetch-kokoro.sh` uses the same one. Tested. |
| Fetch scripts don't verify downloads | **Fixed.** `checksums/*.sha256` for 118 files; bad files are removed. Tested by tampering. |
| Whole book file held in memory | Open, see L-16. |
| Positions shared by books without an ID and with the same title | Open, see L-13. |
| `openFromUrl` falls back to the sample, not `default.epub` | Open, see L-14. |
| Server voice cache key depends on field order | Open, see L-15. |
| Single-letter shortcuts clash with screen readers | Open, see L-17. |
| Enhancements: per-folder config, `fetch-libs.sh`, listening features, test suite | **Done.** |

## High

### H-1. Remote-content stripping can be bypassed

*Security / privacy, reproduced.* With `ALLOW_REMOTE_CONTENT = false` (the default), a test book still made
requests to another site in several ways:

- **Protocol-relative and backslash URLs:** `<img src="//host/x">` and `/\host/x`. `isExternal()`
  (`index.html` ~419) only recognises a scheme, so these are treated as paths inside the book. Nothing is
  found, the attribute is left alone, and the frame (which inherits the reader's base URL) fetches
  `https://host/x`.
- **A tab or newline inside the scheme:** `src="ht&#9;tp://host/x"`. The regex fails, but the browser's URL
  parser removes the tab. The same trick defeats the `^\s*javascript:` check in `sanitize()`; scripts still
  can't run there, because the frame has no `allow-scripts`.
- **CSS forms the regexes don't cover:**
  - `URL(…)` in upper case.
  - `image-set("https://…" 1x)`, which uses a plain string with no `url()`.
  - `@import"…"` with no space, plus `@IMPORT` and `@import/**/"…"`.
  - Escapes such as `url(\68ttps://…)`.
  - An inline `style="…URL(…)"`, which the case-sensitive `[style*="url("]` selector never reaches.

**Fix.** Stop chasing patterns:
- Put a CSP `<meta http-equiv="Content-Security-Policy">` first in the `<head>` that `buildPage()` writes
  when `ALLOW_REMOTE_CONTENT` is off. For example: `default-src 'none'; img-src data: blob:; media-src blob:;
  style-src 'unsafe-inline' <fonts origin>; font-src data: blob: <fonts origin>`, plus the book's folder
  origin for books opened from a folder. The browser then refuses every vector above, including ones not
  listed, and also covers H-2, L-1 and L-2.
- Also treat any value that resolves to a different origin as remote: `new URL(v, base).origin !==
  location.origin`.

The tests for this are T-1.

### H-2. Uppercase XHTML tags get past the sanitizer

*Security, reproduced.* Chapters are parsed as XML, which keeps the case of names. Selectors and
`getAttribute()` calls in `sanitize()`, `stripRemote()` and `localize()` run on an HTML document and don't
match `<IMG SRC>`, `<IFRAME>`, `<BASE href>`, `<META http-equiv>` or `<SCRIPT>`. Serialising for `srcdoc`
then turns them into working lowercase elements.

Scripts still can't run, because the frame has no `allow-scripts`. But:
- An `<IFRAME>` loads another page inside the book.
- A `<BASE href>` redirects every relative URL in the chapter.
- A `<META http-equiv="refresh">` can replace the chapter with another site's page, which could show a fake
  login.
- If `allow-scripts` were ever added, this would become script execution.

**Fix:** lowercase element and attribute names when copying XHTML into the page (or serialise through an
HTML document before sanitizing). The CSP in H-1 adds a second layer.

## Medium

### M-1. A `%` in `?book=` leaves the reader stuck on "Loading…"

*Bug, reproduced.* In `openFromUrl()` (~3777), `decodeURIComponent()` runs before the `try`. `URLSearchParams`
has already decoded the value once, so `?book=50%25off.epub` becomes `50%off.epub`, and decoding again
throws. The error escapes the start block: no book, no sample and no message. The double decoding also
turns `a%2520b` into `a b`.

**Fix:** drop the second decode, or move it inside the `try`.

### M-2. The "not found" check for HTML documents only works for identical pages

*Bug.* For `?book=…html`, a candidate is rejected only if its text exactly matches one probe for a random
missing file, and that probe result is cached once for the whole session (`soft404()`, ~471). Many real "not
found" pages include the requested path, a time or a request ID. Such a page then opens as the document, and
the `/bookshelf/` location is never tried. EPUB, CBZ, folders and text/Markdown are not affected; they have
structural checks.

**Fix:** compare after removing the requested path and normalising whitespace, and keep the probe per
folder. The test is T-2.

### M-3. Sleep timer can stop right after resuming

*Bug.* If reading is paused while the timer shows "Stopping after this passage" (the time is up but the
passage hasn't ended), `sleep.due` stays set:
- Pressing play more than a minute later hits the "a very long passage: stop now" branch of the ticker, and
  reading stops within a second.
- Pressing play sooner stops it after one passage.

**Fix:** clear `sleep.due`, or turn the timer off, when reading is paused or stopped.

### M-4. `fetch-fonts.sh` fails on macOS

*Bug.* `sed -E "s/…/\1\t\2/"` relies on GNU sed reading `\t` as a tab. BSD/macOS sed writes a `t`. The id/spec
split then fails, the script asks Google for an empty family, and `curl -f` aborts it.

**Fix:** use `awk` or `printf`, or a literal tab via `$'\t'`.

### M-5. French Pocket TTS has no built-in voices

*Voices, unconfirmed in the reader.* The French bundle at the pinned revision of `vlapky/pocket-tts-onnx`
has no `voices.bin` (upstream). `fetch-pocket.sh` now skips it rather than failing. But French Pocket TTS
probably can't speak, because pocket-tts-js reports "built-in voices unavailable" without that file. It
wasn't confirmed, because the 1.25 GB model couldn't be downloaded for testing.

**Fix:** confirm on a machine with the French model, then either hide French from Pocket TTS (E-12) or move
to a revision that has the voices.

### M-6. Content-Security-Policy for the reader page

*Security, defence in depth.* The reader page itself sends no CSP. A header from the web server would limit
where scripts, workers, styles and connections may come from. For example: `script-src 'self' 'unsafe-inline'`
(plus cdnjs/jsDelivr when not self-hosted), `worker-src blob:`, `'wasm-unsafe-eval'` for the voices, and
`connect-src 'self'` (plus Hugging Face when not self-hosted).

This is separate from the book-frame CSP in H-1. It belongs in the web server configuration; see D-2.

## Low

### L-1. Relative URLs not in the book request the reader's own site

A reference that isn't found in the book (`<img src="missing.png">`) is left as it is and resolves against
the reader's site, so a book can make GET requests to any path there. This is the same site, so it isn't a
privacy leak, but it's unexpected. **Fix:** remove references that aren't found in the book. The CSP in H-1
also covers it.

### L-2. SVG animation could set a remote address

*Unconfirmed.* `<set attributeName="href" to="https://…"/>` inside an SVG `<image>` could set a remote
address after the static attributes were checked. **Fix:** remove `set` and `animate` elements that target
`href`; the CSP in H-1 also covers it.

### L-3. `verify()` fails open without a SHA-256 tool

With neither `sha256sum` nor `shasum`, the fetch scripts only warn and still report "Done". macOS has
`shasum`, so this mainly matters on minimal Linux images. **Fix:** fail unless `--no-verify` is given.

### L-4. The "no pinned checksum" note uses a substring match

`grep -qF "  $path"` counts `libs/a.js` as pinned if `libs/a.js.map` is listed. It's only a note, but
anchoring the match (whole line ending in the path) would be accurate.

### L-5. `--list` only works as the first argument

`fetch-pocket.sh --int8 --list` fails, while `--list --int8` works. **Fix:** parse flags in any order.

### L-6. `fetch-fonts.sh` is trust-on-first-use

Google's font files can't be pinned in advance, so the first download is recorded in `fonts/SHA256SUMS`
and later runs compare against it. A changed file is reported and fetched again, but the run doesn't fail.
This is by design; a `--strict` option could make a mismatch fail instead.

### L-7. Kokoro's local-first fetch shim is weaker than `realFile()`

The worker's shim rejects only `text/html` replies. A "not found" reply with another content type would be
handed to the model loader instead of falling back to the pinned CDN revision, and would fail with an
obscure error. **Fix:** also reject replies that start with `<`, as `realFile()` does.

### L-8. Worker blob URLs are never revoked

The Kokoro and Pocket TTS workers are created from blob URLs that are never revoked: a tiny leak on each
load attempt. **Fix:** revoke the URL once the worker has started.

### L-9. Reading-pace state isn't reset for a new book

`pace.lastTurn` and `pace.samples` carry over when a new book opens, so the first page turn may be paired
with the previous book's timestamp. The bounds checks filter out most of this. **Fix:** reset them in
`startBook()`.

### L-10. `zipSource`'s blob URL list keeps growing

As comic sections are revisited, revoked blob URLs stay in `zipSource`'s list until the book closes. The
memory is freed; only the list grows. **Fix:** remove entries when they are revoked.

### L-11. A book element with `id="spine-end"` breaks page counting

A book element with that id comes before the reader's own end marker, so `geom()` would count pages
wrongly. **Fix:** use an unguessable id, or keep a direct reference to the marker.

### L-12. Voice clip URLs aren't restricted to the voices folder

`svRef` fetches whatever `ref_audio` in `voices.json` names, even an absolute URL on another site. You
control `voices.json`, so the risk is low. **Fix:** only allow paths inside the voices folder.

### L-13. Books without an ID share reading positions by title

Positions are keyed by the book's `uid`, falling back to its title, so two books with no ID and the same
title share one position. **Fix:** fall back to the file name and size, or a hash of the package file.

### L-14. A bad `?book=` link falls back to the sample, not `default.epub`

When a `?book=` link can't be opened, the reader shows the built-in sample. The folder's default book would
be the better fallback. **Fix:** call `openDefault()` instead of `openSample()` there.

### L-15. The server voice cache key depends on field order

Saved server-voice audio is keyed by a hash of the whole `voices.json` entry, so reordering its fields
would make all saved audio be made again. **Fix:** hash only `ref_audio`, `ref_text`, `seed` and
`cfg_scale`.

### L-16. The whole book file is held in memory

Books opened from a file or a URL are loaded fully into memory (JSZip). That's fine for novels and heavy for
narrated books with audio. Extracted folders (`?book=dir/`) avoid it. **Fix:** document it (see D-2), or
read archives with range requests.

### L-17. Single-letter shortcuts clash with screen readers

C, F, T, L, I, R and / are global shortcuts, which can conflict with screen readers' browse-mode keys.
**Fix:** a setting (and `reader-config.json` key) to turn them off.

### L-18. TTS server ports are open to the network

*In jskenney/epub-reader-tts-server.* Breeze (port 7860) and the studio (7861) listen on all interfaces, by
choice. Anyone who can reach those ports can use the GPU, and the studio can delete voices and accept 1 GB
uploads, with no password. **Fix:** a firewall rule allowing only the proxy host.

## Tests

### T-1. The hostile-book test misses most leaks

`tests/security.test.js` only checks the logging server, not `page.blocked`, and has none of the H-1 and H-2
vectors. It also relies on a fixed 1.5 s wait. **Fix:** add those vectors (pointing at both the logging
server and a blocked host), assert `page.blocked` is empty, and wait for the page's images to settle instead
of a fixed time.

### T-2. The soft-404 test server always returns the same page

`tests/server.py --soft404` returns the same text for every missing file, so M-2 can't be caught. **Fix:**
add a mode whose "not found" page includes the requested path.

### T-3. Device voices and publisher narration have no tests

Web Speech (device voices) and Media Overlays (publisher narration) were tested by hand earlier, but have no
committed tests. **Fix:** a fake `speechSynthesis` (as used in the earlier manual tests) and a narrated test
book.

### T-4. Real Kokoro and Pocket TTS only run on request

The tests that load the real models run only with `SLOW=1`, and only after their fetch scripts. That's
reasonable given their size; a scheduled run on a machine with the models would catch upstream changes.

## Documentation

### D-1. The README overstates the remote-content protection

The Features list says books "can't contact other sites". Until H-1 and H-2 are fixed, that's not fully
true. **Fix:** soften the wording, or fix H-1 and H-2.

### D-2. A web server example for the reader

The README mentions serving `.wasm` as `application/wasm` but has no complete example. **Fix:** an
`nginx.conf.example` for the reader covering MIME types, caching of `libs/`, `fonts/`, `kokoro/` and
`pocket/`, the CSP header from M-6, and range-request support.

### D-3. An upgrade checklist

Upgrading a pinned library or model touches several places: `index.html`, the fetch script,
`checksums/` via `tools/make-checksums.py`, and the SRI hash for JSZip or marked. **Fix:** a short checklist
in the README.

## Enhancements

### E-1. Footnote pop-ups
Clicking a note mark shows the note in a small pop-up instead of jumping to the back of the book.

### E-2. Image zoom
Click a picture, map or diagram to see it full size.

### E-3. Bookmarks and highlights with notes
Select text, highlight it in a colour, add a note, and list them in a sidebar tab, with export to Markdown.

### E-4. Dictionary lookup
Double-click a word for its definition, from a free dictionary API or a downloadable offline list.

### E-5. More themes
Sepia and a true-black theme for OLED screens, alongside light and dark.

### E-6. A bookshelf page
A page listing the books in `/bookshelf/` with covers, progress and last-read dates.

### E-7. Sync positions across devices
Save positions (and later bookmarks) on your server so devices pick up where the other left off.

### E-8. Install as an offline app
A web app manifest and service worker, so the reader can be installed and open saved books offline.

### E-9. Right-to-left manga
Use ComicInfo's `Manga` value to show comic pages right to left, including spreads.

### E-10. Audiobook export
Render a chapter or book with the server voice into an `.m4b` with chapter markers (deferred earlier).

### E-11. A settings panel
A panel in the page for the options now only in `index.html` or `reader-config.json`: look-ahead, saved
audio limit, remote content, shortcuts and so on.

### E-12. Hide French from Pocket TTS until it works
If M-5 is confirmed, leave French out of Pocket TTS's languages so readers aren't offered a voice that can't
speak.

## Suggested order

1. **H-1, H-2, T-1:** the book-frame CSP, lowercased XHTML names and the tests for them, plus **D-1**.
2. **M-1:** a one-line fix.
3. **M-2 with T-2, and M-3.**
4. **M-4 and L-3 to L-5:** the fetch scripts on macOS and minimal systems.
5. **M-5 / E-12** once French can be checked; **M-6 with D-2** together.
6. Low items, tests and enhancements as convenient.
