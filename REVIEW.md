# Code and security review

Third review of the repository (2026-11-08): `index.html` (about 4,100 lines), the fetch scripts,
`tools/make-checksums.py`, `nginx.conf.example` and the test suite in `tests/`. It replaces the earlier
review documents. Open items keep their IDs from those documents; new findings are numbered after the
highest earlier ID in each group. Fixed items are listed under [Resolved](#resolved) with their commits.

## Method

This round fixed M-7, M-8, M-9, L-12, L-15, L-20 to L-24, T-6, T-8 and D-3 (commits `7c5c55c` to `630738a`).
An independent reviewer then went over those commits. It was given the code and what the changes were for,
but not the author's conclusions. Each finding was checked again before it was recorded.

- One finding was a serious regression, H-4: an exponential regex that could freeze the page on ordinary
  CSS. It was reproduced and fixed in `87cd424`, together with four smaller findings.
- The other findings are recorded below as L-25 to L-28 and T-9.
- *Reproduced* means the finding was confirmed in Chromium or Node against the real code. *Read* means it was
  confirmed by reading the code only.

**Tests.** All 61 tests pass. Two more, which load the real Kokoro and Pocket TTS models, need `SLOW=1`.
The suite now covers:
- Unusual archives: directory entries, comments, long local extra fields, Unicode names, a decompression
  bomb, ZIP64, an unknown compression method, empty entries.
- Failures while reading: a server that stops answering range requests, a book replaced on the server, an
  uploaded file changed on disk.
- Every CSS form found so far, with no Content-Security-Policy message allowed.
- Voice clip paths, and the saved-audio key.
- That the versions pinned in `index.html` and in the fetch scripts agree.

**Labels.** Each item has an ID you can ask for by name (for example, "fix L-25 and T-9").

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

No critical or high items are open. One medium item is open (M-10). It concerns the reading position of
books without an identifier, after their package file is edited.

The low items fall into three groups:
- Console noise. A few CSS forms still get past the cleaning. The book-page policy refuses them, so nothing
  leaves the site.
- Rare cases in the in-place ZIP reader and the range-request checks.
- Older small leaks and quirks.

## Open items

| ID | Title | Area |
|---|---|---|
| [M-10](#m-10-editing-a-book-without-an-identifier-loses-its-position) | Editing a book without an identifier loses its position | Bug |
| [L-6](#l-6-fetch-fontssh-is-trust-on-first-use) | `fetch-fonts.sh` is trust-on-first-use | Fetch scripts |
| [L-7](#l-7-kokoros-local-first-fetch-shim-is-weaker-than-realfile) | Kokoro's local-first fetch shim is weaker than `realFile()` | Voices |
| [L-8](#l-8-worker-blob-urls-are-never-revoked) | Worker blob URLs are never revoked | Memory |
| [L-9](#l-9-reading-pace-state-isnt-reset-for-a-new-book) | Reading-pace state isn't reset for a new book | Bug |
| [L-10](#l-10-zipsources-blob-url-list-keeps-growing) | `zipSource`'s blob URL list keeps growing | Memory |
| [L-11](#l-11-a-book-element-with-idspine-end-breaks-page-counting) | A book element with `id="spine-end"` breaks page counting | Robustness |
| [L-17](#l-17-single-letter-shortcuts-clash-with-screen-readers) | Single-letter shortcuts clash with screen readers | Accessibility |
| [L-18](#l-18-tts-server-ports-are-open-to-the-network) | TTS server ports are open to the network (server repo) | Security |
| [L-25](#l-25-a-few-more-css-forms-get-past-the-cleaning-the-policy-blocks-them) | A few more CSS forms get past the cleaning (the policy blocks them) | Privacy / noise |
| [L-26](#l-26-range-request-checks-have-gaps-with-weak-or-missing-validators) | Range-request checks have gaps with weak or missing validators | Robustness |
| [L-27](#l-27-in-place-zip-reader-leftovers) | In-place ZIP reader leftovers | Robustness / memory |
| [L-28](#l-28-server-voice-details) | Server voice details | Voices |
| [T-3](#t-3-device-voices-and-publisher-narration-have-no-tests) | Device voices and publisher narration have no tests | Tests |
| [T-4](#t-4-real-kokoro-and-pocket-tts-only-run-on-request) | Real Kokoro and Pocket TTS only run on request | Tests |
| [T-5](#t-5-the-cdn-version-of-the-reader-policy-isnt-tested) | The CDN version of the reader policy isn't tested | Tests |
| [T-7](#t-7-position-key-tests-leave-gaps) | Position-key tests leave gaps | Tests |
| [T-9](#t-9-gaps-left-after-this-round) | Gaps left after this round | Tests |
| [E-1](#e-1-footnote-pop-ups) to [E-11](#e-11-a-settings-panel) | Enhancements | — |

## Medium

### M-10. Editing a book without an identifier loses its position

*Read.* Positions for books without an identifier are keyed by a fingerprint of the whole package file.
Any edit (a metadata change in Calibre, a re-export) therefore changes the key. The reader then falls back
to the old title key, which is never updated or removed, and can resume at a stale position. Two such books
with the same title also both pick up that old position once, and old title keys pile up.

**Fix:**
- Remove (or mark) the old title key once it has been carried over.
- Consider fingerprinting only the stable parts of the package (title, creator, manifest hrefs, spine order)
  rather than its whole text.

## Low

### L-6. `fetch-fonts.sh` is trust-on-first-use

Google's font files can't be pinned in advance. The first download is recorded in `fonts/SHA256SUMS`, and
later runs compare against it. A changed file is reported and fetched again, but the run doesn't fail. This
is by design.

**Fix:** a `--strict` option could make a mismatch fail instead.

### L-7. Kokoro's local-first fetch shim is weaker than `realFile()`

The worker's shim rejects only `text/html` replies. A "not found" reply with another content type is handed
to the model loader instead of falling back to the pinned CDN revision, and fails with an obscure error.

**Fix:** also reject replies that start with `<`, as `realFile()` does.

### L-8. Worker blob URLs are never revoked

The Kokoro and Pocket TTS workers are created from blob URLs that are never revoked: a tiny leak on each
load attempt.

**Fix:** revoke the URL once the worker has started.

### L-9. Reading-pace state isn't reset for a new book

`pace.lastTurn` and `pace.samples` carry over when a new book opens, so the first page turn may be paired
with the previous book's timestamp. The bounds checks filter out most of this.

**Fix:** reset them in `startBook()`.

### L-10. `zipSource`'s blob URL list keeps growing

As comic sections are revisited, revoked blob URLs stay in `zipSource`'s list until the book closes. The
memory is freed; only the list grows.

**Fix:** remove entries when they are revoked.

### L-11. A book element with `id="spine-end"` breaks page counting

A book element with that id comes before the reader's own end marker, so `geom()` counts pages wrongly.

**Fix:** use an unguessable id, or keep a direct reference to the marker.

### L-17. Single-letter shortcuts clash with screen readers

C, F, T, L, I, R and / are global shortcuts, which can conflict with screen readers' browse-mode keys.

**Fix:** a setting (and a `reader-config.json` key) to turn them off.

### L-18. TTS server ports are open to the network

*In jskenney/epub-reader-tts-server.* Breeze (port 7860) and the studio (7861) listen on all interfaces, by
choice. Anyone who can reach those ports can use the GPU without a password. The studio also lets them
delete voices and upload files of up to 1 GB.

**Fix:** a firewall rule that allows only the proxy host.

### L-25. A few more CSS forms get past the cleaning (the policy blocks them)

*Reproduced* (new). With remote content off, these still reach the browser. The book-page policy refuses
them, so nothing leaves the site, but each one logs a console message:
- A line continuation (`\` and a newline) inside a quoted address, as in `url("https://host/a\⏎.png")` or
  `@import "https://host/a\⏎.css"`. `URL_RE` and the `@import` pattern don't cross newlines.
- An escaped at-keyword: `@\69mport "https://host/a.css"`. Escaped names are decoded only before `(`.
- A quote inside a comment in `image-set()`: `image-set(/*"*/"https://host/a.png" 1x)`. Comments aren't
  skipped, so strings are paired wrongly.
- A `<base>` or `<meta http-equiv>` tag with more than 200 attribute tokens. The pre-parse pattern is bounded
  so that it stays fast. The sanitizer still removes these tags after parsing.

**Fix:**
- Remove `/* */` comments before rewriting, leaving strings alone.
- Let the address patterns accept `\` followed by a newline inside strings (or tokenize the CSS properly).
- Decode escapes in at-keywords.
- Add these cases to the hostile test book.

### L-26. Range-request checks have gaps with weak or missing validators

*Read* (new).
- **Same-second replacement.** If a server sends only a weak ETag (or no ETag) plus Last-Modified, `If-Range`
  falls back to the date. A file replaced within the same second, at the same size, still matches, so parts
  of two versions could be mixed. With no validators at all, a replacement of the same size is never
  noticed. (A different size is caught by the total-size check.)
- **False "changed" report.** In the 200 branch, the reply's validator falls back to a different kind than
  the stored one. If the first reply had a weak ETag (so the date was stored) and a later 200 carries a
  strong ETag, the reader says the book changed when the server only stopped answering range requests.
- **416 reply.** A 416 reply (for example, the file became shorter) is reported as "stopped answering
  range requests" rather than "changed".

**Fix:** compare ETag with ETag and date with date; treat 416 as changed; consider a final whole-file CRC
check when there are no strong validators.

### L-27. In-place ZIP reader leftovers

*Reproduced in Node* against the extracted `lazyZip` and JSZip (new).
- **Bytes after the end record.** These now fail the comment-length check, so the reader falls back to
  downloading the whole file (or reading the whole upload into memory). The book still reads, but more
  slowly. **Fix:** accept trailing padding, and reject only a fake record found inside a comment.
- **Unicode Path field (0x7075).** The parser doesn't check that the field fits inside the extra data.
  It also overrides a name already flagged as UTF-8 (flag 0x800); JSZip uses the field only when that flag
  isn't set. This only matters for malformed archives. **Fix:** check the bounds, and respect the flag.
- **Very large declared sizes.** The bomb guard catches entries that inflate past their declared size. An
  entry that honestly declares about 4 GB still inflates until the tab runs out of memory. JSZip had no limit
  either. **Fix:** cap the declared size (for example at 512 MB) and report larger entries clearly.

### L-28. Server voice details

*Read* (new).
- **Bad clip path.** A voice whose `ref_audio` is outside the voices folder is left out even when it also
  has an `instruction` it could use instead.
- **Re-recorded clips.** Saved audio is keyed by the clip's path, not its contents, so a clip re-recorded
  under the same name replays the old saved audio. This was already the case before this round. Clear the
  saved audio in the Voice panel after re-recording.
- **Non-numeric values.** A `cfg_scale` or `seed` that isn't a number becomes `NaN` in the key, so two
  different values could share saved audio.

**Fix:** fall back to the instruction; include the clip's size or ETag in the key; use the strings as sent.

## Tests

### T-3. Device voices and publisher narration have no tests

Web Speech (device voices) and Media Overlays (publisher narration) were tested by hand earlier, but have no
committed tests.

**Fix:** a fake `speechSynthesis` (as used in the earlier manual tests) and a narrated test book.

### T-4. Real Kokoro and Pocket TTS only run on request

The tests that load the real models run only with `SLOW=1`, and only after their fetch scripts have run.
That's reasonable given the models' size; a scheduled run on a machine with the models would catch upstream
changes.

### T-5. The CDN version of the reader policy isn't tested

The tests block every other site, so only the self-hosted policy in `nginx.conf.example` is exercised. The
commented CDN version (cdnjs, jsDelivr, Google Fonts, Hugging Face and its download hosts) was never run, and
Hugging Face changes its download hosts from time to time.

**Fix:** a test mode that allows those CDNs and sends that policy, run occasionally with network access.

### T-7. Position-key tests leave gaps

The identifier test in `tests/urls.test.js` uses a fixed 500 ms wait. Nothing checks that the old title key
is retired, or what happens after a book's package file changes (M-10).

**Fix:** wait for the saved position, and add those cases.

### T-9. Gaps left after this round

New.
- **Replacement test.** The test for a book replaced on the server swaps in a file of a different size, so
  the size check catches it. The `If-Range` path for a same-size replacement isn't tested. No test server
  sends a weak ETag or no validators (L-26).
- **ZIP cases.** No test covers bytes after the end record or a malformed Unicode Path field (L-27).
- **Pre-parse stripping.** The patterns for `<base>` and `<meta>` were checked with a script (unquoted values
  containing quotes, `<base-card>`, long unclosed tags) but have no committed test. The hostile book is
  XHTML, so it can't hold unquoted attributes.
- **Pin test.** It doesn't compare `integrity` in `LIBS` with the files in `libs/` when they are present.
- **L-25 cases.** None of the forms in L-25 are in the hostile book.

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
Save positions (and later bookmarks) on your server, so each device picks up where the last one left off.

### E-8. Install as an offline app
A web app manifest and service worker, so the reader can be installed and open saved books offline.

### E-9. Right-to-left manga
Use ComicInfo's `Manga` value to show comic pages right to left, including spreads.

### E-10. Audiobook export
Render a chapter or book with the server voice into an `.m4b` with chapter markers (deferred earlier).

### E-11. A settings panel
A panel in the page for the options that are now only in `index.html` or `reader-config.json`: look-ahead,
saved-audio limit, remote content, shortcuts and so on.

## Suggested order

1. **M-10 with T-7:** retire old position keys, and make the package fingerprint survive metadata edits.
2. **L-25:** the remaining CSS forms, for a quiet console.
3. **L-26, L-27 with T-9:** the remaining range-request and ZIP edge cases, with tests.
4. **L-28, L-7 to L-11:** small fixes, quick to do together.
5. **T-5, T-3, L-17, L-6** and the enhancements, as wanted.

## Resolved

From all reviews so far, with the commits that fixed them.

| ID | Title | Fixed in |
|---|---|---|
| H-1 | Remote-content stripping could be bypassed; book pages now get a Content-Security-Policy | `2e5345f` |
| H-2 | Uppercase XHTML tags got past the sanitizer | `2e5345f` |
| H-3 | Empty files broke chapters read with range requests | `c5cfe41` |
| H-4 | Runs of CSS hex escapes (common for CJK font names) froze the page: exponential regex in `plainFunctionNames` (a regression from L-20, found in this review) | `87cd424` |
| M-1 | A `%` in `?book=` left the reader stuck on "Loading…" | `46a112b` |
| M-2 | The "not found" check for HTML documents only worked for identical pages | `33813a3` |
| M-3 | The sleep timer could stop right after resuming | `33813a3` |
| M-4 | `fetch-fonts.sh` failed on macOS | `770c237` |
| M-5 | French Pocket TTS had no built-in voices (upstream; French removed) | `590aab6` |
| M-6 | No Content-Security-Policy for the reader page itself | `2e7a63d` |
| M-7 | A failed read inside an archive was remembered until reload (also in resource URLs and the shown chapter) | `7c5c55c` |
| M-8 | Range requests weren't tied to one version of the file; now `If-Range` and reply checks | `7c5c55c` |
| M-9 | Decompression wasn't checked against declared sizes, and the small-file cache never emptied | `7c5c55c` |
| L-1 | Relative URLs not in the book requested the reader's own site | `2e5345f` |
| L-2 | SVG animation could set a remote address | `2e5345f` |
| L-3 | `verify()` failed open without a SHA-256 tool | `770c237` |
| L-4 | The "no pinned checksum" note used a substring match | `770c237` |
| L-5 | `--list` only worked as the first argument | `770c237` |
| L-12 | Voice clip URLs weren't restricted to the voices folder | `c24dd62`, `87cd424` |
| L-13 | Books without an ID shared reading positions by title | `c992d26` |
| L-14 | A bad `?book=` link fell back to the sample, not `default.epub` | `41455c8` |
| L-15 | The server voice cache key depended on field order | `c24dd62` |
| L-16 | The whole book file was held in memory; books are now read in place | `ef520ac` |
| L-19 | Parsing a book reported policy violations in the console | `8ead107` |
| L-20 | CSS forms got past the cleaning (nested and escaped `image-set()`/`url()`, double escapes) | `4632330`, `87cd424` |
| L-21 | Replacing a missing CSS file with `none` could drop a whole declaration; now `url(data:,)` | `4632330`, `87cd424` |
| L-22 | Differences between the in-place reader and JSZip | `7c5c55c` |
| L-23 | Two requests per file when reading in place | `7c5c55c` |
| L-24 | The pre-parse stripping missed some forms of `<base>` and `<meta>` | `4632330`, `87cd424` |
| T-1 | The hostile-book test missed most leaks | `2e5345f` |
| T-2 | The soft-404 test server always returned the same page | `33813a3` |
| T-6 | The in-place ZIP tests covered only the normal cases | `7c5c55c` |
| T-8 | The hostile test book lacked the remaining CSS forms | `4632330` |
| D-1 | The README overstated the remote-content protection | `2e5345f` |
| D-2 | No web server example for the reader | `2e7a63d` |
| D-3 | No upgrade checklist for pinned versions | `630738a` |
| E-12 | Hide French from Pocket TTS until it works | `590aab6` |
