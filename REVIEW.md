# Code and security review

Second review of the repository (2026-11-08): `index.html` (about 3,800 lines), `fetch-libs.sh`,
`fetch-fonts.sh`, `fetch-kokoro.sh`, `fetch-pocket.sh`, `tools/make-checksums.py` and the test suite in
`tests/`. It follows the first review and the changes made in response to it (commits `6832de6` and
`efa4068`). No code was changed as part of the review itself.

**Update (2026-11-08):** H-1, H-2, T-1, D-1, M-1, M-2, T-2, M-3, M-4, L-3, L-4, L-5, M-6 and D-2 have since been
fixed (commits `2e5345f` to `2e7a63d`), along with L-1 and L-2 as part of H-1. Each fixed item says what was
done and anything left over. Two new items came out of the work: L-19 and T-5. All 42 tests pass, including
real Kokoro and Pocket TTS with `SLOW=1`, under the reader policy from `nginx.conf.example`.

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

**Update 2 (2026-11-08):** E-12 (and so M-5), L-19, L-13, L-14 and L-16 were fixed (commits `590aab6` to
`ef520ac`). A review of those changes found one regression, H-3 (empty files broke chapters read with range
requests), fixed in `c5cfe41`, and new items M-7 to M-10, L-20 to L-24 and T-6 to T-8, mostly about the new
in-place ZIP reader. All 50 tests pass (52 with `SLOW=1`).

## Summary

The reader is in good shape:
- No way was found for a book, `voices.json`, `reader-config.json` or the address to run script in the
  reader's own page or escape the sandboxed book frame. There are no critical items.
- The bugs from the first review are fixed, with tests.
- Self-hosting and integrity checks work. With the fetch scripts run, a test confirms nothing is loaded
  from other sites.

The most important items were H-1 and H-2: the remote-content stripping could be bypassed, and uppercase
XHTML tags got past the sanitizer. Both are now fixed, with a Content-Security-Policy on book pages as a
second layer. Medium items M-7 to M-10, found in the review of the in-place ZIP reader and the position keys, are open.

## Index

