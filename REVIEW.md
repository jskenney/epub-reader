# Code and security review

Review of the repository (2026-11-10, round 20): `index.html` (about 6,300 lines), the fetch scripts,
`tools/make-checksums.py`, `nginx.conf.example`, `.github/workflows/slow.yml`, the README and the test suite in
`tests/`. Open items keep their IDs from earlier versions; new findings are numbered after the highest earlier ID
in each group. Fixed items are listed under [Resolved](#resolved) with their commits.

## Method

Round 7 was a full review of the whole repository by four independent reviewers. Round 8 (`4266cd2` to
`152c4f8`) fixed what it found that was asked for: T-12, H-6, H-7, M-13 to M-20 and L-38 to L-59.

Two independent reviewers then went over round 8's commits: one on the book pipeline and loading, one on
reading aloud, settings, the scripts and the nginx example. Each was given the code and what the changes were
for, but not the author's conclusions. Their findings were reproduced again and fixed in `f8ed09c` and
`84bc895`:
- **H-8:** markup that reads back differently once serialized ("mutation") brought back uncleaned content.
- **H-9:** a font pasted in as `data:` into every style that named it made pages of hundreds of MB.
- **M-21 and M-22.**
- **L-60 to L-67,** including two regressions from round 8's path work.

All of these are in the Resolved table.

Round 9 (`90a6b6f` to `614e88c`) fixed L-68, L-69, L-70 and D-4. An independent review of it found that the
L-68 announcements were not repeated when the bar was reopened and swallowed changes that differ only in
numbers (L-71), and a few inaccurate sentences (D-5): the gzip note, which files each fetch script reads, and
`FULL_PRECISION` for Kokoro on WebGPU. Both were fixed in `7a86a5f`.

Round 10 (`a29374c`) added E-16: without a `?book=` link, the reader opens `default.epub`, else `default.md`
(`DEFAULT_BOOK` is now an ordered list). The new code uses the same "not found" page checks as `?book=` links,
and is tested on a server with real 404s and on one that answers every missing file with a 200 page. No
independent review was run for this round.

Round 11 was a full review by three independent reviewers: one on opening and building books, one on reading
aloud, settings and the interface, and one on the scripts, the nginx example, the workflow, the README and the
tests. Each was given the code and the areas to cover, not the author's conclusions. No critical or high items
were found. What was fixed (`7a0abfb` to `961118e`):
- **Medium:** M-23 to M-27.
- **Low items that kept a book or a voice from working:** L-72, L-73, L-75 and L-80 to L-83.
- **Tests:** T-18. **Documentation:** D-6.

The other low items, T-19 and D-7 were left open then (all since resolved).

Two more independent reviewers then went over those commits: one on the loading changes, one on the read-aloud
changes and the new tests. They found two medium regressions and a few low gaps, fixed in `c28c12d` and
`1ba12ab`, each with a test that fails on the code before it:
- **M-28:** the new decoding (M-26) trusted a stale declared encoding over text that is valid UTF-8.
- **M-29:** the new look-ahead (M-23) took a chapter that failed to load once as having no text, and skipped it.
- **L-90 to L-97:** smaller gaps in the same changes (see Resolved).
L-98, L-99 and T-20 were left open (L-98 and L-99 since resolved).

A third review, of `c28c12d` and `1ba12ab`, found two more medium regressions, fixed in `d82fa29` with tests that
fail on the code before it:
- **M-30:** a server's `charset=utf-8` (which nginx.conf.example adds to `.md`) overrode the Windows-1252
  fallback, so old Latin-1 text and Markdown opened by link turned into replacement characters.
- **M-31:** reading aloud into a chapter that couldn't be loaded stayed "playing" with nothing to play, and saved
  the failed chapter as the position while the page still showed the one before.
- **L-100 to L-103:** smaller gaps (see Resolved).

A fourth and last review, of `d82fa29`, found one more medium regression, fixed in `847488f` with tests that fail
on the code before it:
- **M-32:** after M-31, paging couldn't get past a chapter that can't be shown.
- **L-104 to L-106:** smaller gaps (see Resolved).

L-107 and L-108 were left open (since resolved). `847488f` itself hasn't had an independent review: this round was limited to four
passes of review and fixes.

Round 12 built E-10, audiobook export (`1b3516b`, `de3a70d`, `179e3bf`). Two independent reviewers then went over
it: one on the files it writes and the encoding, one on the dialog, the flow and how it fits the rest of the
reader. Their findings were reproduced and fixed in `9d10dc0` and `ed1aa5e`, with tests:
- **C-1:** any file of more than about 22 minutes failed to save once all its audio had been made.
- **H-10, H-11:** no chapters in Apple's players; a long book held in memory as a million small arrays.
- **M-33 to M-42, L-109 to L-129** (see Resolved).
Round 13 (`ed36ce1` to `4d65017`) fixed the open low items that could be fixed (L-74, L-76 to L-79, L-84 to L-89,
L-98, L-99, L-107, L-108, L-113, L-119, L-129), and T-13, T-15, T-17, T-19 and D-7, each with a test where it can
have one. T-15's suggestion to bind the test server to 127.0.0.1 was left out, as for the voice server.

Round 14 was another full review by three independent reviewers (books and pages; reading aloud, the export and
the interface; the scripts, tests and documents), of `08d645a`. Fixed in `0def7a5` and `ce5efe6`:
- **High:** H-12 (a Pocket export hung for good when a book in another language opened) and H-13 (a voice away
  for 15 seconds stopped an hours-long export; shorter outages left sentences silent).
- **Medium:** M-43 to M-51. Two were holes in the cleaner (M-43, M-44) that the book page's own policy still
  held: nothing reached another site.
- **Low, tests, documentation:** L-130 to L-148, T-22 to T-26, D-8 and D-9.
L-138 and L-149 were fixed after it, with T-14, in `2baae6a`. H-12 and two of the lows were checked by reading.
L-18 (a TTS server issue) was removed in round 6 as belonging to that server's repository.

Round 16 was a review of rounds 14 and 15's fixes by two independent reviewers (`08d645a..8a3ae13`). Fixed in
`74c9765` and `f38b008`, with tests that fail on the code before them except where noted:
- **High:** H-14 (addresses still got past the CSS cleaner through substitutions: an unclosed `image-set(var(…)`,
  `url("…" var(--e))`, `if()`; the book policy held) and H-15 (the new check was quadratic: a small sheet froze the
  tab).
- **Medium:** M-52 to M-57 (paging dead after a failed render; search re-reading the whole book; the export's new
  wait stopping on a 500 for one text, wasting the wait on a crashed voice, ignoring Cancel and Pause, and counting
  only its sleeps).
- **Low:** L-150 to L-162.

Round 17 was an adversarial review of the whole CSS cleaner, and a review of round 16's other fixes. The cleaner
review found no live bypass in Chromium 153 across every form tried (escapes, every place an address can appear,
substitutions, pasted sheets, the hoisting, `</style`, timing traps); one latent gap, URL-typed `attr()`, is closed
in `95d266b`. The other review found two medium bugs (M-58, M-59) and seven low ones (L-164 to L-170), fixed in
`a2dabfe`.

Round 18 reviewed round 17's fixes and found only low items (L-171 to L-173), fixed in `1f4e9d8` and `44f1b2d`. With only
low items left in that review, and the CSS cleaner holding under an adversarial review in round 17, the
review-and-fix loops stopped there (six of the ten allowed). The tests drive the export with a stand-in AAC encoder (the test
browser has none) that hands out real AAC frames from ffmpeg, and check the files with ffprobe and ffmpeg.

Round 19 added E-17 (`2c7386b`, `895bafa`): `.opus` and `.mp3` as well as `.m4b`, with the formats this
browser can't make greyed out. It came after a user report that every Chrome and Edge said it couldn't make AAC
(M-60, fixed in `06e77ed`). Two independent reviewers then went over it: one on the files written (Ogg pages,
Opus headers and tags, ID3 frames, lamejs output), checked with ffprobe, mutagen, an Ogg page parser and an ID3
frame dumper; one on the dialog, the export flow and the lamejs loading. Neither found critical or high items.
What they found was fixed in `8af5e59` and `0a4902b`, each with a test that fails on the code before it except
where marked *read*:
- **Medium:** M-61 (long MP3 chapter titles dropped by ffmpeg-based players), M-62 (a different format made while
  the chosen one was being checked), M-63 (more than 255 MP3 chapters).
- **Low:** L-174 to L-183. **Tests:** T-27.

Round 20 built E-5 and E-11 together (`21c0be9`): a Settings dialog, opened from a gear button between the
text width and Open, in the style of the audiobook export dialog. It has the themes (System, Light, and the new
Sepia, Dark and the new Black) and the reader options that were only in `index.html` or `reader-config.json`.
Each option starts at the site's value (index.html, then reader-config.json). A reader's own value is saved in
their browser for the whole site, until Restore defaults. The site-wide ones stay in reader-config.json: the
paths, the CDN policy, the voice server, default books, and the memory and request sizes. Two independent
reviewers then went over it. One looked at the settings logic, the other at the themes, contrast, accessibility
and layout; every contrast pair of the new themes passes 4.5:1. What they found was fixed in `3c07e06`, with
tests that fail on the code before it:
- **High:** H-16 (a reload-only setting couldn't be turned back).
- **Medium:** M-64 to M-69.
- **Low:** L-185 to L-196. **Tests:** T-28. **Documentation:** D-10.
One finding was kept as designed: choosing a theme in the dialog, by keyboard too, also makes it the light or
dark theme T switches to.

A second review, of `3c07e06`, found a high regression in its comic fix and two medium gaps, fixed in `7bbe17b`
with tests that fail on the code before it:
- **High:** H-17 (a comic left on the last page of a section reopened a section later).
- **Medium:** M-70 (opening another folder deleted a reader's setting), M-71 (Escape in an untouched field
  saved the folder's value as the reader's).
- **Low:** L-197 and L-198. **Tests:** T-29. **Documentation:** D-11.
L-189's "dropped on load" part was taken back by M-70: a saved setting equal to this folder's value is kept,
as other folders' defaults can differ.

A third review, of `7bbe17b`, found two more medium gaps, fixed in `e7d1096` with tests that fail on the code
before it:
- **Medium:** M-72 (a comic in the scroll layout reopened at the top of its page), M-73 (setting an option back
  to one folder's default deleted the reader's choice for every folder; the rest of M-70).
- **Low:** L-199 and L-200. **Tests:** T-30. **Documentation:** D-12.
L-188 is taken back for the same reason as M-73: shortcuts set back to the folder's value stay the reader's.

*Reproduced* means confirmed in Chromium, Node or nginx against the real code; *read* means confirmed by
reading the code only.

**Tests.** All 199 tests pass. Six more need `SLOW=1` or `NETWORK=1`: the real Kokoro and Pocket TTS models,
self-hosted and from the CDNs, and the libraries and fonts from the CDNs. Fixes from round 11 on have tests
that fail on the code before them, except where an item says it was checked by reading.

Most fixes in rounds 7 and 8 have a test, and those tests fail on the code before the fix. Some were checked
by reading only: L-46, L-47 and L-50 to L-53, and the smaller parts of L-55.

**Two mistakes in this session, both repaired.**
- **curl overwritten (T-12).** A test replaced this machine's `/usr/bin/curl` when run as root. That made
  downloads look blocked, which is why earlier versions of this document said there was no internet access.
  The test is fixed, and curl was restored from the package's own copy (checksum checked).
- **Working files overwritten.** While checking the nginx example, the author wrote test files into a review
  folder that linked back into the repository. That overwrote the working `index.html` and
  `libs/jszip.min.js`. No commit was affected: both were restored and checked, and the links were removed.

**Labels.** Each item has an ID you can ask for by name (for example, "fix T-11 and T-13").

| Prefix | Meaning |
|---|---|
| **C** | Critical: code running where it shouldn't, data loss, or the reader unusable. |
| **H** | High: a security or privacy protection that doesn't hold, or a serious bug. |
| **M** | Medium: a real bug or gap that affects people in normal use. |
| **L** | Low: minor, rare, or defence in depth. |
| **T** | Tests: gaps in the test suite. |
| **D** | Documentation. |
| **E** | Enhancement: a new feature or improvement. |

## Summary

No critical, high or medium items are open. The open items are:
- **Low:** L-110 (no edit list for the encoder's delay, which WebCodecs doesn't report).
- **Tests:** T-16 and T-20 (in part).
- **Enhancements:** E-1 to E-4, E-6 to E-9 and E-15.

## Open items

| ID | Title | Kind |
|---|---|---|
| [L-110](#l-110-no-edit-list-for-the-encoders-delay) | No edit list for the encoder's delay | Low |
| [T-16](#t-16-coverage-gaps) | Coverage gaps | Tests |
| [T-20](#t-20-test-gaps) | Test gaps | Tests |
| [E-1](#e-1-footnote-pop-ups) to [E-4](#e-4-dictionary-lookup), [E-6](#e-6-a-bookshelf-page) to [E-9](#e-9-right-to-left-manga), [E-15](#e-15-fixed-layout-books) | Enhancements | — |

## Low

### L-110. No edit list for the encoder's delay

*Read.* AAC encoders put 1024 to 2112 samples of delay at the start, and the file doesn't mark them, so each file
starts with 20 to 45 ms of silence and chapter marks fall that much early. Harmless for speech; WebCodecs
doesn't report the delay, so an `elst` would have to guess it.

## Tests

### T-16. Coverage gaps

*Read.* Not tested:
- That the reader sends `If-Range`: the replacement test also passes through the size and checksum checks.
- That `checksums/*.sha256` match each script's `--list` (they do today).
- `TTS_SERVER`, `SPAN_MAX`, `SAVED_AUDIO_MB` eviction, `SEARCH_MAX`, `COMIC_PART`, `BOOKSHELF` from a config,
  and `KEEP_POSITIONS_DAYS: 0`.
- The test server's file types are its own, not nginx.conf.example's.

### T-20. Test gaps

*Read.* Still untested:
- L-75 and L-100 (giving up on a stalled stream): they would take minutes of waiting, or a setting for tests.
- L-90 (fallback pages keep their pictures), L-91 and L-103 (the range probe), L-93 (narration at the end of the
  text), L-94 and L-96 (the sleep timer).
- The T-18 checks run right after loading, so a refused request logged later is missed.
- From rounds 16 and 17: the search retry, the non-page note, the ZIP64 fallback in lazyZip, obfuscated fonts by
  exact name, folder books' dispose guard, the export's saved-audio room, keepPart's limits, the voice label, the
  Cancel confirmation, the 409 wait (a test would take a minute of 409s), and the Pocket crash (needs a stand-in
  worker).

## Enhancements

### E-1. Footnote pop-ups
Clicking a note mark shows the note in a small pop-up instead of jumping to the back of the book.

### E-2. Image zoom
Click a picture, map or diagram to see it full size.

### E-3. Bookmarks and highlights with notes
Select text, highlight it in a colour, add a note, and list them in a sidebar tab, with export to Markdown.

### E-4. Dictionary lookup
Double-click a word for its definition, from a free dictionary API or a downloadable offline list.

### E-6. A bookshelf page
A page listing the books in `/bookshelf/` with covers, progress and last-read dates.

### E-7. Sync positions across devices
Save positions (and later bookmarks) on your server, so each device picks up where the last one left off.

### E-8. Install as an offline app
A web app manifest and service worker, so the reader can be installed and open saved books offline.

### E-9. Right-to-left manga
Use ComicInfo's `Manga` value to show comic pages right to left, including spreads.

### E-15. Fixed-layout books

Pre-paginated (fixed-layout) EPUBs are shown reflowed in columns, and `linear="no"` items are read in order with
the rest (which the spec allows). Laying out fixed-layout pages as pages (and optionally skipping non-linear
items) would suit comics-style and picture books.

## Suggested order

1. **T-16, T-20:** test coverage.
2. The enhancements, as wanted.

## Resolved

From all reviews so far, with the commits that fixed them.

| ID | Title | Fixed in |
|---|---|---|
| C-1 | An export of more than about 22 minutes failed to save after all its audio was made (frame sizes spread into a call) | `9d10dc0` |
| H-1 | Remote-content stripping could be bypassed; book pages now get a Content-Security-Policy | `2e5345f` |
| H-2 | Uppercase XHTML tags got past the sanitizer | `2e5345f` |
| H-3 | Empty files broke chapters read with range requests | `c5cfe41` |
| H-4 | Runs of CSS hex escapes (common for CJK font names) froze the page: exponential regex in `plainFunctionNames` (a regression from L-20, found in this review) | `87cd424` |
| H-5 | Unclosed `<base`/`<meta` tags with `= a` pairs froze the page: exponential regex in the pre-parse stripping (a regression from L-24, found in round 4) | `78a8a9e` |
| H-6 | A stylesheet importing itself many times froze the tab (N⁴ copies) | `01c0bdd`, `84bc895` |
| H-7 | Declarative shadow DOM skipped every cleaning step, so a link could navigate the book frame | `160a734` |
| H-8 | Markup reading back differently once serialized (mutation) brought back uncleaned content (round 8 review) | `84bc895` |
| H-9 | A font pasted in as `data:` into every style naming it made pages of hundreds of MB (round 8 review) | `84bc895` |
| H-10 | Apple's players showed no chapters: a QuickTime chapter track as well as Nero markers | `de3a70d` |
| H-11 | Without a save picker a long book was held in memory as about a million small arrays | `9d10dc0` |
| H-12 | A Pocket export hung for good (and locked reading aloud) when a book in another Pocket language opened | `ce5efe6` |
| H-13 | A short voice outage stopped an hours-long export, and shorter ones left sentences silent; now it waits | `ce5efe6` |
| H-14 | Addresses got past the CSS cleaner through substitutions (unclosed `image-set(var(…)`, `url("…" var())`, `if()`) (the book policy held) | `74c9765` |
| H-15 | The `var()` check was quadratic: a small sheet froze the tab | `74c9765` |
| H-17 | A comic left on the last page of a section reopened a section later, and a larger section size drifted (a regression from M-65's fix); its place is now the first page on screen | `7bbe17b` |
| H-16 | Settings: once a reload-only setting (remote content, full-precision voices) was saved, the dialog couldn't turn it back, and Restore defaults showed it wrong | `3c07e06` |
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
| M-11 | The CSS tokenizer let remote addresses through in four ways (number, final escape, NUL, unclosed url string); imported sheets joined into new addresses; quadratic rescan (round 5 review) | `3a98b99` |
| M-12 | The loose position record mixed up books sharing a title, file names and cover page, and deleted their keys (round 5 review) | `5199dda` |
| M-13 | A pasted-in import could close a body `<style>` and add uncleaned markup | `ff2d71d` |
| M-14 | Encoded slashes in paths made the reader page fetch from other sites or climb out of a folder book | `445d1c7` |
| M-15 | A book finishing late replaced one opened afterwards | `38ae702` |
| M-16 | EPUB pictures stayed in memory until the book was closed | `7835d85` |
| M-17 | Publisher narration could play the previous book's recording | `d53077a` |
| M-18 | Reading aloud could carry on after the bar was closed | `6d742cd` |
| M-19 | Thousands of headings made a document take tens of seconds to open | `5ffc8fa` |
| M-20 | Pocket TTS from the CDNs didn't start under the CDN reader policy | `a5d39b8` |
| M-21 | The CSS budget counted nested and font text several times and dropped legitimate sheets (round 8 review) | `84bc895` |
| M-22 | Every new reader saw "Publisher narration (not in this book)" as the engine (round 8 review) | `f8ed09c` |
| M-23 | Reading aloud on a comic (or past the last text) turned every page to the end and saved that position | `7a0abfb` |
| M-24 | A head `<style media="print">` applied on screen | `9e05168` |
| M-25 | SVG pages and pictures in the spine showed blank or as binary text; manifest fallbacks weren't used | `9e05168` |
| M-26 | Text in UTF-16 or a declared encoding (Shift_JIS and others) was garbled | `9e05168` |
| M-27 | A partly downloaded self-hosted Pocket TTS (or Kokoro runtime), or one of the other precision, failed instead of using the CDN | `7e42a4a` |
| M-28 | The new decoding (M-26) trusted a stale declared encoding over valid UTF-8, garbling old books and Markdown that mentions a charset (round 11 review) | `c28c12d` |
| M-29 | The new look-ahead (M-23) took a chapter that failed to load once as having no text, and skipped it (round 11 review) | `1ba12ab` |
| M-30 | A server's `charset=utf-8` overrode the Windows-1252 fallback for old files opened by link (round 11, third review) | `d82fa29` |
| M-31 | Reading aloud into a chapter that couldn't be loaded stayed "playing" and saved the failed chapter as the position (round 11, third review) | `d82fa29` |
| M-32 | After M-31, paging couldn't get past a chapter that can't be shown (round 11, fourth review) | `847488f` |
| M-33 | A chosen chapter with no text made an invalid `.m4b` (now left out, and such chapters start unticked) | `9d10dc0`, `ed1aa5e` |
| M-34 | The saved audio couldn't hold a long export, so starting again didn't reuse it and other books' audio was dropped | `9d10dc0` |
| M-35 | One failed passage stopped the whole export and threw the file away | `9d10dc0`, `ed1aa5e` |
| M-36 | Export while the voice was still loading failed with a false error | `ed1aa5e` |
| M-37 | Export started a voice's large download without asking | `ed1aa5e` |
| M-38 | Closing the dialog while the voice loaded didn't stop the export starting later | `ed1aa5e` |
| M-39 | Opening another book while the voice loaded exported it under the first book's chapters | `ed1aa5e` |
| M-40 | The reader's keys (pages, R, T, L, Space) worked behind the export dialog | `ed1aa5e` |
| M-41 | The ZIP offer and final status were lost when the dialog was reopened | `ed1aa5e` |
| M-42 | The wake lock wasn't taken again after the tab had been hidden | `ed1aa5e` |
| M-43 | Markup appearing only on reading back (mutation) kept uncleaned styles, srcset and relative addresses (the book policy held) | `0def7a5` |
| M-44 | `var()` inside `image-set()` let an address past the CSS cleaner (the book policy held) | `0def7a5` |
| M-45 | XHTML files named `.html` were parsed as HTML, so self-closed tags swallowed what followed | `0def7a5` |
| M-46 | A newly opened book whose first chapter failed left the last book's page in the frame | `0def7a5` |
| M-47 | The importing sheet's own `@namespace` was lost, and the namespace fix changed text in strings | `0def7a5` |
| M-48 | Opening another book cancelled an export without asking | `ce5efe6` |
| M-49 | A file of silence could be saved as "kept", even over a complete one | `ce5efe6` |
| M-50 | A chapter that couldn't be read was shown as "no text", unticked and silently left out | `ce5efe6` |
| M-51 | On narrow screens, search lost its focus to the contents, so typing fired shortcuts | `ce5efe6` |
| M-52 | A failed render while another page arrived left paging dead | `74c9765` |
| M-53 | One unreadable chapter made every search re-read the whole book | `74c9765` |
| M-54 | A 500 for one text from a server that was well stopped the export after five minutes | `f38b008` |
| M-55 | A crashed Kokoro (or reloading Pocket) wasted the wait, then stopped with an internal error | `f38b008` |
| M-56 | Cancel took up to 20 s during a wait for the voice, and a paused export went on polling and stopped itself | `f38b008` |
| M-57 | The wait limit counted only its sleeps, so a hung server could stall an export for an hour | `f38b008` |
| M-58 | A voice server that was only busy (409) had its sentences left silent | `a2dabfe` |
| M-59 | In the scroll layout, restoring after a failed chapter threw (an option hid `fraction()`), leaving read-aloud "playing" | `a2dabfe` |
| M-60 | Every Chrome and Edge said it couldn't make AAC (user report): only 64 kbps mono was tried, Windows' encoder takes 96 kbps and up, Chrome on Linux has none; now a ladder of settings and a message that says why | `06e77ed` |
| M-61 | `.mp3` chapters with titles of 127 bytes or more (about 43 CJK characters) were dropped by ffmpeg-based players (mpv, Audiobookshelf, Jellyfin): ID3v2.4 sizes inside `CHAP`; now ID3v2.3 | `8af5e59` |
| M-62 | On first opening, Export worked while the saved format was still being checked, and made a different one | `0a4902b` |
| M-63 | More than 255 `.mp3` chapters wrapped the `CTOC` count; now nested tables of 255 | `8af5e59` |
| M-72 | A comic in the scroll layout reopened at the top of its page, not as far down it as the reader was (a regression from H-17's fix) | `e7d1096` |
| M-73 | Setting an option back to one folder's default deleted the reader's choice for every folder, and could turn remote content back on elsewhere (the rest of M-70) | `e7d1096` |
| M-70 | Opening another folder deleted a reader's setting when that folder's default equalled it (a regression from L-189's fix) | `7bbe17b` |
| M-71 | Escape in an untouched days field saved the folder's value as the reader's own, for the whole site | `7bbe17b` |
| M-64 | Settings: changing web links, or Restore defaults, while reading aloud sent the voice back to the top of the page; follow-ups now run only on a real change, and links wait for the next chapter while reading aloud | `3c07e06` |
| M-65 | Settings: a new comic section size moved saved comic positions to other pages; a comic's place is now also kept as a page number | `3c07e06` |
| M-66 | Settings: days to keep positions equal to the folder's value fell back to the site-wide longest (a folder's "keep forever") | `3c07e06` |
| M-67 | Settings: the dialog opened with focus on its unnamed scrolling list, not a control | `3c07e06` |
| M-68 | The stored theme was applied after the config and fonts loaded: a flash of the light theme before Black (an inline script in `<head>` now applies it) | `3c07e06` |
| M-69 | Settings: a site can't keep remote content off for its readers any more; documented that the reader policy from nginx.conf.example still blocks other sites (*read*) | `3c07e06` |
| L-1 | Relative URLs not in the book requested the reader's own site | `2e5345f` |
| L-2 | SVG animation could set a remote address | `2e5345f` |
| L-3 | `verify()` failed open without a SHA-256 tool | `770c237` |
| L-4 | The "no pinned checksum" note used a substring match | `770c237` |
| L-5 | `--list` only worked as the first argument | `770c237` |
| L-6 | `fetch-fonts.sh` was trust-on-first-use; now `--strict` | `48d5993`, `87c0cff` |
| L-7 | Kokoro's local-first shim accepted "not found" pages of other types | `48d5993` |
| L-8 | Worker blob URLs were never revoked | `48d5993` |
| L-9 | Reading-pace state wasn't reset for a new book | `48d5993` |
| L-10 | `zipSource`'s blob URL list kept growing | `48d5993` |
| L-11 | A book element with `id="spine-end"` broke page counting; the reader's ids now have a random part | `48d5993`, `f7c6ef9` |
| L-12 | Voice clip URLs weren't restricted to the voices folder | `c24dd62`, `87cd424` |
| L-13 | Books without an ID shared reading positions by title | `c992d26` |
| L-14 | A bad `?book=` link fell back to the sample, not `default.epub` | `41455c8` |
| L-15 | The server voice cache key depended on field order | `c24dd62` |
| L-16 | The whole book file was held in memory; books are now read in place | `ef520ac` |
| L-17 | Single-letter shortcuts clashed with screen readers; now a switch | `c4bcef1` |
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
| L-29 | The CSS cleaning was pattern-based; now a CSS Syntax tokenizer | `5a16313`, `3a98b99` |
| L-30 | The in-place reader was stricter than JSZip; uploads are lenient, and whole-file reads get the same checks | `079a2c8`, `76a92bc` |
| L-31 | Position-key and voice-clip leftovers (the remaining part is L-36) | `fa178b5`, `5199dda` |
| L-32 | Whole archives read by JSZip skipped checksums and inflated past their declared sizes (round 5 review) | `76a92bc` |
| L-33 | Renaming book ids that start with `spine-` missed references to them (round 5 review) | `f7c6ef9` |
| L-34 | `fetch-fonts.sh --strict` refetched missing files and ran without a list (round 5 review) | `87c0cff` |
| L-35 | Inlined stylesheets lost their `@import` conditions; imports browsers ignore were pasted in | `b6017ae` |
| L-36 | Older position keys accumulated; positions not read for `KEEP_POSITIONS_DAYS` are now forgotten | `b66624c` |
| L-37 | A server voice chosen while its clip check ran could replay audio saved for an old clip | `caf359a`, `cd29fca` |
| L-38 | Middle-click got around ALLOW_EXTERNAL_LINKS; in-book links middle-clicked to broken pages | `dfa9dd4` |
| L-39 | A `#…%` fragment stopped a document opening | `dfa9dd4` |
| L-40 | `<object>` fallbacks lost; some pictures and SVG references not localized | `dfa9dd4` |
| L-41 | A quadratic regex on trailing spaces in text documents | `dfa9dd4` |
| L-42 | Extra bytes after compressed data made a file unreadable | `dfa9dd4` |
| L-43 | A stray `%` in a file name dropped that chapter | `445d1c7` |
| L-44 | A package path with a leading slash didn't open | `dfa9dd4` |
| L-45 | Search missed words with soft hyphens, zero-width spaces or ligatures | `dfa9dd4` |
| L-46 | Blob URLs made after a book was closed were never revoked | `dfa9dd4` |
| L-47 | An unreadable reply to the range probe aborted a `?book=` attempt | `dfa9dd4` |
| L-48 | Paths differing only in case or Unicode form broke links or dropped chapters | `dfa9dd4` |
| L-49 | A click past the last sentence while paused jumped to the next chapter | `3169135`, `f8ed09c` |
| L-50 | Natural-voice audio could be saved under the wrong speed or voice | `3169135` |
| L-51 | Kokoro leaked blob URLs for cancelled passages | `3169135` |
| L-52 | The sleep timer overran with consecutive narration clips | `3169135` |
| L-53 | A crashed Kokoro worker or a silent voice server left reading stuck | `3169135`, `f8ed09c` |
| L-54 | Errors weren't announced, focus was lost, Space did two things | `3169135`, `f8ed09c` |
| L-55 | Settings and read-aloud details (config ranges and caps, cache floor, saving off, narration resume, engine menu) | `3169135`, `f8ed09c` |
| L-56 | nginx.conf.example cached libraries for 30 days without checking | `152c4f8` |
| L-57 | nginx.conf.example: a regex location elsewhere could take over `/reader/` | `152c4f8` |
| L-58 | Fetch scripts resumed stale or unresumable partial downloads | `152c4f8` |
| L-59 | Fetch-script nits (font paths, `all` anywhere) | `152c4f8` |
| L-60 | Comics with backslashes in entry names stopped showing (regression from M-14; round 8 review) | `84bc895` |
| L-61 | Archives whose entry names start with "/" stopped opening (regression from L-44; round 8 review) | `84bc895` |
| L-62 | An overtaken open left "Opening book…" on screen (round 8 review) | `84bc895` |
| L-63 | The per-page sheet cache stored text that depended on where it was reached (round 8 review) | `84bc895` |
| L-64 | The section highlight could stop early when contents entries weren't in document order (round 8 review) | `84bc895` |
| L-65 | Narration jumped chapters on a click past its last clip while paused (round 8 review) | `f8ed09c` |
| L-66 | Space didn't pause with the position ribbon focused (round 8 review) | `f8ed09c` |
| L-67 | A listener left per server-voice retry; a vague worker message error; README config ranges (round 8 review) | `f8ed09c` |
| L-68 | The read-aloud status announced every download step | `90a6b6f`, `7a86a5f` |
| L-69 | nginx.conf.example: why books, audio and models stay out of gzip_types | `99b2a18`, `7a86a5f` |
| L-70 | Case-insensitive file lookups scanned every name in large archives | `90a6b6f` |
| L-71 | Status announcements weren't repeated on reopening the bar, and changes differing only in numbers were swallowed (round 9 review) | `7a86a5f` |
| L-72 | Opening another book while reading aloud started reading the new one on its own | `7a0abfb` |
| L-73 | A voice or speed chosen while paused didn't apply to the paused passage | `7a0abfb` |
| L-75 | A server voice stream that stalled partway left reading silent, with every later request queued | `7a0abfb` |
| L-80 | A missing file with `&` or `'` in its name opened the site's "not found" page as the book | `c14fb66` |
| L-81 | A book folder named with `;` or `,` broke the book policy, so its pictures and fonts were refused | `c14fb66` |
| L-82 | Without JSZip, text, Markdown and EPUBs read in place were refused too | `c14fb66` |
| L-83 | `"DEFAULT_BOOK": ""` opened the reader's own page as a book | `c14fb66` |
| L-90 | Pictures on a fallback page (M-25) were released as soon as it was shown (round 11 review) | `c28c12d` |
| L-91 | The self-hosted voice check (M-27) started and dropped downloads of the large model files; now it asks for the first bytes | `c28c12d` |
| L-92 | The server's charset wasn't used for documents opened by link (round 11 review) | `c28c12d` |
| L-93 | Narration still turned to a following picture page at the end of the text (round 11 review) | `1ba12ab` |
| L-94 | A sleep timer that ran out, or was set to the chapter end, while the reader looked past picture pages was ignored | `1ba12ab` |
| L-95 | The stall limit (L-75) also cut off a slow server before its first audio | `1ba12ab` |
| L-96 | The sleep timer carried over into a newly opened book | `1ba12ab` |
| L-97 | No status while passing over many picture pages | `1ba12ab` |
| L-100 | No time limit between a streaming server's headers and its first audio (after L-95) | `d82fa29` |
| L-101 | Encoding aliases (`csISO2022JP`) weren't recognised for the 7-bit ISO-2022-JP exception | `d82fa29` |
| L-102 | An error while splitting a looked-ahead chapter into sentences was kept and stalled reading | `d82fa29` |
| L-103 | The range probe (L-91) could fail on a voice folder on another site whose server doesn't allow the header | `d82fa29` |
| L-104 | After a failed chapter, a resize meanwhile could leave the page shown and the saved position apart | `847488f` |
| L-105 | Encoding labels were checked before being normalised, so some server labels hid the file's own declaration | `847488f` |
| L-106 | `x-user-defined` was honoured (private-use characters) instead of read as Windows-1252, as HTML does | `847488f` |
| L-109 | Nero chapter markers stop at 255 (the QuickTime chapter track holds them all) | `de3a70d` |
| L-111 | Resampling 24 kHz audio for the encoder was linear; now the browser's filtered resampler | `9d10dc0` |
| L-112 | Audio frames and the encoder weren't closed, and an encoder error could be hidden by a later one | `9d10dc0` |
| L-114 | One file write per audio frame; now about 1 MB at a time | `9d10dc0` |
| L-115 | The server voice's clip version wasn't checked before export used its saved audio | `9d10dc0` |
| L-116 | An encoder description given as a DataView was read as empty | `9d10dc0` |
| L-117 | The ZIP fallback would wrap past 4 GB (refused now) and copied every file in memory | `9d10dc0` |
| L-118 | A table of contents entry whose heading isn't there made units overlap | `ed1aa5e` |
| L-120 | Empty "Opening pages" rows, and equal estimates for every chapter of a single-file book | `ed1aa5e` |
| L-121 | Shift-click on a chapter's title didn't select a range | `ed1aa5e` |
| L-122 | Focus fell to the page when Export or Pause was hidden | `ed1aa5e` |
| L-123 | Cancelling, opening another book or closing the tab dropped a long export without asking | `ed1aa5e` |
| L-124 | "About X left" counted time paused | `ed1aa5e` |
| L-125 | Accessibility details in the dialog (progress label, full titles, the note tied to Export) | `ed1aa5e` |
| L-126 | A misleading voice note could show while exporting | `ed1aa5e` |
| L-127 | Non-linear items (notes) were read into the chapter before them | `ed1aa5e` |
| L-128 | Estimates ignored Kokoro's speed and mixed voices' making times | `ed1aa5e` |
| L-74 | Pocket TTS asked to download again after a language change | `ed36ce1` |
| L-76 | A short outage made passages read sentence by sentence for the rest of the session | `ed36ce1` |
| L-77 | `KEEP_POSITIONS_DAYS` applied site-wide from whichever folder ran the sweep; now the longest asked for | `ed36ce1` |
| L-78 | The position ribbon: Enter in the last chapter went back to its start; now a slider with arrows, Home and End | `847488f`, `ed36ce1` |
| L-79 | The narrow-screen contents had no focus handling (focus, Escape, a tap on the page) | `ed36ce1` |
| L-84 | CSS URLs lost their fragment (SVG sprites) | `0189fa5` |
| L-85 | A remote `@import` after an inlined one was dropped | `0189fa5` |
| L-86 | An imported sheet's `@namespace` was lost | `0189fa5` |
| L-87 | The body's style attribute wasn't cleaned | `0189fa5` |
| L-88 | Obfuscated fonts (IDPF, Adobe) weren't de-obfuscated | `0189fa5` |
| L-89 | The checksum check passed files the list doesn't name | `0189fa5` |
| L-98 | Every chapter looked at was kept in memory; now the eight used last | `ed36ce1` |
| L-99 | Two read-aloud races: Play after pausing while passing picture pages, and R as another book opens | `ed36ce1` |
| L-107 | Reading aloud forgot its place after a chapter failed to show | `ed36ce1` |
| L-108 | A stray bad byte made UTF-8 text read as Windows-1252 | `0189fa5` |
| L-113 | A cancelled single-file export left an empty file (removed now where the browser allows) | `0189fa5` |
| L-119 | Contents entries out of order within a file | `ed36ce1` |
| L-129 | A background tab slowed the voice's retries (now timed on a worker) | `ed36ce1` |
| L-130 | One damaged picture or font blanked the whole chapter | `0def7a5` |
| L-131 | A page turn while a chapter loaded skipped the next chapter | `0def7a5` |
| L-132 | The soft-404 signature's pattern was quadratic on long words | `0def7a5` |
| L-133 | A hoisted remote `@import` without `;` took the next rules with it | `0def7a5` |
| L-134 | Search kept a chapter that failed once as empty | `0def7a5` |
| L-135 | Folder books: "not found" pages taken as files; de-obfuscated font copies never released | `0def7a5` |
| L-136 | Spine items that are neither pages nor pictures (audio, PDF) were decoded as text | `0def7a5` |
| L-137 | JSZip's inherited names ("constructor"), and obfuscated fonts matched by exact name only | `0def7a5` |
| L-139 | Escape in the search box on narrow screens also closed the contents | `ce5efe6` |
| L-140 | The export dialog kept another book's chapter list | `ce5efe6` |
| L-141 | A new file from the save picker was left empty when an export failed before writing | `ce5efe6` |
| L-142 | A voice still loading started reading in a newly opened book | `ce5efe6` |
| L-143 | The saved audio kept for a stopped export was trimmed before it could be reused | `ce5efe6` |
| L-144 | The server voice left an abort listener behind for every request | `ce5efe6` |
| L-145 | A stalled or dropped stream was taken as the text's fault | `ce5efe6` |
| L-146 | A one-file export held every chapter's page for its whole length | `ce5efe6` |
| L-147 | Cancel's blocking confirm() could stall the export's timers | `ce5efe6` |
| L-148 | `fetch-pocket.sh` checked the languages only after downloading | `ce5efe6` |
| L-138 | `href` on MathML elements (links in Firefox) | `2baae6a` |
| L-149 | Archives with data before them weren't read in place | `2baae6a` |
| L-150 | A good page of the same book could be replaced by the blank page | `74c9765` |
| L-151 | The blank page wasn't wired (keys, swipes, the wheel) | `74c9765` |
| L-152 | Moving `@namespace` rules could change the CSS's meaning (a misplaced one made valid; unclosed text) | `74c9765` |
| L-153 | The non-page note was searched and read aloud; folder books' font copies after closing; ZIP64 records taken for data before the archive | `74c9765` |
| L-154 | The room kept for a stopped export never expired, and wasn't cleared with the saved audio | `f38b008` |
| L-155 | An export of only unreadable chapters said "no text to read" | `f38b008` |
| L-156 | On narrow screens, C from inside the page no longer focused the contents | `f38b008` |
| L-157 | A whole passage was tried three times before going sentence by sentence | `f38b008` |
| L-158 | The Cancel confirmation's text vanished, and its timer carried into the next export | `f38b008` |
| L-159 | A partial file could replace a file picked to be replaced | `f38b008` |
| L-160 | Failed server requests left an abort listener behind | `f38b008` |
| L-161 | The voice label went blank while the server was away mid-export | `f38b008` |
| L-162 | Two fonts differing only in case, one obfuscated, were both de-obfuscated | `f38b008` |
| L-163 | `attr()` typed as an address (from an HTML attribute the cleaner never sees) wasn't blocked (latent: browsers don't fetch it yet) | `95d266b` |
| L-164 | A failed chapter chosen again from the blank page (or search) wasn't tried again | `a2dabfe` |
| L-165 | A crashed Pocket worker wasn't marked as one, so the export retried it | `a2dabfe` |
| L-166 | Kokoro's crash message said "the voice stopped working" twice | `a2dabfe` |
| L-167 | A failed connection to the voice server left an abort listener behind | `a2dabfe` |
| L-168 | The Cancel test's limit was too loose to catch its fix being undone | `a2dabfe` |
| L-169 | An untyped item with a known non-picture name (.mp3, .pdf) was read as text | `a2dabfe` |
| L-170 | A search during the first indexing used up a retry of failed chapters | `a2dabfe` |
| L-171 | The `attr()` check read raw text: an attribute named `data-url` was blocked, and a comment, an escape or a fallback string fooled it | `1f4e9d8`, `44f1b2d` |
| L-172 | The non-page note showed "()" for an untyped item | `44f1b2d` |
| L-173 | Pocket's worker errors weren't checked against the current worker, and unreadable messages weren't handled | `44f1b2d` |
| L-174 | `.opus` books with more than 999 chapters got wrong titles (`CHAPTER1000NAME` read as chapter 100); chapters now stop at 999 | `8af5e59` |
| L-175 | ID3v2.4 UTF-8 tags may not show in Windows Explorer or older iTunes (*read*); now ID3v2.3 | `8af5e59` |
| L-176 | The `.m4b` bitrate said 64 kbps when the encoder chose its own; now 0 (unknown) | `8af5e59` |
| L-177 | `.opus` track as `TRACKNUMBER=2/7`; now `TRACKNUMBER` and `TRACKTOTAL` | `8af5e59` |
| L-178 | `.opus` files ended with the encoder's padding (about 13 ms); the last granule is now trimmed (RFC 7845) | `8af5e59` |
| L-179 | A failed lamejs load greyed out MP3 until the page was reloaded; comments said it loaded only for MP3 exports | `0a4902b` |
| L-180 | A saved format this version doesn't know broke the dialog | `0a4902b` |
| L-181 | `libs/LICENSES/lamejs.txt` was LAME's licence FAQ, not the LGPL; fetch-libs.sh now saves the LGPL-3.0 text (with the GPL) | `0a4902b` |
| L-182 | Stale messages: the export button said `.m4b`; formats being checked were greyed out; a note for a format that can't be made; the AAC size estimate used the wrong setting (*read*) | `0a4902b` |
| L-183 | The format reasons weren't linked to the format group for screen readers (*read*) | `0a4902b` |
| L-199 | A comic's page could be read from the page still in the frame while another book opened (*read*) | `e7d1096` |
| L-200 | Settings: only an option's label toggled it, not its whole row | `e7d1096` |
| L-197 | A stored shortcuts value that isn't on or off still stopped a folder's default | `7bbe17b` |
| L-198 | Settings: the option notes were hidden from reading through the dialog (`aria-hidden`); they are now outside the labels (*read*) | `7bbe17b` |
| L-185 | Settings: fractional days, seconds and MB were saved (0.001 days forgot positions after 90 seconds); now whole numbers | `3c07e06` |
| L-186 | Settings: Escape in the search-limit field re-ran the search and lost the current match, with nothing changed | `3c07e06` |
| L-187 | T and the theme button ignored the folder's default theme as the one to switch to (*read*) | `3c07e06` |
| L-188 | A stored non-boolean shortcuts value was taken as a choice (the part about shortcuts set back to the site's value was taken back by M-73) | `3c07e06`, `e7d1096` |
| L-189 | A saved setting out of range was kept as it was on load (*read*; the part dropping values equal to the folder's was taken back by M-70) | `3c07e06`, `7bbe17b` |
| L-190 | Settings: every option's notes were part of its accessible name; now descriptions | `3c07e06` |
| L-191 | Settings: "Reload now" appearing wasn't announced; now a polite status | `3c07e06` |
| L-192 | The theme button said "light mode" when it went to Sepia (and "dark mode" for Black) | `3c07e06` |
| L-193 | Settings: field and theme-card borders were under 3:1, and Black's dialog had no visible edge | `3c07e06` |
| L-194 | Settings: the buttons wrapped untidily on phones (*read*) | `3c07e06` |
| L-195 | A colour rule on the System swatch did nothing (*read*) | `3c07e06` |
| L-196 | The README's ALLOW_REMOTE_CONTENT entry didn't say readers can turn it on | `3c07e06` |
| L-184 | With many search matches, going to the next one scrolled the whole sidebar, so the next-match button moved out from under the pointer (user report); the results now scroll on their own under fixed controls | `14a0e2b` |
| T-1 | The hostile-book test missed most leaks | `2e5345f` |
| T-2 | The soft-404 test server always returned the same page | `33813a3` |
| T-3 | Device voices and publisher narration had no tests | `a9c1cce` |
| T-4 | Real Kokoro and Pocket TTS only ran on request; now also weekly | `4e3ceac` |
| T-5 | The CDN version of the reader policy wasn't tested | `4e3ceac` |
| T-6 | The in-place ZIP tests covered only the normal cases | `7c5c55c` |
| T-7 | Position-key tests left gaps | `432deba`, `78a8a9e` |
| T-8 | The hostile test book lacked the remaining CSS forms | `4632330` |
| T-9 | Gaps left after round 3 (same-size replacement, ZIP cases, pre-parse test, SRI check) | `888f900`, `37b6f2f`, `78a8a9e` |
| T-10 | Cases checked only by script | `0231f23`, `5a16313`, `3a98b99` |
| T-12 | A test overwrote the system's `curl` when run as root, and failed as anyone else | `4266cd2` |
| T-18 | Under the reader policy, "nothing left the site" checks couldn't fail; they now also check for refused requests | `961118e` |
| T-21 | The sleep-timer tests' clock steps could trip the stall limit on a slow machine (round 11 review) | `1ba12ab` |
| T-13 | A self-hosting test needed internet but wasn't gated | `4d65017` |
| T-15 | Test housekeeping: temporary folders, failed servers and busy ports, curl | `4d65017` |
| T-17 | Workflow upkeep: Node 22, npm ci, cached models | `4d65017` |
| T-19 | Two script tests matched anywhere in the page; TRANSFORMERS unchecked | `4d65017` |
| T-22 | The pause test passed with pause broken | `ce5efe6` |
| T-23 | The L-113 test couldn't tell a new file from one chosen to be replaced | `ce5efe6` |
| T-24 | The export tests left a timer and download listeners behind (85 s idle, a possible clash) | `ce5efe6` |
| T-25 | The weekly workflow had no ffmpeg, so the export tests would be skipped | `ce5efe6` |
| T-11 | The weekly workflow hadn't run: run by hand and on its schedule on 2026-11-09 at `06fc8e7`, 178 of 178 passed with none skipped (the real models and the CDNs included) | runs 42616347850, 42620691908 |
| T-26 | Wall-clock limits tight enough to be flaky on a slow machine | `ce5efe6` |
| T-30 | A choice set back in another folder, a tall-page comic in the scroll layout, the whole row as a target | `e7d1096` |
| T-29 | Comic places at the end of a section and after a larger section size in every layout, settings across folders, Escape in an untouched field, a stored junk shortcuts value | `7bbe17b` |
| T-28 | Settings test gaps: reload-only settings turned back, reading aloud through a change, comic pages, days to keep positions, a folder's theme, focus and names, the early theme | `3c07e06` |
| T-27 | E-17 test gaps: the checking window, `.opus` and `.mp3` through the file picker, the MP3 retry; Node tests of both writers with real ffmpeg frames (lamejs from cdnjs is covered by the SRI check only) | `8af5e59`, `0a4902b` |
| T-14 | The hostile-book tests only ran behind the reader's own policy | `2baae6a` |
| D-1 | The README overstated the remote-content protection | `2e5345f` |
| D-2 | No web server example for the reader | `2e7a63d` |
| D-3 | No upgrade checklist for pinned versions | `630738a` |
| D-4 | Documentation out of date (voice count, Node version, Markdown library, fetch-script folders, model precision) | `614e88c` |
| D-5 | Inaccurate sentences from D-4 and L-69: the gzip note, which files each fetch script reads, FULL_PRECISION on WebGPU (round 9 review) | `7a86a5f` |
| D-6 | The Caddy example didn't revalidate files (an old library fails a new hash); upgrading needs two fetch runs | `299ded9` |
| D-7 | Documentation nits: Markdown gzip in the nginx example, test requirements, --list, sizes, checksum order | `4d65017` |
| D-8 | README: positions setting only goes up, test duration, Kokoro reuse only at 1× | `ce5efe6` |
| D-12 | The settings code comment and REVIEW.md said a reader's value is dropped when it equals the site's | `e7d1096` |
| D-11 | README: changing COMIC_PART "doesn't move readers" wasn't true yet, and places saved by earlier versions weren't mentioned | `7bbe17b` |
| D-10 | README: "a time a reader sets in Settings is used as it is" wasn't true when it equalled the folder's | `3c07e06` |
| D-9 | REVIEW.md: stale round, line count, test counts and "open" sentences; L-18's removal unexplained | this update |
| E-12 | Hide French from Pocket TTS until it works | `590aab6` |
| E-13 | A quieter read-aloud bar: short voice names (Device, Kokoro, Pocket, Server); the sleep timer off unless `SLEEP_TIMER` | `23100cb` |
| E-14 | The time left in the footer off unless `TIME_LEFT` | `23100cb` |
| E-16 | Default book: `default.epub`, else `default.md` (an ordered `DEFAULT_BOOK` list, with "not found" page checks) | `a29374c` |
| E-10 | Audiobook export: chosen chapters into one `.m4b` or one per chapter, with any natural voice | `1b3516b` to `ed1aa5e` |
| E-5 | More themes: Sepia and Black (for OLED screens) as well as Light, Dark and System | `21c0be9` to `e7d1096` |
| E-11 | A settings panel: a Settings dialog for the theme and the reader options that were only in `index.html` or `reader-config.json` | `21c0be9` to `e7d1096` |
| E-17 | Audiobook formats: `.opus` (Opus in Ogg, chapter comments) and `.mp3` (lamejs, ID3 chapters) as well as `.m4b`; those this browser can't make greyed out with the reason | `2c7386b`, `895bafa`, `8af5e59`, `0a4902b` |
