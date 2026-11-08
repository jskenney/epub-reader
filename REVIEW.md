# Code and security review

Review of the repository (2026-11-08, updated after round 4): `index.html` (about 4,100 lines), the fetch scripts,
`tools/make-checksums.py`, `nginx.conf.example` and the test suite in `tests/`. It replaces the earlier
review documents. Open items keep their IDs from those documents; new findings are numbered after the
highest earlier ID in each group. Fixed items are listed under [Resolved](#resolved) with their commits.

## Method

**Round 3** (commits `7c5c55c` to `630738a`) fixed M-7, M-8, M-9, L-12, L-15, L-20 to L-24, T-6, T-8 and D-3.
An independent review of those commits found:
- **H-4,** an exponential regex that could freeze the page on ordinary CSS. Fixed in `87cd424`.
- **L-25 to L-28 and T-9.**

**Round 4** (commits `432deba` to `b834226`) fixed M-10, T-7, L-25, L-26, L-27, L-28 and T-9. A second
independent review of those commits found:
- **H-5,** another exponential regex, in the pattern that strips `<base>` and `<meta>` before parsing. An
  unclosed tag of about 130 bytes froze the tab. It is now a linear scanner (`78a8a9e`).
- **Desyncs in the CSS normalizer** that reopened some L-25 forms (escaped `url(`, `\)`, CR and FF in strings,
  long whitespace after `url(`), and two `@import` forms. All fixed in `78a8a9e`.
- **Position-key collisions.** Books with the same title and file names but different text shared one
  position. A newly given identifier also deleted the position of a copy without one. Both fixed in
  `78a8a9e`.
- **Clip versions** for saved server-voice audio could be stale or keep changing. Fixed in `78a8a9e`.
- **What is left** is recorded as L-29 to L-31 and T-10.

Each reviewer was given the code and what the changes were for, but not the author's conclusions. Each
finding was checked again before it was recorded. *Reproduced* means confirmed in Chromium or Node against
the real code; *read* means confirmed by reading the code only.

**Tests.** All 69 tests pass. Two more, which load the real Kokoro and Pocket TTS models, need `SLOW=1`.
Each fix in rounds 3 and 4 has a test, apart from the cases in T-10. Most were run against the code before
the fix and failed there; the round 4 HTML test hangs the old pre-parse code. The suite now also covers:
- Same-size book replacements, on servers with strong, weak or no validators.
- Padding after the archive, malformed Unicode Path fields, and oversized entries.
- Position keys across metadata edits, older keys and newly given identifiers.
- Clips outside the voices folder, re-recorded clips, and the versions pinned in `index.html` and the fetch
  scripts.

**Labels.** Each item has an ID you can ask for by name (for example, "fix L-29 and T-10").

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

No critical, high or medium items are open. The open items are low:
- **Defence in depth.** The CSS cleaning is still pattern-based (L-29); the book-page policy is the backstop.
- **Small differences from JSZip** in what the in-place reader accepts (L-30).
- **Small leftovers** in position keys and voice clips (L-31).
- **Older small leaks and quirks.**

## Open items

| ID | Title | Area |
|---|---|---|
| [L-6](#l-6-fetch-fontssh-is-trust-on-first-use) | `fetch-fonts.sh` is trust-on-first-use | Fetch scripts |
| [L-7](#l-7-kokoros-local-first-fetch-shim-is-weaker-than-realfile) | Kokoro's local-first fetch shim is weaker than `realFile()` | Voices |
| [L-8](#l-8-worker-blob-urls-are-never-revoked) | Worker blob URLs are never revoked | Memory |
| [L-9](#l-9-reading-pace-state-isnt-reset-for-a-new-book) | Reading-pace state isn't reset for a new book | Bug |
| [L-10](#l-10-zipsources-blob-url-list-keeps-growing) | `zipSource`'s blob URL list keeps growing | Memory |
| [L-11](#l-11-a-book-element-with-idspine-end-breaks-page-counting) | A book element with `id="spine-end"` breaks page counting | Robustness |
| [L-17](#l-17-single-letter-shortcuts-clash-with-screen-readers) | Single-letter shortcuts clash with screen readers | Accessibility |
| [L-18](#l-18-tts-server-ports-are-open-to-the-network) | TTS server ports are open to the network (server repo) | Security |
| [L-29](#l-29-the-css-cleaning-is-still-pattern-based) | The CSS cleaning is still pattern-based | Privacy / defence in depth |
| [L-30](#l-30-the-in-place-reader-is-stricter-than-jszip-in-two-ways) | The in-place reader is stricter than JSZip in two ways | Compatibility |
| [L-31](#l-31-position-key-and-voice-clip-leftovers) | Position-key and voice-clip leftovers | Bug / voices |
| [T-3](#t-3-device-voices-and-publisher-narration-have-no-tests) | Device voices and publisher narration have no tests | Tests |
| [T-4](#t-4-real-kokoro-and-pocket-tts-only-run-on-request) | Real Kokoro and Pocket TTS only run on request | Tests |
| [T-5](#t-5-the-cdn-version-of-the-reader-policy-isnt-tested) | The CDN version of the reader policy isn't tested | Tests |
| [T-10](#t-10-cases-checked-only-by-script) | Cases checked only by script | Tests |
| [E-1](#e-1-footnote-pop-ups) to [E-11](#e-11-a-settings-panel) | Enhancements | — |

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

### L-29. The CSS cleaning is still pattern-based

*Read* (new). After each fix the reviewers found new forms. Every one was caught by the book-page policy:
nothing left the site, but each logged a console message. The cleaning now:
- Makes the CSS plain first: comments, line continuations, escaped names.
- Then matches addresses with patterns.

A form that gets past both steps is still refused by the policy. One exception: with `ALLOW_CDN` on, the
policy's `style-src` allows fonts.googleapis.com, so an `@import` from there would load.

**Fix:** tokenize CSS once, following the CSS Syntax spec, and check `url` tokens, `@import` preludes and
`image-set` strings on the tokens.

### L-30. The in-place reader is stricter than JSZip in two ways

*Read* (new).
- **Checksums.** Every file read in place is checked against its CRC-32 (this is how L-26 catches same-size
  replacements). JSZip doesn't check by default. An archive with wrong checksums that opened before now fails
  on those files, saying "damaged archive, or the book changed".
- **Size cap.** The 512 MB cap on a single file applies only in place. The whole-file JSZip path, used when
  the server doesn't answer ranges, has none.

**Fix:** accept the first difference, as damaged archives are rare and the message is clear. Apply the cap in
the JSZip path too.

### L-31. Position-key and voice-clip leftovers

*Read* (new).
- **Last chapter edited.** A book without an identifier whose last chapter is edited gets a new key (the key
  includes that chapter's text, so different books with the same title and file names stay apart), and starts
  again from the beginning.
- **Old keys not cleaned up.** Older keys are moved over only while the current key has no position. Once it
  has one, any older keys stay in storage.
- **Waiting on HEAD requests.** The voice list waits for one HEAD request per voice (each up to 8 s) before
  server voices can be used. With many voices on a slow server, that wait can be noticeable.

**Fix:** a "position moved" fallback that tries the key without the chapter text when the full key has
nothing. Clean up older keys once the current one exists. Read only the selected voice's clip version, later.

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

### T-10. Cases checked only by script

New. Some cases are checked with Node scripts against the real functions, but have no committed test:
- **CR and FF in CSS strings:** XHTML can't contain these characters.
- **A refused or failed HEAD request for a voice clip.**
- **The checksum on files over 32 MB:** checked on first read only.
- **A 416 reply** on its own (the replacement test may meet a total-size mismatch first).

**Fix:** a CSS unit test page served as HTML, a test-server switch that refuses HEAD, and a 416 case.

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

1. **L-29:** a CSS tokenizer, to end the run of pattern bypasses for good.
2. **L-31 and T-10:** small leftovers, with tests.
3. **L-7 to L-11:** small fixes, quick to do together.
4. **L-30, T-5, T-3, L-17, L-6** and the enhancements, as wanted.

## Resolved

From all reviews so far, with the commits that fixed them.

| ID | Title | Fixed in |
|---|---|---|
| H-1 | Remote-content stripping could be bypassed; book pages now get a Content-Security-Policy | `2e5345f` |
| H-2 | Uppercase XHTML tags got past the sanitizer | `2e5345f` |
| H-3 | Empty files broke chapters read with range requests | `c5cfe41` |
| H-4 | Runs of CSS hex escapes (common for CJK font names) froze the page: exponential regex in `plainFunctionNames` (a regression from L-20, found in this review) | `87cd424` |
| H-5 | Unclosed `<base`/`<meta` tags with `= a` pairs froze the page: exponential regex in the pre-parse stripping (a regression from L-24, found in round 4) | `78a8a9e` |
| M-1 | A `%` in `?book=` left the reader stuck on "Loading…" | `46a112b` |
| M-2 | The "not found" check for HTML documents only worked for identical pages | `33813a3` |
| M-3 | The sleep timer could stop right after resuming | `33813a3` |
| M-4 | `fetch-fonts.sh` failed on macOS | `770c237` |
| M-5 | French Pocket TTS had no built-in voices (upstream; French removed) | `590aab6` |
| M-6 | No Content-Security-Policy for the reader page itself | `2e7a63d` |
| M-7 | A failed read inside an archive was remembered until reload (also in resource URLs and the shown chapter) | `7c5c55c` |
| M-8 | Range requests weren't tied to one version of the file; now `If-Range` and reply checks | `7c5c55c` |
| M-9 | Decompression wasn't checked against declared sizes, and the small-file cache never emptied | `7c5c55c` |
| M-10 | Editing a book without an identifier lost its position; keys now use title, chapter files and last chapter text | `432deba`, `78a8a9e` |
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
| L-25 | More CSS forms got past the cleaning (comments, line continuations, escaped at-rules, desyncs) | `37b6f2f`, `78a8a9e` |
| L-26 | Range-request checks had gaps with weak or missing validators; now kind-with-kind checks and checksums | `888f900` |
| L-27 | In-place ZIP reader leftovers: padding, Unicode Path bounds, size cap | `888f900` |
| L-28 | Server voice details: instruction fallback, clip version in the key, values as sent | `aceea22`, `78a8a9e` |
| T-1 | The hostile-book test missed most leaks | `2e5345f` |
| T-2 | The soft-404 test server always returned the same page | `33813a3` |
| T-6 | The in-place ZIP tests covered only the normal cases | `7c5c55c` |
| T-8 | The hostile test book lacked the remaining CSS forms | `4632330` |
| T-7 | Position-key tests left gaps | `432deba`, `78a8a9e` |
| T-9 | Gaps left after round 3 (same-size replacement, ZIP cases, pre-parse test, SRI check) | `888f900`, `37b6f2f`, `78a8a9e` |
| D-1 | The README overstated the remote-content protection | `2e5345f` |
| D-2 | No web server example for the reader | `2e7a63d` |
| D-3 | No upgrade checklist for pinned versions | `630738a` |
| E-12 | Hide French from Pocket TTS until it works | `590aab6` |