| ID | Item | Area | Status |
|---|---|---|---|
| [H-1](#h-1-remote-content-stripping-can-be-bypassed) | Remote-content stripping can be bypassed (reproduced) | Security / privacy | **Fixed** (`2e5345f`) |
| [H-2](#h-2-uppercase-xhtml-tags-get-past-the-sanitizer) | Uppercase XHTML tags get past the sanitizer (reproduced) | Security | **Fixed** (`2e5345f`) |
| [H-3](#h-3-empty-files-broke-chapters-read-with-range-requests) | Empty files broke chapters read with range requests | Bug (regression from L-16) | **Fixed** (`c5cfe41`) |
| [M-1](#m-1-a--in-book-leaves-the-reader-stuck-on-loading) | A `%` in `?book=` leaves the reader stuck on "Loading…" (reproduced) | Bug | **Fixed** (`46a112b`) |
| [M-2](#m-2-the-not-found-check-for-html-documents-only-works-for-identical-pages) | The "not found" check for HTML documents only works for identical pages | Bug | **Fixed** (`33813a3`) |
| [M-3](#m-3-sleep-timer-can-stop-right-after-resuming) | Sleep timer can stop right after resuming | Bug | **Fixed** (`33813a3`) |
| [M-4](#m-4-fetch-fontssh-fails-on-macos) | `fetch-fonts.sh` fails on macOS | Bug | **Fixed** (`770c237`) |
| [M-5](#m-5-french-pocket-tts-has-no-built-in-voices) | French Pocket TTS has no built-in voices (upstream) | Voices | **Fixed** (`590aab6`) |
| [M-6](#m-6-content-security-policy-for-the-reader-page) | No Content-Security-Policy for the reader page itself | Security | **Fixed** (`2e7a63d`) |
| [M-7](#m-7-a-failed-read-inside-an-archive-is-remembered-until-reload) | A failed read inside an archive is remembered until reload | Robustness | Open |
| [M-8](#m-8-range-requests-are-not-tied-to-one-version-of-the-file) | Range requests are not tied to one version of the file | Robustness | Open |
| [M-9](#m-9-decompression-is-not-checked-against-declared-sizes-and-the-small-file-cache-never-empties) | Decompression is not checked against declared sizes, and the small-file cache never empties | Memory | Open |
| [M-10](#m-10-editing-a-book-without-an-identifier-loses-its-position) | Editing a book without an identifier loses its position | Bug | Open |
| [L-1](#l-1-relative-urls-not-in-the-book-request-the-readers-own-site) | Relative URLs not in the book request the reader's own site | Robustness | **Fixed** (`2e5345f`) |
| [L-2](#l-2-svg-animation-could-set-a-remote-address) | SVG animation could set a remote address (unconfirmed) | Privacy | **Fixed** (`2e5345f`) |
| [L-3](#l-3-verify-fails-open-without-a-sha-256-tool) | `verify()` fails open without a SHA-256 tool | Fetch scripts | **Fixed** (`770c237`) |
| [L-4](#l-4-the-no-pinned-checksum-note-uses-a-substring-match) | The "no pinned checksum" note uses a substring match | Fetch scripts | **Fixed** (`770c237`) |
| [L-5](#l-5---list-only-works-as-the-first-argument) | `--list` only works as the first argument | Fetch scripts | **Fixed** (`770c237`) |
| [L-6](#l-6-fetch-fontssh-is-trust-on-first-use) | `fetch-fonts.sh` is trust-on-first-use | Fetch scripts | Open |
| [L-7](#l-7-kokoros-local-first-fetch-shim-is-weaker-than-realfile) | Kokoro's local-first fetch shim is weaker than `realFile()` | Voices | Open |
| [L-8](#l-8-worker-blob-urls-are-never-revoked) | Worker blob URLs are never revoked | Memory | Open |
| [L-9](#l-9-reading-pace-state-isnt-reset-for-a-new-book) | Reading-pace state isn't reset for a new book | Bug | Open |
| [L-10](#l-10-zipsources-blob-url-list-keeps-growing) | `zipSource`'s blob URL list keeps growing | Memory | Open |
| [L-11](#l-11-a-book-element-with-idspine-end-breaks-page-counting) | A book element with `id="spine-end"` breaks page counting | Robustness | Open |
| [L-12](#l-12-voice-clip-urls-arent-restricted-to-the-voices-folder) | Voice clip URLs aren't restricted to the voices folder | Security | Open |
| [L-13](#l-13-books-without-an-id-share-reading-positions-by-title) | Books without an ID share reading positions by title | Bug | **Fixed** (`c992d26`) |
| [L-14](#l-14-a-bad-book-link-falls-back-to-the-sample-not-defaultepub) | A bad `?book=` link falls back to the sample, not `default.epub` | Behaviour | **Fixed** (`41455c8`) |
| [L-15](#l-15-the-server-voice-cache-key-depends-on-field-order) | The server voice cache key depends on field order | Voices | Open |
| [L-16](#l-16-the-whole-book-file-is-held-in-memory) | The whole book file is held in memory | Memory | **Fixed** (`ef520ac`) |
| [L-17](#l-17-single-letter-shortcuts-clash-with-screen-readers) | Single-letter shortcuts clash with screen readers | Accessibility | Open |
| [L-18](#l-18-tts-server-ports-are-open-to-the-network) | TTS server ports are open to the network (server repo) | Security | Open |
| [L-19](#l-19-parsing-a-book-reports-policy-violations-in-the-console) | Parsing a book reports policy violations in the console | Noise | **Fixed** (`8ead107`) |
| [L-20](#l-20-a-few-css-forms-still-get-past-the-cleaning-the-policy-blocks-them) | A few CSS forms still get past the cleaning (the policy blocks them) | Privacy / noise | Open |
| [L-21](#l-21-replacing-a-missing-css-file-with-none-can-drop-a-whole-declaration) | Replacing a missing CSS file with none can drop a whole declaration | Rendering | Open |
| [L-22](#l-22-differences-between-the-in-place-reader-and-jszip) | Differences between the in-place reader and JSZip | Compatibility | Open |
| [L-23](#l-23-two-requests-per-file-when-reading-in-place) | Two requests per file when reading in place | Performance | Open |
| [L-24](#l-24-the-pre-parse-stripping-misses-some-forms-of-base-and-meta) | The pre-parse stripping misses some forms of base and meta | Noise | Open |
| [T-1](#t-1-the-hostile-book-test-misses-most-leaks) | The hostile-book test misses most leaks | Tests | **Fixed** (`2e5345f`) |
| [T-2](#t-2-the-soft-404-test-server-always-returns-the-same-page) | The soft-404 test server always returns the same page | Tests | **Fixed** (`33813a3`) |
| [T-3](#t-3-device-voices-and-publisher-narration-have-no-tests) | Device voices and publisher narration have no tests | Tests | Open |
| [T-4](#t-4-real-kokoro-and-pocket-tts-only-run-on-request) | Real Kokoro and Pocket TTS only run on request | Tests | Open |
| [T-5](#t-5-the-cdn-version-of-the-reader-policy-isnt-tested) | The CDN version of the reader policy isn't tested | Tests | Open |
| [T-6](#t-6-the-in-place-zip-tests-cover-only-the-normal-cases) | The in-place ZIP tests cover only the normal cases | Tests | Open |
| [T-7](#t-7-position-key-tests-leave-gaps) | Position-key tests leave gaps | Tests | Open |
| [T-8](#t-8-the-hostile-test-book-lacks-the-remaining-css-forms) | The hostile test book lacks the remaining CSS forms | Tests | Open |
| [D-1](#d-1-the-readme-overstates-the-remote-content-protection) | The README overstates the remote-content protection | Docs | **Fixed** (`2e5345f`) |
| [D-2](#d-2-a-web-server-example-for-the-reader) | A web server example for the reader | Docs | **Fixed** (`2e7a63d`) |
| [D-3](#d-3-an-upgrade-checklist) | An upgrade checklist for pinned versions | Docs | Open |
| [E-1](#e-1-footnote-pop-ups) | Footnote pop-ups | Reading | Open |
| [E-2](#e-2-image-zoom) | Image zoom | Reading | Open |
| [E-3](#e-3-bookmarks-and-highlights-with-notes) | Bookmarks and highlights with notes | Reading | Open |
| [E-4](#e-4-dictionary-lookup) | Dictionary lookup | Reading | Open |
| [E-5](#e-5-more-themes) | More themes (sepia, true black) | Reading | Open |
| [E-6](#e-6-a-bookshelf-page) | A bookshelf page with covers and progress | Library | Open |
| [E-7](#e-7-sync-positions-across-devices) | Sync positions across devices | Library | Open |
| [E-8](#e-8-install-as-an-offline-app) | Install as an offline app (PWA) | Library | Open |
| [E-9](#e-9-right-to-left-manga) | Right-to-left (manga) page order for comics | Comics | Open |
| [E-10](#e-10-audiobook-export) | Audiobook export through the server | Audio | Open |
| [E-11](#e-11-a-settings-panel) | A settings panel in the page | Settings | Open |
| [E-12](#e-12-hide-french-from-pocket-tts-until-it-works) | Hide French from Pocket TTS until it works | Voices | **Fixed** (`590aab6`) |

## Status of the first review

| First review item | Status |
|---|---|
| 1a. Self-hosted voices fail on soft-404 sites | **Fixed.** `realFile()` checks what came back. Tested, including with real models. |
| 1b. `?book=` gives up instead of trying `/bookshelf/` on soft-404 sites | **Fixed**, including HTML documents (M-2). |
| Security 1. CDN code without integrity checks | **Fixed** for JSZip and marked (SRI on local and CDN copies). Voice code can't use SRI (dynamic imports and workers); this is mitigated by the fetch scripts' checksums and `ALLOW_CDN = false`. |
| Security 2. No Content-Security-Policy | **Fixed.** Book pages (H-1) and the reader page through the web server (M-6). |
| Security 3. Books can contact other sites | **Fixed.** Cleaning plus a book-page policy; see H-1 and H-2. |
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

> **Fixed in `2e5345f`.** Book pages now get a Content-Security-Policy (with `ALLOW_REMOTE_CONTENT` off) that refuses anything not from the book or the reader's fonts. The cleaning also catches `//host` and backslash forms, tabs and newlines in URLs, and upper-case `URL(` and `@import` without a space. `image-set()` strings and CSS escapes are still left in by the cleaning, but the policy refuses them; the test proves nothing gets through. With `ALLOW_REMOTE_CONTENT` on, there is no book-page policy, by design.

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

> **Fixed in `2e5345f`.** Each built page is now parsed as HTML (exactly as the frame will) before it's cleaned, so `<IMG SRC>`, `<IFRAME>`, `<BASE>`, `<META>` refresh and `<SCRIPT>` are lowercased and handled like any other. `sanitize()`'s `javascript:` check also ignores tabs and newlines (`2e7a63d`).

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

### H-3. Empty files broke chapters read with range requests

> **Fixed in `c5cfe41`.** Empty files now need no read. The test (a stored empty stylesheet, opened with and without range requests) fails on the previous code.

*Bug, reproduced; a regression from L-16.* A zero-length stored file in a book (an empty stylesheet, a
directory entry, an empty file in a comic) made the in-place reader ask the server for the invalid range
`bytes=o-(o-1)`. Servers answer 416, or ignore the header and send the whole file, and the chapter showed
"Couldn't display …: the server stopped answering range requests". The same book worked without range
requests.

## Medium

### M-1. A `%` in `?book=` leaves the reader stuck on "Loading…"

> **Fixed in `46a112b`.** The reference is decoded once; names from addresses tolerate a stray `%`. Tested with `50%off.epub` and a missing `100%-missing.epub`.

*Bug, reproduced.* In `openFromUrl()` (~3777), `decodeURIComponent()` runs before the `try`. `URLSearchParams`
has already decoded the value once, so `?book=50%25off.epub` becomes `50%off.epub`, and decoding again
throws. The error escapes the start block: no book, no sample and no message. The double decoding also
turns `a%2520b` into `a b`.

**Fix:** drop the second decode, or move it inside the `try`.

### M-2. The "not found" check for HTML documents only works for identical pages

> **Fixed in `33813a3`.** Each folder is probed separately, and pages are compared by signature: the requested path and name, and any word containing a digit (times, request ids), are blanked out and spacing is ignored. A "not found" page that differs in other words (for example, one quoting the referring page) could still slip through, but that's rare.

*Bug.* For `?book=…html`, a candidate is rejected only if its text exactly matches one probe for a random
missing file, and that probe result is cached once for the whole session (`soft404()`, ~471). Many real "not
found" pages include the requested path, a time or a request ID. Such a page then opens as the document, and
the `/bookshelf/` location is never tried. EPUB, CBZ, folders and text/Markdown are not affected; they have
structural checks.

**Fix:** compare after removing the requested path and normalising whitespace, and keep the probe per
folder. The test is T-2.

### M-3. Sleep timer can stop right after resuming

> **Fixed in `33813a3`.** Pausing while the timer waits for the passage to end turns the timer off; tested with the clock moved on two minutes.

*Bug.* If reading is paused while the timer shows "Stopping after this passage" (the time is up but the
passage hasn't ended), `sleep.due` stays set:
- Pressing play more than a minute later hits the "a very long passage: stop now" branch of the ticker, and
  reading stops within a second.
- Pressing play sooner stops it after one passage.

**Fix:** clear `sleep.due`, or turn the timer off, when reading is paused or stopped.

### M-4. `fetch-fonts.sh` fails on macOS

> **Fixed in `770c237`.** The id and family are separated by a space, not a GNU-only `\t`. The parsing was tested offline. The full download couldn't be rerun after the change because this session's outbound network failed, and macOS itself wasn't available; the download code is unchanged from the version that worked.

*Bug.* `sed -E "s/…/\1\t\2/"` relies on GNU sed reading `\t` as a tab. BSD/macOS sed writes a `t`. The id/spec
split then fails, the script asks Google for an empty family, and `curl -f` aborts it.

**Fix:** use `awk` or `printf`, or a literal tab via `$'\t'`.

### M-5. French Pocket TTS has no built-in voices

> **Fixed in `590aab6`.** Resolved by E-12: French is no longer offered. It could come back if upstream adds the voices.

*Voices, unconfirmed in the reader.* The French bundle at the pinned revision of `vlapky/pocket-tts-onnx`
has no `voices.bin` (upstream). `fetch-pocket.sh` now skips it rather than failing. But French Pocket TTS
probably can't speak, because pocket-tts-js reports "built-in voices unavailable" without that file. It
wasn't confirmed, because the 1.25 GB model couldn't be downloaded for testing.

**Fix:** confirm on a machine with the French model, then either hide French from Pocket TTS (E-12) or move
to a revision that has the voices.

### M-6. Content-Security-Policy for the reader page

> **Fixed in `2e7a63d`.** `nginx.conf.example` has a reader-page policy (self-hosted version active, CDN version commented). The test site sends exactly the active policy from that file, and all 42 tests pass under it with nothing refused, including real Kokoro and Pocket TTS (`SLOW=1`). The CDN version isn't tested (see T-5).

*Security, defence in depth.* The reader page itself sends no CSP. A header from the web server would limit
where scripts, workers, styles and connections may come from. For example: `script-src 'self' 'unsafe-inline'`
(plus cdnjs/jsDelivr when not self-hosted), `worker-src blob:`, `'wasm-unsafe-eval'` for the voices, and
`connect-src 'self'` (plus Hugging Face when not self-hosted).

This is separate from the book-frame CSP in H-1. It belongs in the web server configuration; see D-2.

### M-7. A failed read inside an archive is remembered until reload

*Verified by reading.* The in-place reader keeps small files it has read (`cache ??= bytes()` in
`lazyZip`). If that read fails (a network blip, or the server answering 200 instead of 206 mid-session), the
failure is kept too, and that file stays broken until the page is reloaded. Uploaded files are now read
lazily as well, so moving, deleting or replacing the file on disk while reading makes later reads fail
(browser behaviour, not tested).

**Fix:** forget a failed read (`cache = bytes().catch(e => { cache = null; throw e; })`), and for uploads,
explain that the file changed on disk and should be reopened.

### M-8. Range requests are not tied to one version of the file

*Partly reproduced.* Nothing ties later range requests to the first one: no `If-Range` with the file's
ETag or Last-Modified, and each reply's `Content-Range` and length aren't checked against what was asked.
The `cache` option passed by `openDefault` applies only to the first request. Replacing a book on the
server while it's open was reproduced: "OEBPS/pic.png: damaged archive". A stored file could instead come
back as silently wrong bytes. Mixing cached and fresh parts after an update is possible but untested.

**Fix:** keep the first reply's ETag or Last-Modified and send `If-Range` with every read; check each
`Content-Range` (start, total) and body length; pass the cache option to every read; on a mismatch, say the
book changed and reopen it.

### M-9. Decompression is not checked against declared sizes, and the small-file cache never empties

*Verified by reading.* Inflated output isn't compared with the size the archive declares, so a
"decompression bomb" (a small entry that inflates to gigabytes) can exhaust memory and crash the tab. The
in-memory cache for files up to 256 KB trusts that declared size and is never emptied, so a comic whose
pages are under 256 KB keeps every page it has shown, undoing the comic image release. JSZip had no limit
either, so the bomb isn't new; the cache growth is.

**Fix:** stream the inflate and stop once output exceeds the declared size (plus a margin), reject length
mismatches, and cache only text files (package, contents, chapters, CSS, SMIL) or use a small LRU.

### M-10. Editing a book without an identifier loses its position

*Verified by reading.* Positions for books without an identifier (L-13) are keyed by a fingerprint of the
whole package file, so any edit (a metadata change in Calibre, a re-export) changes the key. The reader then
falls back to the old title key, which is never updated or removed, and can resume at a stale position. Two
such books with the same title also both pick up that old position once, and old title keys pile up.

**Fix:** remove (or mark) the old title key once it has been carried over, and consider fingerprinting only
the stable parts of the package (title, creator, manifest hrefs, spine order) rather than its whole text.

## Low

### L-1. Relative URLs not in the book request the reader's own site

> **Fixed in `2e5345f`.** References to files a book (from an EPUB file) doesn't contain are removed, and the book-page policy refuses any left. A book opened from a folder can only find out a file is missing by asking its own folder, which the policy allows.

A reference that isn't found in the book (`<img src="missing.png">`) is left as it is and resolves against
the reader's site, so a book can make GET requests to any path there. This is the same site, so it isn't a
privacy leak, but it's unexpected. **Fix:** remove references that aren't found in the book. The CSP in H-1
also covers it.

### L-2. SVG animation could set a remote address

> **Fixed in `2e5345f`.** `<set>` and `<animate>` elements that change an `href` are removed, and the book-page policy refuses remote images anyway.

*Unconfirmed.* `<set attributeName="href" to="https://…"/>` inside an SVG `<image>` could set a remote
address after the static attributes were checked. **Fix:** remove `set` and `animate` elements that target
`href`; the CSP in H-1 also covers it.

### L-3. `verify()` fails open without a SHA-256 tool

> **Fixed in `770c237`.** `verify()` stops with an error when no SHA-256 tool or checksum list is found; `--no-verify` skips the check. Tested with a `PATH` lacking both tools.

With neither `sha256sum` nor `shasum`, the fetch scripts only warn and still report "Done". macOS has
`shasum`, so this mainly matters on minimal Linux images. **Fix:** fail unless `--no-verify` is given.

### L-4. The "no pinned checksum" note uses a substring match

> **Fixed in `770c237`.** Whole paths are compared (awk). Tested with a partial name.

`grep -qF "  $path"` counts `libs/a.js` as pinned if `libs/a.js.map` is listed. It's only a note, but
anchoring the match (whole line ending in the path) would be accurate.

### L-5. `--list` only works as the first argument

> **Fixed in `770c237`.** All three scripts parse options in any order and refuse unknown ones. Tested.

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

> **Fixed in `c992d26`.** EPUBs keep using their identifier. One without an identifier is keyed by a fingerprint of its package file (`spine:pos:opf:…`), and a position saved under the old title key is picked up once. The Information panel says how such a book is kept. Tested with two same-title books without IDs, and with the old key.

Positions are keyed by the book's `uid`, falling back to its title, so two books with no ID and the same
title share one position. **Fix:** fall back to the file name and size, or a hash of the package file.

### L-14. A bad `?book=` link falls back to the sample, not `default.epub`

> **Fixed in `41455c8`.** A bad `?book=` link opens the folder's `default.epub` (or the sample), with the notice about the link. Tested.

When a `?book=` link can't be opened, the reader shows the built-in sample. The folder's default book would
be the better fallback. **Fix:** call `openDefault()` instead of `openSample()` there.

### L-15. The server voice cache key depends on field order

Saved server-voice audio is keyed by a hash of the whole `voices.json` entry, so reordering its fields
would make all saved audio be made again. **Fix:** hash only `ref_audio`, `ref_text`, `seed` and
`cfg_scale`.

### L-16. The whole book file is held in memory

> **Fixed in `ef520ac`.** Archives are read in place: the directory from the end of the file, then each file when needed, through HTTP range requests (books on the site) or `Blob.slice` (uploads), decompressed by the browser. Opening a 5 MB test EPUB fetched about 67 KB. Servers without range support fall back to the whole file. Tested, including narration by hand.

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

### L-19. Parsing a book reports policy violations in the console

> **Fixed in `8ead107`.** `<base>` and `<meta http-equiv>` are removed from the text before any parsing. Remote CSS addresses become `none` rather than `url(about:blank)` (which the policy refused), CSS escapes are decoded before checking, and `image-set()` with a remote entry counts as remote. The hostile-book tests now require zero policy messages: the cleaning alone stops everything.

Under a strict reader policy, the browser applies that policy to the inert documents the reader makes while
reading a chapter's file (`DOMParser`). A book with a `<base>` or remote references therefore logs "violates
the following Content Security Policy directive" messages in the console before the reader has cleaned it.
Nothing is loaded, since inert documents don't fetch and the policy blocks it anyway, but the messages look
alarming. **Fix:** strip `<base>` and similar from the source text before parsing, or accept and document the
noise.

### L-20. A few CSS forms still get past the cleaning (the policy blocks them)

*Reproduced.* These reach the browser, which tries the remote image; the book-page policy refuses it, so
nothing leaves, but a console message appears (the noise L-19 removed for the known cases):
- `image-set()` with nested brackets, such as `linear-gradient(red, rgb(0,0,0))` as one entry, which
  `IMAGE_SET_RE` doesn't match.
- Escaped function names such as `im\61ge-set(…)` and `u\72l(…)`.
- A double escape, `"\00005c\00005chost/x.png"`: `cssUnescape` decodes in two passes and sees
  `\host/x.png`, while the browser reads `\\host/x.png` (another site).

**Fix:** decode escapes in one pass, decode identifiers before matching function names, match `image-set`
to any depth (or replace any `image-set` containing a string), and add these to the hostile test book (T-8).

### L-21. Replacing a missing CSS file with none can drop a whole declaration

*Reproduced.* `cursor: url(missing.cur), pointer` becomes `none, pointer`, which is invalid, so the whole
declaration is dropped instead of falling back to `pointer`. Chrome tolerates it in `@font-face src` lists;
older Safari and Firefox may drop the whole `src`.

**Fix:** use `url("data:,")` for a missing file instead of `none`.

### L-22. Differences between the in-place reader and JSZip

*Verified by reading.*
- Non-UTF-8 file names: the Info-ZIP Unicode Path field (0x7075) is ignored, so a non-ASCII name from an old
  archive can resolve differently than with JSZip, and a picture or chapter goes missing.
- `files` is a plain object: an entry named `__proto__` changes its prototype, and `zip.file('constructor')`
  returns a function.
- `zip.file()` returns directory entries; JSZip returns null for them.
- The end-of-directory search doesn't check that the comment length matches.

**Fix:** `Object.create(null)`, honour 0x7075, return null for directories from `file()`, and check the
comment length.

### L-23. Two requests per file when reading in place

Each file read with range requests takes two sequential requests (its local header, then its data), which
slows picture-heavy chapters and comics on high-latency connections. **Fix:** read the header and data in
one request, using the sizes from the central directory plus a margin for the header's extra field, or read
neighbouring files together.

### L-24. The pre-parse stripping misses some forms of base and meta

*Verified by reading.* `withoutDocumentControls` uses a regex, so `<meta content="a>b" http-equiv=…>` and
a prefixed `<h:base>` survive it. The later sanitizer still removes them, so the only effect is a console
message. **Fix:** a more careful pattern, or accept it.

## Tests

### T-1. The hostile-book test misses most leaks

> **Fixed in `2e5345f`.** The hostile book has every bypass above, aimed at a logging server and a blocked host, and is opened both as an EPUB and as a folder. The test asserts nothing reaches either site, nothing outside the book is requested from this site, the policy is present, and the page stays the book. It fails on the previous code.

`tests/security.test.js` only checks the logging server, not `page.blocked`, and has none of the H-1 and H-2
vectors. It also relies on a fixed 1.5 s wait. **Fix:** add those vectors (pointing at both the logging
server and a blocked host), assert `page.blocked` is empty, and wait for the page's images to settle instead
of a fixed time.

### T-2. The soft-404 test server always returns the same page

> **Fixed in `33813a3`.** The soft-404 page repeats the path and adds a request id and time; an HTML document only under `/bookshelf/` is tested on both servers. It fails on the previous code.

`tests/server.py --soft404` returns the same text for every missing file, so M-2 can't be caught. **Fix:**
add a mode whose "not found" page includes the requested path.

### T-3. Device voices and publisher narration have no tests

Web Speech (device voices) and Media Overlays (publisher narration) were tested by hand earlier, but have no
committed tests. **Fix:** a fake `speechSynthesis` (as used in the earlier manual tests) and a narrated test
book.

### T-4. Real Kokoro and Pocket TTS only run on request

The tests that load the real models run only with `SLOW=1`, and only after their fetch scripts. That's
reasonable given their size; a scheduled run on a machine with the models would catch upstream changes.

### T-5. The CDN version of the reader policy isn't tested

The tests block every other site, so only the self-hosted policy in `nginx.conf.example` is exercised. The
commented CDN version (cdnjs, jsDelivr, Google Fonts, Hugging Face and its download hosts) was written from the
hosts the reader uses but never run. Hugging Face also changes download hosts from time to time. **Fix:** a test
mode that allows those CDNs and sends that policy, run occasionally with network access.

### T-6. The in-place ZIP tests cover only the normal cases

`tests/zip.test.js` checks the normal paths (plus empty files, H-3). Missing: directory entries, a comment
containing the end-record signature, non-UTF-8 names, an inflated size different from the declared one,
ZIP64, encryption and unknown methods (each should fall back), a probe answered 206 with total `*`, a server
that answers 206 then 200, a file changed between requests (M-8), and a transient failure then a retry
(M-7). `tests/server.py`'s range support has no ETag, Last-Modified, `If-Range` or HEAD, and the no-range
server is also the soft-404 server, which mixes two behaviours. **Fix:** add those cases, and give the test
server validators and a separate no-range mode.

### T-7. Position-key tests leave gaps

The identifier test in `tests/urls.test.js` uses a fixed 500 ms wait, and nothing checks that the old title
key is retired or what happens after a book's package file changes (M-10). **Fix:** wait for the saved
position, and add those cases.

### T-8. The hostile test book lacks the remaining CSS forms

The hostile book has none of the L-20 forms (nested or escaped `image-set()` and `url()`, the double
escape), so the zero-policy-messages check doesn't cover them. **Fix:** add them.

## Documentation

### D-1. The README overstates the remote-content protection

> **Fixed in `2e5345f`.** The Features list describes the two layers (cleaning and the policy).

The Features list says books "can't contact other sites". Until H-1 and H-2 are fixed, that's not fully
true. **Fix:** soften the wording, or fix H-1 and H-2.

### D-2. A web server example for the reader

> **Fixed in `2e7a63d`.** `nginx.conf.example` covers types, caching, gzip and the policy; the README has a "Serving the reader" section with a Caddy equivalent.

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

> **Fixed in `590aab6`.** French is gone from Pocket TTS: `POCKET_LANGS`, the option's label (en, de, it, pt, es), `fetch-pocket.sh` (`fr` explains why; `all` leaves it out) and `checksums/pocket.sha256`. French books use device voices. Tested.
If M-5 is confirmed, leave French out of Pocket TTS's languages so readers aren't offered a voice that can't
speak.

## Suggested order

Open items, roughly in order:

1. **M-7, M-8, M-9 with T-6:** make the in-place ZIP reader robust (failed reads, file changes, sizes and
   memory), with tests for the edge cases.
2. **M-10 with T-7:** retire old position keys, and make the package fingerprint survive metadata edits.
3. **L-20, L-21 with T-8:** the remaining CSS forms, and `url("data:,")` for missing files.
4. **L-22 and L-23:** in-place reader compatibility, and fewer requests.
5. **T-5:** test the CDN version of the reader policy.
6. **L-12, L-15, L-17, L-18, T-3, D-3** and the enhancements, as wanted.
