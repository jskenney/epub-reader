# Code and security review

Review of the repository (2026-11-11, round 25): `index.html` (about 8,700 lines), the fetch scripts,
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

A fourth and last review looked at the whole feature afresh at `94fd7d1`. It found no critical or high items.
What it found was fixed in `fd47b98`, with a test that fails on the code before it:
- **Medium:** M-74 (Pocket TTS broke, with a message meant for the site owner, when a reader's precision choice
  asked for files a site without CDNs doesn't have).
- **Low:** L-201 to L-204. **Tests:** T-31. **Documentation:** D-13.
It also raised a question for the owner, filed as E-18: whether a site should be able to lock options. That was
the fourth loop of the four allowed, so the review-and-fix loops stop here.

Round 21 built E-18, a `LOCKED` list in reader-config.json for options readers can't change in that folder, and
E-19, a read-aloud engine list only as wide as the engine chosen (`c7b0749`). An independent reviewer then went
over both. It found no critical or high items. What it found was fixed in `96e5832`, with tests that fail on the
code before it except where marked *read*:
- **Medium:** M-75 (a locked days-to-keep deleted positions across the whole site).
- **Low:** L-205 to L-207. **Tests:** T-32. **Documentation:** D-14.

Round 22 built E-9, right-to-left manga (`cc60fa5`), and E-15, fixed-layout books (`20d2582`). It also closed
T-16 and most of T-20 with tests (`9172885` to `9be8cdd`). One of those tests found a bug, fixed with it in
`fea7773` (L-208).

Two independent reviewers then went over it: one on manga and fixed-layout books, one on the new tests and the
test server. The second put each original bug back into a copy and checked whether its test failed. They found
two high bugs in fixed-layout books, and that several new tests passed with their bug restored. The fixes came in
`6f6bc97` and `5dafde4`, with tests that fail on the code before them:
- **High:** H-18, H-19.
- **Medium:** M-76 to M-80.
- **Low:** L-209 to L-215. **Tests:** T-34. **Documentation:** D-15.
Owner questions, and fixed-layout features left for later, are filed as E-20.

A second review, of those fixes, found no regressions in reading aloud, search, the font keys or comics. It found
one older medium gap and two low ones, fixed in `59c5761` with a test that fails on the code before it:
- **Medium:** M-81 (vertically written fixed pages).
- **Low:** L-216, L-217. **Tests:** T-35. **Documentation:** D-16.

A third, fresh review of the whole round found no critical or high items, and one medium gap. The fixes came in
`8bda4f7`, with tests that fail on the code before it:
- **Medium:** M-82 (in dark themes, a fixed page with no background of its own showed black text on black).
- **Low:** L-218 to L-220. **Tests:** T-36. **Documentation:** D-17.

A fourth review found that M-82's fix had hidden pages coloured on their html. That was fixed in `0e3ee93`, with
tests that fail on the code before it:
- **Medium:** M-83.
- **Low:** L-221 to L-223. **Tests:** T-37. **Documentation:** D-18.

A fifth review found a high gap in that judging of colours, and a medium side effect of the 100% fix. Both were
fixed in `165e1ba`, with tests that fail on the code before it:
- **High:** H-20.
- **Medium:** M-84.
- **Low:** L-224 to L-227. **Tests:** T-38.

A sixth and last review looked at the round as a whole. It found no critical or high items. What it found was fixed
in `dea8a59`, with a test that fails on the code before it:
- **Medium:** M-85.
- **Low:** L-228 to L-230. **Tests:** T-39.
It also confirmed every round 22 fix it re-checked. That was the last of the six loops allowed.

Round 23 built E-20 (`6c5cc87`), and closed T-20 with tests for its last five items (`1ebfd84` to the L-94 test).
E-20 brought:
- in the page layouts, each fixed-layout page in a frame of its own size, scaled from outside, so `vw`/`vh`, fixed
  positions and media queries are the page's own;
- two-page spreads, by the pages' sides or with the cover alone;
- right-to-left fixed-layout books;
- EPUB 2 fixed layout.
T-16 was already closed in round 22.

Its review found no critical or high items. What it found was fixed in `526c63e` and `09956a7`, each fix with a
test that fails on the code before it:
- **Medium:** M-87.
- **Low:** L-231 to L-234. **Tests:** T-40 to T-42. **Docs:** D-19.

One item waited for your decision: M-86, which way the arrows go in the reflowable chapters of a right-to-left
book with some fixed pages. You chose that every right-to-left book turns right to left, with a setting to turn
every book left to right; that is in `24298ff`. One part of T-41 can't be told apart from the outside, and the
row says so.

Round 24 built E-21, editing Markdown, HTML and text documents, as planned in TODO.md:
- phase 1 (`0ee38a7`): the raw editor (CodeMirror 5, self-hosted with pinned hashes), the page beside it,
  new documents, saving in place or as a copy, and drafts;
- phases 2 and 3 (`efae5f8`): WYSIWYG editing of HTML and Markdown, with what the page's cleaning removes kept
  aside and written back, and a Markdown writer of its own.

Two reviewers then looked at it: one at the write-back and its security, one at the editor's flows. They found
no critical items. What they found was fixed in `9a6889f`, each fix with a test that fails on the code before
it:
- **High:** H-21 to H-25.
- **Medium:** M-88 to M-101.
- **Low:** L-235 to L-245.

Two things they noted are left as designed: the code button makes plain-text code of a selection (Markdown's
inline code holds no formatting), and pasted pictures from other sites are kept in the text (the frame's policy
keeps them from loading while remote content is off).

The second loop built E-24 (`54916c8`): `?edit=path` opens a document straight into the editor (a new, empty one
if it isn't there), and `?get=address` opens a book or document by its address, on this site or another that
allows it with CORS. A third review, of loop 1's fixes, found no critical items; what it found was fixed in
`7634901`, each with a test that fails on the code before it:
- **High:** H-26.
- **Medium:** M-102 to M-105.
- **Low:** L-246 to L-258.

One small thing is left as it is: HTML written back from the page loses a line break straight after `<pre>`
or `<textarea>`, which a browser ignores anyway (the page is the same).

A fourth review, of E-24 and loop 2's fixes, found no critical or high items. What it found was fixed in
`d6ec28d`, each with a test that fails on the code before it (the read-only ones checked by reading):
- **Medium:** M-106 to M-108.
- **Low:** L-259 to L-265.
It found nothing in a hostile document from another site that could run, reach the logging server, or touch
the reader's own storage.

The fourth loop built E-23 (`d4922f4`): an EPUB's chapters can be edited with the same editor, kept as edited
across chapters, and the book saved re-packed (over its file when it came from the file picker), or the chapter
downloaded alone; XHTML chapters must stay well-formed.

A fifth review, of E-23 and loop 3's fixes, was fixed in `917bda1`, each with a test that fails on the code
before it (the read-only ones checked by reading):
- **High:** H-27, H-28.
- **Medium:** M-109 to M-113.
- **Low:** L-266 to L-273.

The sixth and last loop's review found no critical or high items. What it found was fixed in `ec32ab0`, each with
a test that fails on the code before it, except L-276 and L-277 (checked by reading):
- **Medium:** M-114.
- **Low:** L-274 to L-279.
That was the last of the six loops. The reviews since E-21 was built found nothing open that doesn't need you:
E-25 and E-22 are next in TODO.md.

Then E-26, which you asked for: the contents, the bottom bar and the top bar as settings (in Settings and in
`reader-config.json`, lockable), with C, P and N to show or hide them, remembered; a tap at the top right corner
brings a hidden top bar back.

And E-27: the editor's Discard button (back to the text as last saved, after asking), with Done now keeping the
changes for documents too, as it already did for EPUB chapters.

Then the first part of E-22, as agreed: reading progress and finishing a book sent to the site. For a book opened
from a web address (not a file from the reader's computer, not the sample), the place goes to `API_PROGRESS`
(default `/api/progress`) as JSON a moment after the pages stop turning (or scrolling has moved a screen or more),
and on leaving the page; the first time the end is reached, `API_COMPLETE` (default `/api/complete`) is told once.
Each update says which book (identifier, fingerprint, path, address, kind, file name, size, title) and where
(section, section_percentage and book_percentage, 0 to 100). An address that doesn't answer with JSON is taken to
be no API until the page is reloaded. book_percentage counts each section by its size where that's known, and the
progress bar now shows the same number. Then `API_START` (default `/api/position`): asked as such a book opens,
with the same fields but no place; the site answers with section, section_percentage and book_percentage (all
null for a book it doesn't know), and the book goes there unless the reader has already moved. An answer that
isn't JSON means the site keeps no places, so progress isn't sent either. Signing in and the rest of E-22 are
still to come.

### Round 25

Round 25 is a full review of the repository at `dd1fa88` (after `API_START`) by three independent reviewers, each
on a copy of its own: one on reading progress and the open paths that feed it, one on the editor, settings and
the version tools, and one on everything else (the book pipeline, layout, read aloud, operations, docs and tests).
Each was given the code and the areas to cover, not the author's conclusions. None found a way for a book or
document to run script in the reader's page or reach another site. Findings:
- **High:** H-29.
- **Medium:** M-115 to M-122.
- **Low:** L-280 to L-289.
- **Tests:** T-43, T-44. **Documentation:** D-20.

Loop 1 fixed all of them (`b61ae9f`, `d108859`, `dc862b1`), each with a test that fails on the code before it,
except L-281 and L-282 (checked by reading). T-43, a workflow running the suite on every push, is left as it is by
your decision: it would cost about 40 minutes of GitHub Actions per push.

The second review (loop 2), by three new reviewers on `2237314`, checked loop 1's fixes and found that most hold.
It found regressions in M-118, M-119 and M-122, and a few more items (none critical or high):
- **Medium:** M-123 to M-125.
- **Low:** L-290 to L-298.
- **Tests:** T-45. **Documentation:** D-21.
(The third reviewer covered the new code and its area's interface; the ZIP reader, CSS cleaner internals, nginx and
the scripts weren't re-checked in this loop.)
Loop 2 fixed all of them in `0690e9c`, each with a test that fails on the code before it; L-297 is answered in the
README (updates can arrive out of order), and T-45 added the missing tests (L-282's passes on both, as loop 1 had
fixed it).

The third review (loop 3), by three new reviewers on `a830667`: one on loop 2's fixes (with a harness running the
text-file parting over a dozen kinds of real-looking files), one an adversarial pass on book content and the ZIP
reader (not re-checked in loop 2), one on operations, read aloud, the README and the tests. Findings:
- **High:** H-30.
- **Medium:** M-126 to M-130.
- **Low:** L-299 to L-307.
- **Tests:** T-46. **Documentation:** D-22.

*Reproduced* means confirmed in Chromium, Node or nginx against the real code; *read* means confirmed by
reading the code only.

**Tests.** All 360 tests pass. Six more need `SLOW=1` or `NETWORK=1`: the real Kokoro and Pocket TTS models,
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

Loop 3's findings are open (below), with the enhancements E-1 to E-4, E-6 to E-8, E-22 and E-25 (planned in
TODO.md). L-110 and T-43 are left as they are, by your decision (see Resolved).

## Open items

| ID | Title | Kind |
|---|---|---|
| H-30 | A book picture's blob takes the book's declared type: one declared `text/html`, opened in a new tab, runs the book's script as the reader (reproduced) | Security |
| M-126 | `section_percentage` is 100 for a section shown whole (L-298), so another device opens that chapter at its end | Bug |
| M-127 | Hard-wrapped text marked by indentation loses its chapter headings into the paragraphs (L-294) | Bug |
| M-128 | Unwrapped text with some indented lines is merged again (L-294 undoing M-122) | Bug |
| M-129 | Nested or unclosed `attr(` in a book's CSS hangs the tab (each one re-reads the rest of the sheet) | Hang |
| M-130 | nginx example: book files under `/bookshelf/` (and books under `/reader/`) opened directly run their scripts on the reader's origin | Security |
| L-299 | Unwrapped text with scene breaks and short lines isn't a paragraph per line (M-125) | Bug |
| L-300 | Indentation parting cuts lists, alternately indented poems and code (L-294) | Bug |
| L-301 | A host answering 403 for a missing file still stops a folder book being saved (M-124) | Bug |
| L-302 | `.gitattributes` misses the checksum lists, the workflow and `.gitignore` (M-121) | Tools |
| L-303 | With remote content on, an SVG `<set>` on `href` gets round link handling (the animation is only removed when remote content is off) | Hardening |
| L-304 | No limit on the total decompressed; entries can share data | Hardening |
| L-305 | Lowering "saved speech kept" (or 0) frees nothing; the sweep only runs on saving | Bug |
| L-306 | The export list's first shift-click uses the previous book's last-clicked item | Bug |
| L-307 | nginx example: its `add_header` drops server-level headers (HSTS) for `/reader/`; no `gzip_vary` | Docs |
| T-46 | Tests: the "until reloaded" half of a progress test can't fail; L-76's test can pass having tested nothing; the sample and the flush on opening another book aren't tested; saved speech eviction, media keys, the sleep timer while paused, `LOOKAHEAD_SEC`/`NCACHE_SEC`; the nginx types test is circular | Tests |
| D-22 | README: the Tests section (six servers, about 50 minutes); an empty 2xx answer (204) counts as no API | Docs |
| [E-1](#e-1-footnote-pop-ups) to [E-4](#e-4-dictionary-lookup), [E-6](#e-6-a-bookshelf-page) to [E-8](#e-8-install-as-an-offline-app) | Enhancements | — |
| [E-22](#e-22-a-server-api), [E-25](#e-25-add-remove-and-reorder-epub-chapters) | Server saving, EPUB chapters added, removed and reordered (plan in TODO.md) | — |

## Tests

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

### E-22. A server API
Optional, multi-user server calls: saving files and EPUBs, notes and bookmarks (for E-3), settings, and sign-in.
Reading progress and completion are sent already (see Resolved); the plan for the rest is in TODO.md.

### E-25. Add, remove and reorder EPUB chapters
Change an EPUB's chapters, keeping its package file and contents in step. The plan is in TODO.md.

## Suggested order

1. E-25, E-22, as laid out in TODO.md.
2. The other enhancements, as wanted.

## Resolved

From all reviews so far, with the commits that fixed them. An item left as it is says so in place of a commit.

| ID | Title | Fixed in |
|---|---|---|
| M-123 | Enter in a Markdown list puts a lone LF into a CRLF file (CodeMirror's `lineSeparator` and the list addon; M-118) | `0690e9c` |
| M-124 | A folder book with a remote (or missing) manifest item can't be saved at all (M-119) | `0690e9c` |
| M-125 | Unwrapped text with blank lines between paragraphs loses its verse blocks and two-line headings (M-122) | `0690e9c` |
| L-290 | Full screen with the top bar hidden keeps an empty 28 px strip above the page (L-289) | `0690e9c` |
| L-291 | A cleaned SVG in another encoding keeps its declaration but is stored as UTF-8: garbled text (L-287) | `0690e9c` |
| L-292 | The SVG cleaning keeps `<?xml-stylesheet?>` and href animations (defence in depth) | `0690e9c` |
| L-293 | A huge paragraph with no spaces (Chinese, Japanese) isn't split | `0690e9c` |
| L-294 | Hard-wrapped text that marks paragraphs by indentation, without blank lines, is mis-split | `0690e9c` |
| L-295 | `?edit=` of an EPUB at its last page sends `/api/complete` as it opens | `0690e9c` |
| L-296 | `?edit=` of an EPUB: a fast `/api/position` answer chooses the chapter the editor opens at | `0690e9c` |
| L-297 | Since L-280, two progress updates for a book can be in flight; a slow site may keep the older | `0690e9c` |
| L-298 | `book_percentage` stays under 100 at the end when the last section fits on one page or screen | `0690e9c` |
| T-45 | Tests for L-281, L-282, `?edit=` of an EPUB with the API, and the percentage at the end | `0690e9c` |
| D-21 | README: the finished mark is per browser; CRLF kept; Save asks about files changed on disk; a folder book needs its files; the hook and committing named paths | `0690e9c` |
| H-29 | An EPUB from another site (`?get=`) shared a site book's place and finished mark (same identifier): now keyed by its address | `b61ae9f` |
| M-115 | `?edit=` sent position and completion for a new document, and reported a short one finished as it opened for editing | `b61ae9f` |
| M-116 | The site's `section` for a comic depended on `COMIC_PART`: comics go by `book_percentage` first | `b61ae9f` |
| M-117 | Markdown write-back broke links and pictures whose text has `]` | `d108859` |
| M-118 | Editing a CRLF file turned its line endings into LF | `d108859` |
| M-119 | A folder book was saved without files that couldn't be fetched | `d108859` |
| M-120 | The pre-commit hook stamped a temporary index (`git commit -- index.html`), leaving the real one behind | `d108859` |
| M-121 | A CRLF checkout of the hook couldn't run, and the stamp script rewrote line endings: `.gitattributes`, endings kept | `d108859` |
| M-122 | A text file with one paragraph per line became one paragraph | `dc862b1` |
| L-280 | Leaving while a progress send waited for its answer lost the newest place | `b61ae9f` |
| L-281 | A late `/api/position` answer could move the page while the editor started (read) | `b61ae9f` |
| L-282 | A place taken from the loose record dropped its finished mark (read) | `b61ae9f` |
| L-283 | An HTML fragment whose script names `<body>` was written back as a whole document | `d108859` |
| L-284 | A link changed to a relative address got a live `href` in the page | `d108859` |
| L-285 | Save wrote over a file changed on disk since it was opened, without asking | `d108859` |
| L-286 | A huge paragraph or block of short lines was never split into sections | `dc862b1` |
| L-287 | SVG files used as resource documents were served uncleaned (the book policy stopped their loads) | `dc862b1` |
| L-288 | Names and ids hiding the page's own methods (`getElementById`) stopped a chapter showing | `dc862b1` |
| L-289 | The hidden top bar's corner button covered part of the page | `dc862b1` |
| T-43 | No workflow runs the suite on push | Left as it is, by your decision (Actions time) |
| T-44 | Tests for round 25's cases (progress with `?get=` and `?edit=`, leaving mid-send, text files, SVG resources) | `b61ae9f` to `dc862b1` |
| D-20 | README corrections (requests per address, finished on opening at the end, `?edit=` of an EPUB, the Settings list, pinned libraries) | `b61ae9f`, `dc862b1` |
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
| H-28 | Saving an edited EPUB destroyed a UTF-16 package file (read as UTF-8 and written back); the saved book no longer opened, and for a book from the file picker that was the only copy | `917bda1` |
| H-27 | WYSIWYG on an EPUB chapter with a wrapper (Calibre's `<div class="calibre">`, common) nested the wrapper inside itself, again on every editing session | `917bda1` |
| H-26 | WYSIWYG: a body holding one wrapper with a kept element (a script, a style) or a comment beside it, the usual `<div id="app">…</div><script>`, lost both the wrapper and the script when written back (HTML and Markdown) | `7634901` |
| H-25 | WYSIWYG Markdown: an empty paragraph (Enter at a paragraph's end) or a line break at a paragraph's end became a literal backslash | `9a6889f` |
| H-24 | WYSIWYG Markdown: a document starting with a rule had it written as `---`, then read as front matter, which hid the text after it and was written again (duplicated) on every flush | `9a6889f` |
| H-23 | WYSIWYG HTML: the body was found by a pattern that matched `<body` in a comment or the title, or stopped at a `>` inside an attribute: the file came back with its head turned into a comment or its body inside an attribute | `9a6889f` |
| H-22 | WYSIWYG HTML: a kept element (style, script) inside an SVG or a table was put aside as an HTML `<span>`, which the next parse moved out: the SVG lost its contents after the chip, the table its script | `9a6889f` |
| H-21 | A save still being written when another document was opened (or Done pressed) finished into the new document: it took the old one's text and name, and its next save wrote into the old file | `9a6889f` |
| H-20 | A fixed page coloured black on its html, in the black theme, was taken for one with no colour (the theme's colour was on html too) and shown white on white, even after a theme change | `165e1ba` |
| H-18 | Fixed-layout pages in the page layouts never saved the reading position or updated progress | `6f6bc97` |
| H-19 | The reader's base styles (Literata, sizes, theme ink) applied to fixed-layout pages: overflowing text, and light text on white pages in dark themes | `6f6bc97` |
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
| M-108 | Saving a site document to a file deleted another file's draft kept under that file name | `d6ec28d` |
| M-107 | Markdown written back after loop 2: a backslash at the end of a text lost the emphasis, link or code after it (written as `\<em>`, `\[`, `` \` ``) | `d6ec28d` |
| M-106 | `?get=` took a `data:` address (which has no host) and showed it with no note that it came from elsewhere; `javascript:` and `file:` failed with misleading messages | `d6ec28d` |
| M-113 | Saving over a picked EPUB then read the whole packed book into memory for the rest of the session; a failure to read it was swallowed, leaving reads from the overwritten file to fail (*read*) | `917bda1` |
| M-112 | `?edit=` on an EPUB that couldn't be opened put the default book's chapter in the editor and hid the error | `917bda1` |
| M-111 | WYSIWYG wrote an XHTML chapter named `.html` (no XML declaration) as HTML, so `<br/>` became `<br>` and the book couldn't be saved | `917bda1` |
| M-110 | A chapter kept malformed (Done, "keep it like this") was saved in the book unchecked when another chapter was saved | `917bda1` |
| M-109 | Files in another encoding were spoiled on save: an edited Latin-1 chapter written as UTF-8 under its old declaration, and the package (never edited) re-read as UTF-8, losing its accented letters | `917bda1` |
| M-114 | A folder book on a site that answers missing files with a "not found" page saved those pages into the packed EPUB as `META-INF/rights.xml`, `encryption.xml` and the like (which some readers take for DRM) | `ec32ab0` |
| M-105 | Changing the address of a link added while editing was ignored when written back (and the prompt didn't show its address) | `7634901` |
| M-104 | A draft made after a save that downloaded a copy (a document from the site, or opened with the file input) was kept but never offered again: it was tied to the copy, which the site or the file didn't have | `7634901` |
| M-103 | HTML with no `<html>`, `<head>` or `<body>` tags lost its doctype when written back (quirks mode) | `7634901` |
| M-102 | WYSIWYG Markdown: the wrapper fix wrote the whole wrapped document as HTML | `7634901` |
| M-101 | Editing could start during an audiobook export, replacing the sections the export was reading (*read*) | `9a6889f` |
| M-100 | Saving HTML as UTF-8 changed `charset=` inside a description meta's text, a `data-charset` attribute or a commented-out meta, and could leave the real declaration as it was | `9a6889f` |
| M-99 | WYSIWYG Markdown escaping: `!` before a link made an image, a heading's trailing `#` vanished, `---` and setext lines became rules and headings, `*` inside inline HTML became emphasis, adjacent or intraword emphasis broke, two lists merged, a list starting at 0 started at 1, a line break in a cell left a backslash, no-break spaces were lost | `9a6889f` |
| M-98 | WYSIWYG on XHTML wrote HTML: `<br/>` became `<br>` and `<div/>` swallowed what followed; the XML declaration's encoding wasn't updated | `9a6889f` |
| M-97 | WYSIWYG HTML without `</body>`, or a fragment with no document around it, lost what was outside the body (the doctype, a comment before `<html>`, a fragment's leading comment and style) | `9a6889f` |
| M-96 | WYSIWYG HTML with markup after `</body>` (which a parser moves into the body) wrote it twice | `9a6889f` |
| M-95 | WYSIWYG HTML: a kept element inside a table's rows moved in front of the table | `9a6889f` |
| M-94 | WYSIWYG: comments directly in the body or its wrapper were lost (HTML and Markdown), and a comment between two lists no longer kept them apart | `9a6889f` |
| M-93 | WYSIWYG Markdown: a wrapper the whole document sat in (a centred `<div>`, a common README pattern) was dropped | `9a6889f` |
| M-92 | On a narrow screen WYSIWYG opened on the read-only text tab, with the toolbar acting on the hidden page; the toolbar was clipped and "(unsaved)" cut off | `9a6889f` |
| M-91 | R opened reading aloud in Raw with no page shown (a check on a field that didn't exist) | `9a6889f` |
| M-90 | Reading aloud while typing in Raw beside the page repeated sentences: each new page started reading again from the top of what was shown | `9a6889f` |
| M-89 | WYSIWYG gave the focus to the read-only text (or nothing): typing right after Edit fired the reader's shortcuts (T switched the theme) or was lost | `9a6889f` |
| M-88 | Drafts were keyed by the position key: lost after a save (the size changed), shared by two files of one name and size, kept under the old name after Save as, and never offered for a new document once saved | `9a6889f` |
| M-87 | The facing page of a spread took clicks, keys and the wheel but not swipes; moving the mouse over it didn't wake the full-screen controls; it didn't close the menus or take a dropped book; C left the focus on it | `526c63e` |
| M-86 | Arrows in a right-to-left book's reflowable chapters went one way or the other depending on whether any page was fixed. Every right-to-left book now turns right to left, by your decision, and Settings' "Turn every book left to right" (`FORCE_LTR`) overrides it for books marked so by mistake | `24298ff` |
| M-85 | A fixed page's colours were judged once, possibly before a stylesheet from another site had arrived (with remote content allowed): white text on a white page; they are now judged on every fit and again when such a sheet loads | `dea8a59` |
| M-84 | Switching a fixed page into the scroll layout, or reopening it there, landed at its bottom (a side effect of L-223's fix); the place stays at the top, and progress counts a shown fixed page as read separately | `165e1ba` |
| M-83 | Making every fixed page's body white hid pages coloured on their html (or by bgcolor): white text on white (a regression from M-82's fix); the colours are now worked out once per page | `0e3ee93` |
| M-82 | In dark themes a fixed page that paints no background of its own showed its black text on the theme's black; it is now a white page unless the book colours it | `8bda4f7` |
| M-81 | A vertically written fixed page (html writing-mode: vertical-rl, common in Japanese fixed-layout books) sat flush right, and in the scroll layout its top couldn't be reached | `59c5761` |
| M-76 | A fixed page's own html sizing or body padding put it off-centre, clipped it, or made part of it unreachable | `6f6bc97` |
| M-77 | A fixed page's html background was replaced by the theme's | `6f6bc97` |
| M-78 | The reader's wrappers in a fixed page's body broke the book's "body > ..." selectors (positions, colours) | `6f6bc97` |
| M-79 | In the scroll layout with the read-aloud bar open, the bottom of a fixed page couldn't be scrolled into view | `6f6bc97` |
| M-80 | `vw`/`vh` and `position: fixed` in a fixed page measure the reader's frame; documented, a real fix filed as E-20 (*read*) | `6f6bc97` |
| M-75 | A folder locking KEEP_POSITIONS_DAYS applied its time to the whole site, over the reader's own ("keep forever" included); there the longest of the folders' times and the reader's now applies | `96e5832` |
| M-74 | Turning off full-precision voices broke Pocket TTS on a site without CDNs that self-hosts only the full-precision files, with a message for the site owner; the reader is now told which setting to change | `fd47b98` |
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
| L-205 | With shortcuts locked, the arrow keys stopped at the end of the Aa menu (a disabled item can't take focus); it is now aria-disabled | `96e5832` |
| L-206 | Pocket TTS told the reader to change a precision setting the folder had locked (*read*) | `96e5832` |
| L-228 | A fixed page with a slow picture from another site stayed blank until its load event (up to 6 s); it is now shown once parsed | `dea8a59` |
| L-229 | A fixed page coloured only under a media query kept its first judgement when the query stopped applying: black text on black | `dea8a59` |
| L-110 | No edit list for the AAC encoder's delay: each .m4b file starts with 20 to 45 ms of silence and its chapter marks fall that much early. WebCodecs doesn't report the delay, so an `elst` would have to guess it (too much clips speech) or measure it with a test encode; inaudible in speech | Left as is, by your decision |
| L-265 | Small things: a pending draft dropped (not moved in) when the page came back from the browser's cache; a policy block reported as CORS only; an unreadable folder book reported as having no container.xml; `?edit=` refused a name followed by a query; a created file's name could hold a slash; an unused option and a duplicated branch | `d6ec28d` |
| L-264 | The charset change ended a script's text at any `</script`, so a meta inside a string was changed | `d6ec28d` |
| L-263 | The wrapper fix (H-26) skipped every `<animate>`/`<set>`, but the write-back puts aside only those setting an address: the wrapper was written inside itself and the element twice | `d6ec28d` |
| L-262 | A fragment with a comment before its doctype lost the doctype (quirks mode) | `d6ec28d` |
| L-261 | The note that a document came from another site was replaced by the draft offer, and was gone once editing began | `d6ec28d` |
| L-260 | `?edit=` couldn't start a new Markdown or text file on a site that answers missing files with a page | `d6ec28d` |
| L-259 | A site address that redirects to another site opened its content with no note, through `?book=` too (the page policy's `https:` lets it through); `?get=` named the first site, not the one it came from | `d6ec28d` |
| L-273 | The well-formedness notice carried the parser's whole page of text; the chapter being edited was cleared a moment late (*read*) | `917bda1` |
| L-272 | Redirects on the reader's own site from http to https, or between `www.` and the bare name, counted as another site | `917bda1` |
| L-271 | `?get=` of an EPUB redirected to another site showed no note naming it | `917bda1` |
| L-270 | A chapter encrypted with DRM could be edited, and would have been saved in the clear under an entry still marked encrypted (*read*) | `917bda1` |
| L-269 | Fixed-layout and SVG pages offered WYSIWYG, where typing did nothing; they are edited raw | `917bda1` |
| L-268 | One unreadable entry stopped the whole save with a message that didn't say what to do | `917bda1` |
| L-267 | Folder books lost META-INF files other than the container, encryption and Apple files when packed | `917bda1` |
| L-266 | `dcterms:modified`: the first matching meta was changed, even one refining something else; an EPUB 3 package without one didn't get one | `917bda1` |
| L-279 | The unreadable-entry message had no full stop | `ec32ab0` |
| L-278 | Switching Split on a fixed-layout page saved Raw (forced there) as the editing mode chosen | `ec32ab0` |
| L-277 | `?get=` of a folder book sent on to another site said only that it had no container.xml (*read*) | `ec32ab0` |
| L-276 | The redirect check let any https port on the same host, and a move from https to http, count as the same site (*read*) | `ec32ab0` |
| L-275 | A package named in container.xml in another case than in the archive didn't get its date updated | `ec32ab0` |
| L-274 | A package written with an `opf:` prefix kept its old date and got a second, unprefixed `dcterms:modified` | `ec32ab0` |
| L-258 | `editFocus` didn't keep the page's scroll; a draft kept for leaving came back after the page returned from the browser's cache, or after Done discarded it; a site document saved to a file kept the site's draft key (*read*) | `7634901` |
| L-257 | An apostrophe in an unquoted attribute value made the body unfindable, and the whole document was written out again | `7634901` |
| L-256 | The charset rewrite changed `<meta charset>` inside a script's string or a textarea | `7634901` |
| L-255 | The editor bar's arrow keys stopped at the paragraph-style select | `7634901` |
| L-254 | The editor bar squeezed the document's name to nothing on narrower screens | `7634901` |
| L-253 | A cancelled Save as left the HTML's charset changed in the text, and the document unsaved | `7634901` |
| L-252 | A page rebuild held back while reading aloud in Raw ran after switching to WYSIWYG; resuming dropped the word it was at | `7634901` |
| L-251 | Markdown written back escaped `_ > < ~ \| ]` and backslashes where nothing needed it, wrote emphasis inside a word as HTML, and dropped the blank line after front matter (the README now says lines are joined and reference links made inline) | `7634901` |
| L-250 | A Markdown line that was only emphasis around `-`, `=` or `*` was escaped as if it were a rule | `7634901` |
| L-249 | XHTML written back declared `xmlns:epub` and the XHTML namespace again on elements and kept markup | `7634901` |
| L-248 | Comments after `</body>` or `</html>` were dropped when markup followed `</body>` | `7634901` |
| L-247 | A `<body>` inside a `<noscript>` in the head was taken for the body, removing the head's end | `7634901` |
| L-246 | Finding the body lowercased the whole text for each script: offsets went wrong after a character whose lower case is longer (İ), and long documents took seconds | `7634901` |
| L-245 | Text dragged within the page being edited was copied rather than moved (*read*) | `9a6889f` |
| L-244 | Changing a block's style (paragraph to heading) dropped its id and class; splitting a block at its start left the id on the empty half | `9a6889f` |
| L-243 | A `<pre>` starting with blank lines lost them when written back | `9a6889f` |
| L-242 | A document's own `data-ed-keep` attribute was taken for one of the editor's chips: the element was lost and a kept script written twice | `9a6889f` |
| L-241 | The link and picture prompts accepted `java\tscript:` and similar (they never ran, but were written into the file) | `9a6889f` |
| L-240 | The editor bar, a toolbar, had no arrow-key movement; the arrows turned the page instead | `9a6889f` |
| L-239 | Open fell back to the file input after the picker failed, without the click a browser asks for; the notice's Open a book used the file input, so a document opened there couldn't be saved in place (*read*) | `9a6889f` |
| L-238 | Ctrl+F in the page being edited went to the browser's find, not the reader's search (*read*) | `9a6889f` |
| L-237 | Leaving the page within a moment of typing in WYSIWYG gave no prompt and kept no draft (*read*) | `9a6889f` |
| L-236 | Done while CodeMirror loaded left an unused editor behind; after Save as the information kept the old file name; Done left the focus nowhere | `9a6889f` |
| L-235 | Text typed while a save was being written lost its draft | `9a6889f` |
| L-234 | EPUB 2's fixed-layout meta or Apple's display options turned an EPUB 3 book marked reflowable into a fixed one; every reflowable folder book asked for Apple's file (a 404) | `526c63e` |
| L-233 | In full screen the facing page kept its shadow while the page lost it | `526c63e` |
| L-232 | A spread whose facing page couldn't be shown reloaded the page on every resize, theme change or opening of the read-aloud bar | `526c63e` |
| L-231 | Turning from spread to spread (or reading aloud on into the facing page) showed the new page beside the old facing page, or on the wrong side, until its own facing page loaded | `526c63e` |
| L-230 | Progress counted the page still in the frame while the next one loaded; the time left of a shown fixed page disagreed with the 100% bar and could vanish (*read*) | `dea8a59` |
| L-224 | The time left vanished on fixed pages in page layouts (the same side effect) | `165e1ba` |
| L-225 | A fixed page's first paint showed black text on the dark theme before its colours were judged; it is now hidden until then | `165e1ba` |
| L-226 | A fixed page that fits without scrolling counted as unread in the scroll layout; a shown fixed page now counts as read in every layout | `165e1ba` |
| L-227 | A clear body with a partly transparent background image wasn't made white (*read*) | `165e1ba` |
| L-221 | The read-aloud sentence highlight on a dark fixed page was light pink behind light text; it now has dark text | `0e3ee93` |
| L-222 | A fixed page whose body background is "none" showed black text on black in dark themes; it is white when the page has no colour of its own | `0e3ee93` |
| L-223 | A fixed-layout book never reached 100%: each page counted as not yet read | `0e3ee93` |
| L-218 | The read-aloud sentence highlight on a fixed page used the dark theme's maroon behind the page's black text | `8bda4f7` |
| L-219 | A comic switched to another layout just after scrolling opened at the page before the scroll | `8bda4f7` |
| L-220 | In a manga a sideways trackpad swipe went the opposite way from a touch swipe | `8bda4f7` |
| L-216 | A fixed page that clears html's background spread its body's colour over the whole frame (a regression from M-77's fix) | `59c5761` |
| L-217 | fixedSize looked the item up by path, so a fallback page shared by two items could take the other's layout (*read*) | `59c5761` |
| L-209 | A manga's odd last page and its cover's pairing: kept as they are, by your decision (E-20) (*read*) | — |
| L-210 | The text size, spacing and font buttons do nothing on fixed pages; documented (*read*) | `6f6bc97` |
| L-211 | A spine item shown through a manifest fallback wasn't treated as fixed (*read*) | `6f6bc97` |
| L-212 | The information panel said "Reflowable" for a book whose pages are fixed one by one (*read*) | `6f6bc97` |
| L-213 | A comic switched into the scroll layout went by fraction, not the page it was on | `6f6bc97` |
| L-214 | A comment said fixed pages are scaled "up to their full size" (they go up to twice) (*read*) | `6f6bc97` |
| L-215 | lookObf's new rule could unobfuscate a plain font differing in case from the listed one; now only the file the book opens for that name | `5dafde4` |
| L-208 | An obfuscated font whose name in encryption.xml differs in case from the file was left obfuscated when the page named the file exactly (found by a T-20 test) | `fea7773` |
| L-207 | The measured engine-list width may clip text in Safari, whose arrows take more room; `field-sizing: content` where supported (*read*) | `96e5832` |
| L-201 | Settings could be opened before the site's values were known ("this site's default is undefined"; Restore defaults left `data-theme="undefined"`) | `fd47b98` |
| L-202 | Days to keep positions under one rounded to 0, "keep forever" | `fd47b98` |
| L-203 | In forced-colours mode the chosen theme card couldn't be told apart | `fd47b98` |
| L-204 | A folder's default theme still flashed in late; it's now remembered per folder for the script in `<head>` | `fd47b98` |
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
| T-42 | The L-94 test waited a fixed 3 s for reading to reach the chapter's end, and could pass without its fix on a slow machine; it now waits for a signal from the reader | `09956a7` |
| T-41 | The first half of the keepPart test never reached keepPart. It now does, with a busy voice waited for until it counts as gone. An empty file fails to finish anyway, so the `fileSecs > 0` guard itself can't be told apart from the outside: what's checked is that no file appears. The second half's comment says why the files count as already there | `09956a7` |
| T-40 | The L-170 test passed without its fix: it left the chapter its third retry either way | `09956a7` |
| T-39 | No test checked that a fixed page becomes visible; a late stylesheet and a media query; comic tests waited set times; a stall queued by a failed test could reach the next | `dea8a59` |
| T-38 | A black-html page in the black theme and after a theme change; a fixed page switched to, or reopened in, the scroll layout; the time left on fixed pages | `165e1ba` |
| T-37 | The fixed tests' page-turn helper didn't wait for the new page; no test of pages coloured on html, by bgcolor, or with a body of "none", or of the last page's 100% | `0e3ee93` |
| T-36 | Fixed tests waited a fixed time per page turn; no test of an unpainted fixed page, its highlight colours, manga trackpad swipes or a switch right after scrolling; a race in the mock server's stall queue | `8bda4f7` |
| T-35 | Vertical writing and a cleared html background in fixed pages; the Cancel test's timing margin | `59c5761` |
| T-34 | New tests that passed with their bug restored: stalled streams (no time limit), the 409 export (never left the voice's own retries), the Cancel timer, reading past the non-page note and an untyped item, the voices folder, the server's types; and fixed waits | `5dafde4` |
| T-33 | T-20, most of it: stalled server streams before any audio and partway (L-75, L-100), with a test setting for the time allowed; fallback-page pictures (L-90); the range probe on this site and another (L-91, L-103); narration before a picture page (L-93); the sleep timer in a newly opened book (L-96); the non-page note (L-153, L-172) and ZIP64 records (L-153); obfuscated fonts by folded name (L-137); the Cancel question (L-158) and a busy (409) server during an export; the export's saved-audio room; refusals checked after a wait (T-18) | `fea7773` to `9be8cdd` |
| T-20 | Test gaps: the rest of the list: the sleep timer while looking past picture pages (L-94), a search during the first indexing (L-170), a folder book's font after closing (L-153), keepPart's limits, the voice label during an outage (L-161), and a crashed Pocket worker (L-165); each fails without its fix | `1ebfd84` and after |
| T-16 | Coverage gaps: config files' TTS_SERVER, SPAN_MAX, SAVED_AUDIO_MB, SEARCH_MAX, COMIC_PART, BOOKSHELF and KEEP_POSITIONS_DAYS 0; If-Range on range requests; the checksum lists against each script's `--list`; the test server now takes nginx.conf.example's types | `9172885` |
| T-32 | A locked days-to-keep against other folders' positions, the Aa menu with shortcuts locked, the engine list never narrower than its text | `96e5832` |
| T-31 | The Settings button before the config, under a day, forced colours, a folder's early theme, Pocket with only the 8-bit model and no CDNs | `fd47b98` |
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
| D-19 | README: what the facing page of a spread does and doesn't do, right to left in mixed books, the scroll layout's colours | `09956a7` |
| D-18 | README: when a fixed page is shown white; manga trackpad swipes | `0e3ee93` |
| D-17 | README: the scroll layout fits a fixed page to the width up to twice its size | `8bda4f7` |
| D-16 | A code comment had moved to the wrong line | `59c5761` |
| D-15 | README: what fixed-layout pages don't do; SPAN_MAX's wording for sentences over 220 characters | `6f6bc97`, `5dafde4` |
| D-14 | README: "any of them" can be locked (only the ⚙ ones can); a locked shortcuts and days-to-keep | `96e5832` |
| D-13 | README: themes didn't mention a folder's default; values now whole numbers; what a reader's precision choice needs on a self-hosted site | `fd47b98` |
| D-12 | The settings code comment and REVIEW.md said a reader's value is dropped when it equals the site's | `e7d1096` |
| D-11 | README: changing COMIC_PART "doesn't move readers" wasn't true yet, and places saved by earlier versions weren't mentioned | `7bbe17b` |
| D-10 | README: "a time a reader sets in Settings is used as it is" wasn't true when it equalled the folder's | `3c07e06` |
| D-9 | REVIEW.md: stale round, line count, test counts and "open" sentences; L-18's removal unexplained | this update |
| E-12 | Hide French from Pocket TTS until it works | `590aab6` |
| E-13 | A quieter read-aloud bar: short voice names (Device, Kokoro, Pocket, Server); the sleep timer off unless `SLEEP_TIMER` | `23100cb` |
| E-14 | The time left in the footer off unless `TIME_LEFT` | `23100cb` |
| E-16 | Default book: `default.epub`, else `default.md` (an ordered `DEFAULT_BOOK` list, with "not found" page checks) | `a29374c` |
| E-10 | Audiobook export: chosen chapters into one `.m4b` or one per chapter, with any natural voice | `1b3516b` to `ed1aa5e` |
| E-5 | More themes: Sepia and Black (for OLED screens) as well as Light, Dark and System | `21c0be9` to `fd47b98` |
| E-11 | A settings panel: a Settings dialog for the theme and the reader options that were only in `index.html` or `reader-config.json` | `21c0be9` to `fd47b98` |
| E-23 | Editing an EPUB's existing chapters with the editor; the book saved re-packed (mimetype first and stored, `dcterms:modified` updated; over its file where the browser allows it) or the chapter downloaded alone; XHTML kept well-formed | `d4922f4` |
| E-22 (progress) | Reading progress and finishing a book sent to the site (`API_PROGRESS`, `API_COMPLETE`), and the place asked for as a book opens (`API_START`), for books opened from a web address; an address that doesn't answer with JSON is left alone until the page is reloaded; book_percentage (and the progress bar) counts sections by their size | this update |
| E-28 | Settings shows the version (one patch above the latest release, stamped by `tools/stamp-version.py`, with a GitHub link), and Generate config gives every setting in use as a `reader-config.json`, to copy or download | this update |
| E-27 | Discard in the editor (the changes since the last save thrown away, after asking; for an EPUB, this chapter's); Done keeps a document's changes, unsaved, shown in the reading view and asked about before another book | this update |
| E-26 | The contents (C), the bottom bar (P) and the top bar (N) as settings, in Settings and `reader-config.json` (`SHOW_CONTENTS`, `SHOW_PROGRESS`, `SHOW_TOPBAR`), the keys remembered; a tap at the top right corner brings a hidden top bar back | this update |
| E-24 | `?edit=path` opens a document into the editor (a new, empty one if missing); `?get=address` opens a book or document by its address, on this site or another that allows it (CORS); `GET_URLS` turns it off | `54916c8` |
| E-21 | Editing Markdown, HTML and text documents: WYSIWYG and raw (CodeMirror) with the page beside, new documents, saving in place or as a copy, drafts (plan and as-built notes in TODO.md) | `0ee38a7`, `efae5f8`, `9a6889f` |
| E-20 | Fixed-layout follow-ups: a frame of its own for each page in the page layouts (vw/vh, fixed positions and media queries the page's own), two-page spreads by the pages' sides or with the cover alone, right-to-left fixed-layout books, EPUB 2 fixed layout; manga spreads kept as they are, by your decision | `6c5cc87` |
| E-9 | Right-to-left manga: spreads read right to left in two columns, the left arrow and a swipe to the right go on | `cc60fa5` |
| E-15 | Fixed-layout books: pre-paginated pages shown a page at a time at their own size, scaled to fit, with their own styles | `20d2582` |
| E-18 | Let a site lock settings: a `LOCKED` list in reader-config.json names options readers can't change in that folder | `c7b0749`, `96e5832` |
| E-19 | The read-aloud engine list only as wide as the engine chosen, not its longest option (user request) | `c7b0749`, `96e5832` |
| E-17 | Audiobook formats: `.opus` (Opus in Ogg, chapter comments) and `.mp3` (lamejs, ID3 chapters) as well as `.m4b`; those this browser can't make greyed out with the reason | `2c7386b`, `895bafa`, `8af5e59`, `0a4902b` |
