# Code and security review

Review of the repository (2026-11-17 to 2026-11-23, rounds 34 to 40): `index.html` (about 11,700 lines), the fetch scripts,
`tools/make-checksums.py`, `tools/build-*-engine.sh`, `nginx.conf.example`, `.github/workflows/slow.yml`, the README and the test suite in
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
Loop 3 fixed them in `8e7fc77` and `58499fb`, each with a test that fails on the code before it (the text-file
parting was rebuilt, and checked over the reviewer's dozen kinds of file as well as the suite's). L-301 is left as
it is: a 403 can't be told from a file that is there but forbidden, and refusing the save is the safe side.
`LOOKAHEAD_SEC` and `NCACHE_SEC` still have no test (T-47).

The fourth review (loop 4), by three new reviewers on `e83b33e`: one on loop 3's fixes (running the old and new
text-file parting side by side, and fuzzing the CSS change), one an adversarial pass on the reader's own page and
storage, one a regression pass using the reader as a person would. Findings:
- **High:** H-31.
- **Medium:** M-131 to M-134.
- **Low:** L-308 to L-317.
- **Tests:** T-48. **Documentation:** D-23.
M-134, L-308, L-309 and L-310 were fixed at once, in `0095173`; the rest in `5aeab40`, each with a test that fails
on the code before it, except L-316 (checked by reading: an archive JSZip reads whole that overlaps is hard to make).
The text-file parting was adjusted again and checked over the reviewers' files (now in `tests/text-shapes/`) and the
earlier dozen kinds.

The fifth review (loop 5), by three new reviewers on `0756fa1`: one on loop 4's fixes (none critical, high or medium),
one a fresh adversarial pass (with the nginx example in place, no way found to get an active document into the
reader's origin), and one on plain-text files of the kinds people read (52 written for it and 18 real Project
Gutenberg books: no regression from before this round; the three medium items there were already so). Findings:
- **Medium:** M-135 to M-139.
- **Low:** L-318 to L-330.
- **Tests:** T-49. **Documentation:** D-24.
Loop 5 fixed them in `c9e6702`, each with a test that fails on the code before it, except L-318, L-319 and L-320
(checked by reading) and L-324 (timed in Node: a 30 MB line now splits in 48 ms). The text-file changes are the text
reviewer's, checked over their 52 files and the 18 real books, and the suite's text shapes.

The sixth review (of loop 5), by three new reviewers on `54ce69c`: one on loop 5's fixes, one a fresh full pass of
the areas this round had barely touched (search, layouts, read aloud, export, settings, the README), and one a
further adversarial pass (no way found to run script in the reader's origin through the reader itself). Findings:
- **High:** H-32, H-33.
- **Medium:** M-140 to M-143.
- **Low:** L-331 to L-339.
- **Documentation:** D-25, D-26. **Enhancement:** E-29 (vertical text laid out vertically).
M-140, L-331 and L-332 were fixed at once, in `a9fee6d`; loop 6 fixed the rest in `44e4e05`, each with a test that
fails on the code before it, except L-334 and L-337 (checked by reading and in Node). H-33 is fixed by laying vertical
text out across, so it can be read; laying it out vertically is the new E-29.

The seventh and final review (of loop 6), by three new reviewers on `8a89dec`: one on loop 6's fixes, one a whole-reader
pass as different kinds of reader, and one a last adversarial pass. None found anything critical or high, and the
adversarial pass found no way for hostile content to run script in the reader's origin, freeze the tab or reach
another site without the reader choosing it. Right-to-left pagination of EPUBs held in every case tried. What they
found is mostly in loop 6's new code (links between documents, right-to-left documents) and is left open: that was
the last of the six loops.
- **Medium:** M-144 to M-148.
- **Low:** L-340 to L-347.
- **Tests:** T-50. **Documentation:** D-27.


### Round 26

Round 26 is a full review of the repository at `6808bfe` by three independent reviewers, each on a copy of its own.
It came after the features added since round 25:
- three more reading fonts and `ADDITIONAL_FONTS`;
- `CONTENTS_TITLE`, `NAVBAR_ICON` and `NAVBAR_LINK`;
- the contents' title shown only while the top bar is hidden;
- the `SHOW_*` switches for the top bar's controls, and the Text settings dialog;
- the page-turn step taken from the text's exact width.

The reviewers covered:
1. Those features, and the settings and interface they touch.
2. An adversarial pass on everything a book, document or address controls, plus the book pipeline and paged
   layout, re-checking the open items.
3. Read aloud, reading progress and positions, the editor, operations, the README and the tests.

Each was given the code and the areas to cover, not the author's conclusions. The first two found the same paging
problem as the third (M-149), and two found the same `fetch-fonts.sh` path problem (L-349); each is listed once.

None found a way for a book or document to run script in the reader's page.

**A link reaching another site (H-34).** A document's link written as `.///host/x.html` resolves to a
protocol-relative address, and is opened as a linked document from that other site. This works even with external
links off. It comes from M-141's links between documents.

**A small book freezing the tab (H-35).** A 144 KB EPUB whose chapter inflates to 40 MB of markup freezes the tab
for minutes, and a 1 MB one crashes it: no size limit applies to markup short of `MAX_ENTRY` (512 MB).

**This session's page-turn fix, only partly right.**
- It took the exact width but not the column gap, which Chromium snaps to 1/64 px, so the step still drifts over
  hundreds of pages (M-150).
- Its bounding-box width now counts a border, zoom or transform that a book's own CSS puts on the reader's column
  flow. Padding there was already miscounted before (M-149).

**Re-checked open items.** M-144 to M-148, L-340, L-342 and L-346 still reproduce. L-341, L-343 to L-345 and L-347
are unchanged in the code. They stay open.

**What held up.**
- **Reader and site addresses:** `siteOrWeb`, the `SHOW_*` switches (hidden at every width and out of the Tab
  order), the Text settings dialog's focus and keys, and `?book=`/`?get=` address checks.
- **Containment:** `dirSource.url` stays inside the book's folder; the ZIP reader's limits and the position keys hold.
- **Progress API:** its fields, flushing and guards.
- **Ordinary books:** paging across resizes and reloads, left to right and right to left.
- **Version tools:** the stamp script and the pre-commit hook.

Findings:
- **High:** H-34, H-35.
- **Medium:** M-149 to M-152.
- **Low:** L-348 to L-358.
- **Tests:** T-51, T-52. **Documentation:** D-28 to D-31.

Afterwards `555ff0c`, `9dc26bc` and `2eb3e9d` fixed H-34, H-35 and M-149 to M-152, each with a test that fails on the
code before it. The paging fix was checked over 300 page turns in one and two columns, at three window widths and
four text widths, and with nine kinds of book CSS on the column flow: no text past an edge, and a search hit 1,200
paragraphs in shown on the page reached (the code before it was up to 688 px off).

### Round 27

After round 26, every open item that wasn't an enhancement was fixed (`4ea6db9` to `8f1df5b`), each with a test that
fails on the code before it, except L-347 (checked by reading) and T-47's `NCACHE_SEC` half (no practical test).

Round 27 is a full review at `8f1df5b` by three independent reviewers, each on a copy of its own:
1. A regression review of those fixes.
2. An adversarial pass on everything a book, document, link or address controls, aimed at the code changed.
3. The whole reader used as different kinds of reader would, plus operations, the README and the tests.

Each was given the code and the areas to cover, not the author's conclusions. All three found that Back or Forward to
an `?edit=` entry opens the default book (M-153). Two found the same gaps in the paging pins and the same compressed
folder files. Each finding is listed once.

None found a way for a book or document to run script in the reader's page, or to reach another site or the reader's
config. The full suite passed on all three copies (421 passed).

**Paging pins that don't hold (H-36, H-37).** Round 26's M-149 pins can still be undone by any book. A book can set
`--spine-x` with `!important`, which beats the reader's inline value. A book's `@layer` rules beat every important
declaration outside a layer, so the reader's pins lose to them.

**What held up.**
- **Links:** H-34's same-origin check (including backslash, tab and encoded tricks); `?get=` documents' links.
- **Page geometry:** M-150 at device pixel ratios 1 to 1.5 and several widths, right to left included; M-146,
  M-147's page logic, L-341, L-342.
- **Fonts and the top bar:** the font fixes, the top-bar fixes, L-343 to L-345, L-357.
- **Settings and README:** the `SHOW_*` switches; the settings table against the code.
- **Operations:** the nginx example, the fetch scripts' option parsing, the version tools.

Findings:
- **High:** H-36, H-37.
- **Medium:** M-153 to M-160.
- **Low:** L-359 to L-372.
- **Tests:** T-53, T-54. **Documentation:** D-32. **Enhancement:** E-30 (right-to-left text in the raw editor).

Afterwards `9c9c624` fixed H-36, H-37 and M-153 to M-155, each with a test that fails on the code before it. Eleven kinds
of book CSS aimed at paging (the reviewers' cases) are paged as a plain book is, to the last paragraph. All 426 tests
pass.

### Round 28

Since round 27 there have been two sets of changes:
- **Fixes:** H-36, H-37 and M-153 to M-155 (`9c9c624`), then the first iteration of a fix-and-review loop. That iteration
  fixed M-156 to M-160, L-359 to L-372, T-53, T-54 and D-32 (`726d31c` to `787184b`), each with a test that fails on the
  code before it, except L-371 and L-372 (messages and docs).
- **Markdown enhancements:** math, footnotes, alerts, emoji shortcodes and syntax highlighting (E-31 to E-35).

Round 28 is a full review of those changes at `787184b` by three independent reviewers, each on a copy of its own:
1. A regression review of the fixes and the new Markdown features.
2. An adversarial pass aimed at the new code.
3. The whole reader as different readers use it, plus operations, the README and the tests.

All three found that the reader's CSS layer, `@layer spine-pins`, has a fixed name a book can use, which undoes the
paging pins (H-38). None found a way for a book or document to run script in the reader's page or reach another site.
The full suite passed on all three copies but for one test that races a notice (T-55).

**My own enhancements, slow and lossy (H-40, H-41, H-43).** The new Markdown features brought these:
- **H-40:** the math and footnote extensions made opening Markdown take time growing with the square of its length
  (a 2 MB novel: 40 s).
- **H-41:** a few KB of TeX can freeze the tab.
- **H-43:** text typed in the WYSIWYG editor after an emoji, a footnote mark or a formula is lost.

**What held up.**
- **Math:** Temml with `trust:false` refused every command that loads or styles.
- **Markdown basics:** dollar amounts stay text; alerts in their forms.
- **Fixes:** most of the iteration's fixes.
- **Settings and libraries:** the settings table against the code; the libraries against their checksums.

Findings:
- **High:** H-38 to H-43.
- **Medium:** M-161 to M-168.
- **Low:** L-373 to L-383.
- **Tests:** T-55, T-56. **Documentation:** D-33. **Enhancement:** E-36.

### Round 29

Since round 28, the second iteration of the fix-and-review loop fixed all of round 28's findings but T-47
(`5f32611` to `6dc5257`), each with a test. Round 29 is a full review at `6dc5257` by three independent reviewers on
copies of their own: a regression review of those fixes, an adversarial pass, and the whole reader as different
readers use it, with the README. The full suite passed (460, none failing, 6 skipped).

**What it found.** A book can still stop paging with `offset-path`, or with `columns` on `html` (H-44), and
`column-span:all` inside a chapter breaks paging for ordinary books too (M-169). Three ways remain to make opening
Markdown slow (M-170 to M-172), two of them brought by my own fixes. A document's raw HTML can carry the editor's own
marks and change what one edit writes back (M-173). The limit on TeX expansion turns away ordinary formulas (M-176).
The right-to-left footer of L-379 points both buttons inward (M-177), and a note's unindented next line takes a
`---` or `***` (M-178).

**What held up.** The names drawn at random can't be guessed or read; `@property` and transitions are pinned;
nested SVGs are refused; no way was found for a book to run script in the reader or reach another site; most of
iteration 2's fixes held under round trips of every Markdown form.

Findings: **High** H-44. **Medium** M-169 to M-179. **Low** L-384 to L-397. **Tests** T-57. **Docs** D-34.

### Round 30

Since round 29, iteration 3 of the loop fixed all of round 29's findings (`c0e4fa1` to `39d3aff`); the full suite passed
(469). Round 30 is a full review at `39d3aff` by three reviewers on copies of their own (regression, adversarial, the
reader as its readers use it, with the README). One test failed once, a race (T-58).

**What it found.** More CSS a book can use to stop paging: `column-height`, the html box's margin and width, the
clip's writing mode, scroll snapping (H-45, M-180, M-181). The footnote mark's search was left unbounded (H-46), and
marked itself takes time with the square of a paragraph's emphasis delimiters (H-47). Typing into a formula is lost:
Chromium ignores `contenteditable=false` on MathML (H-48). My M-173 fix strips text that merely mentions the marks and
can be passed with `/` (M-182, M-183); my M-179 marker collides with U+E000 (M-185); Enter twice in a note loses text
(M-184).

**What held up.** The round 29 fixes otherwise, the README against the code (no findings), nothing letting a book run
script or reach another site.

Findings: **High** H-45 to H-48. **Medium** M-180 to M-185. **Low** L-399 to L-408. **Tests** T-58.

### Round 31

Since round 30: iteration 4 of the loop fixed round 30's findings (`b3636b6` to `56f3a4e`, marked 18.1.3 among them),
T-47 was left as it is by your decision, and E-37 added math and code highlighting to HTML pages and EPUB chapters,
with `MATH_DELIMITERS` (`1004c3c`, `966c3e7`). Round 31 is a full review at `9a03769` by three reviewers on copies of
their own (regression, adversarial, the reader as its readers use it, with the README). The full suite passed (480, none
failing, 6 skipped).

**What it found.** Mostly E-37, which was new: unclosed `\(` freezes the tab (H-49); TeX that fails is never charged to
the math budget, and tens of thousands of small formulas take minutes to lay out (H-50); highlight.js takes time with the
square of a long word, now in every HTML page and chapter (H-51). Search, the audiobook and read-aloud ahead read the raw
TeX the page no longer shows (M-186); wide display math overflows (M-187); the reader's code colours on a book's dark
background (M-188); a bad Marks around math value saved silently (M-192). And beyond E-37: `unspan` (L-400) can be
passed by an escaped name or a state that applies later (M-189); pseudo-elements push the page out of the frame (M-190);
a document's own `data-ed-unwrap` is unwrapped on write-back (M-191).

**What held up.** Temml with `trust:false` and highlight.js output through the cleaning: no script, no request to
another site; the session token can't be guessed or used; marked 18 renders as 15 did but for one blank line (L-414) and
CommonMark fixes; the editor with E-37 (the source while editing, math again after Done); the README's settings and
library versions.

Findings: **High** H-49 to H-51. **Medium** M-186 to M-192. **Low** L-409 to L-416. **Tests** T-59. **Docs** D-35.

### Round 32

Since round 31: its findings were fixed but T-59 (`cfb5b89`), and the version in Settings became the date and time it
was stamped (`3130972`, `9e527b6`). Round 32 is the final full review you asked for, at `3130972`, by three reviewers on
copies of their own (regression, adversarial, the reader as its readers use it, with the README); its findings are
recorded, not fixed. The full suite: two runs (mine and a reviewer's) lost 28 and 35 tests to the browser being closed
under them (another reviewer stopped every headless Chromium on the machine), and those files pass alone; the one real
failure, the Settings version test still expecting the old form, is fixed in `9e527b6`.

**What it found.** Some round 31 fixes don't hold: H-49's memo only helps within the last 4000 characters, so unclosed
`\(` is as slow as before (H-52); highlight.js's C#, C and C++ grammars take time with the square of a whole block in a
single call, past the budget (H-53); laying out the colours costs more than colouring (M-197); every `chapterDoc` gets a
fresh budget, so search and the audiobook over a book with math or code freeze a few seconds per chapter (M-193). The
column-span pin is beaten by an inline `!important` (M-194, a regression), passed by a "multi-column box" that isn't one
(M-195), and fixing a book's columns inline freezes its responsive layouts (M-196). Wide display math can't be scrolled
in the page layouts (M-198); the reader's code colours can still land on a book's dark background (M-199); pseudo-elements,
`html::marker` and `head` can still push the page (M-200).

**What held up.** No way for a book to run script or reach another site; Temml's single calls (160 ms at most); the
noncharacter fallback, the formula holder's token, Settings' check of Marks around math, the version stamp; search
beside formulas; the README's settings table and library versions.

Findings: **High** H-52, H-53. **Medium** M-193 to M-200. **Low** L-417 to L-422. **Tests** T-60. **Docs** D-36.

*Reproduced* means confirmed in Chromium, Node or nginx against the real code; *read* means confirmed by
reading the code only.

**Tests.** 448 tests: all pass at `787184b` but for one that races a notice (T-55). Six more need `SLOW=1` or `NETWORK=1`: the real Kokoro and Pocket TTS models,
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

### Round 33

E-46, ZONOS3-Mini in the browser, built in `6ef2a33` (the engine, `fetch-zonos.sh`, checksums), `d66077e` (the voice in
the reader, `zonosText`, tests) and `d432b4c`, then reviewed at `d432b4c` by one reviewer reading the code against the
engine's own source, with `zonosText` tried on about 150 inputs. Its findings are fixed in `31be1bc` (and the test
for H-54 in the commit after it); each fix's test fails on the code before it.

**The engine, checked for real.** Headless Chromium has WebGPU through SwiftShader (`--enable-unsafe-webgpu
--use-webgpu-adapter=swiftshader`), so the real engine was run, not only the stand-in: on its own it started in
6 minutes and spoke "Hello there." in 138 s (a CPU pretending to be a GPU: a real one is far faster); in the reader,
with the models from the same site, it listed its 27 voices and was reading the long book after 506 s. The build of
`zonos/engine/` is reproducible (two builds, the same SHA-256s), and `checksums/zonos.sha256` matches the downloaded
files hashed independently. Whisper heard the engine read "In 1984, Dr. Smith paid $5.50…" correctly even unspelled,
but writes numbers as digits whatever was said, so it can't tell how they were read: the text is spelled out first, as
ZONOS3's servers do.

**What it found.** The engine ends a stream as if finished when it fails once audio has started, and the reader kept
the cut-off clip for good (H-54). After a lost GPU, "Try again" reported the engine ready, though it was dead (H-55),
and passages in flight could wait for good, blocking the queue (M-201). `zonosText` made some correct English worse
(M-202); a download that stopped partway was used, with no fallback (M-203); smaller items L-423 to L-426; the
stand-in engine was kinder than the real one, so tests couldn't see H-54, H-55 or M-201 (T-61).

**What held up.** Samples split across chunks; cancelling (the engine's own abort); two loads at once; the
audiobook's snapshot of voice and language; the language mapping against the engine's 44 codes; paths with spaces in
`fetch-zonos.sh` and `make-checksums.py`; the other engines.

Findings (all fixed): **High** H-54, H-55. **Medium** M-201 to M-203. **Low** L-423 to L-426. **Tests** T-61.

**Tests.** 512 tests at `d432b4c`, before the fixes: all pass but the three new ones for this round's fixes (their
fixtures came after the suite's site was built; they pass with them), and six need `SLOW=1` or `NETWORK=1`. The ten
ZONOS3 tests pass after the fixes, and the five for this round fail on the code before them.

### Round 34

A full review at `a955cc8` (after E-46 to E-48 and L-427 to L-429), by three reviewers each on a copy of their own and
given the code and the areas to cover, not the author's conclusions: one adversarial on ZONOS3 and E-46 to E-48 (the
reader against the engine's own source, with a stand-in engine that can hang and Chromium's fake microphone); one on
opening and building books, security, the editor and themes (hostile books, round 32's fixes re-checked); one on the
reader as its readers and site owners use it (read aloud, Settings, the scripts, the README, the tests). Findings are
recorded, not fixed. Where two reviewers found the same thing it is one item; I re-read the code of each High item.

**What it found.**
- *The microphone.* Closing Settings while the browser is still asking for the microphone leaves it recording, for up
  to 30 s, with no controls in sight (H-56); a second Record before the first is allowed leaves a microphone stream
  open until the page closes and mixes its sound into later takes (H-57).
- *A book that freezes the reader.* The multi-column check (M-196's fix) can be made to call itself until the stack
  runs out, by a book rule on the attribute it marks boxes with (`[data-span-box]{display:contents}`): 12-15 s frozen
  and the chapter not shown (H-58). The M-194 fix also strips a book's inline `column-span` inside its own box (L-430).
- *Custom voices.* M-201 is back for them: if the engine dies while a voice is being made, reading waits for good
  (M-204). ZONOS3 waits for a HEAD request to every site voice before reading starts (M-205). A relative address shares
  its keys across folders, so one folder can be read in another's recording (M-206). A site that ran `fetch-zonos.sh`
  before E-48 has no speaker encoder, and every custom voice fails with a misleading 60-second message (M-207).
- *Themes across folders.* A site theme chosen in one folder leaves the page in light colours, with no theme checked,
  in a folder without it, and the one theme cache for the site is overwritten by each folder (M-208); themes whose
  names have no Latin letters or digits all get the same id and all but one are dropped, also from Generate config
  (M-209).
- Smaller items L-430 to L-439, tests T-62 and T-63, docs D-37 and D-38.

**What held up.** No way found for a book to run script, reach another site or leak data (the frame sandbox and
policy, `sanitize`, Temml with `trust:false`, escaped highlight.js output, the editor's paste allowlist, the nginx
example's sandbox header); H-52 is linear and H-53 stays within the page budget; ZONOS3's `.npy` embeddings, its
session header and `speaker_mode`, and the encoder progress match the engine's source; one encoding per voice,
serialized; saved-speech keys snapshot voice and language together, and renaming a voice keeps them; E-47 matches the
server's API.md; every setting with a variable has a row, the README's marks match the code, and Generate config
round-trips (but themes, M-209); `fetch-zonos.sh` writes NOTICE.txt last and pins `spk/`; the nginx policy covers the
engine's workers, WebAssembly and the microphone, and E-48 needed no change to it.

Findings: **High** H-56 to H-58. **Medium** M-204 to M-209. **Low** L-430 to L-439. **Tests** T-62, T-63. **Docs**
D-37, D-38.

**Tests.** 521 tests at `a955cc8`: 515 pass, none fail, and six need `SLOW=1` or `NETWORK=1`. The custom voice was also
read with the real engine (WebGPU through SwiftShader) before this round.

### Round 35

Round 34's High and Medium items fixed in `e50e041` (and L-430 with them), each with a test that fails on the code
before it; then a review of those fixes by two reviewers on copies of their own (one on ZONOS3 and the microphone,
one on the multi-column check and themes). It found that some fixes didn't hold or broke something else, and these
were fixed in `62de5b1`, again each with a test that fails on the code before it:
- L-430's move let an escaped inline `column-span` (`colu\6dn-span`) on a page whose styles don't seem to name columns
  span the reader's columns again (High): the override now runs on every page.
- Choosing System was overridden by a folder's default theme (M-208's change).
- A box that stops being a box on a timer (an animation) made page turns jump to the end of the chapter, a second or
  more each: boxes are marked again before a page is measured, keeping the page, not the fraction.
- M-204 held for the engine calls but not for fetching a site voice's recording; a voice is now made once per key by
  a job only a failed engine ends, which a reader that moves on stops waiting for without cancelling.
- H-57's one-start gate left Record doing nothing after a microphone question never answered: dropped, the
  generation token alone drops a superseded answer, and the wait is shown. Record again during a save keeps the new
  take; a double click on Save adds once.
- A site voice chosen while its version was being checked (M-205) was made twice: its check is awaited before its
  key is made, as the server voice's is. An old choice of an absolute address is carried over as the browser writes
  it (M-206).
- Explicit theme ids are taken before generated ones are numbered (M-209), in the config's order.

### Round 36

A review of `62de5b1` by one reviewer: no regression, and the round 35 fixes hold (no recursion; animated boxes
turn page by page in about 200 ms; one job per voice, always cleared, no unhandled rejection; the version check
awaited before the key; System kept; the config's order). Three Low items, open: L-440 to L-442.

**Tests.** 533 tests at `62de5b1`: 527 pass, none fail, and six need `SLOW=1` or `NETWORK=1`.

### Round 37

The Low items L-431 to L-442 fixed in `daa3a1a`, each with a test that fails on the code before it but L-432 (checked
by reading: a search and the page's math pass meeting midway couldn't be made to happen in a test).

**Tests.** 541 tests: the full run found two older tests expecting a refused Settings value to be put back, which
L-435 now keeps; changed to expect it kept (`d49d76c`), they pass, and the run passes but six that need `SLOW=1` or
`NETWORK=1`.

### Round 38

The tests and docs items T-59, T-60, T-62, T-63, D-37 and D-38 done in `4af6c6d`. D-38 changed the reader too: a
single string of `ZONOS_VOICES` in `reader-config.json` is taken entry by entry (its test fails on the code before).

**Tests.** 546 tests: 540 pass, none fail, and six need `SLOW=1` or `NETWORK=1`.

### Round 39

A full review at `8af8b21` (after rounds 34 to 38 and E-49, Refresh), by three reviewers each on a copy of their own:
one on reading aloud (every voice, saved speech, the audiobook, the fetch scripts), one on opening books, security,
layout, themes and the editor, and one on Settings, the top bar, the scripts, the README and the tests. No critical or
high item; no way found for a book or a config to run script, reach another site or leak data, and no resolved item
back. What it found:
- *Refresh (E-49).* A `?get=` book that was redirected is refreshed from the address it was sent to, so it opens at
  the start and its place is kept under a second key (M-210, two reviewers). Linked stylesheets and some files of a
  folder book still come from the cache (L-443); unsaved edits are let go before the refresh is known to work, with
  wording for another book (L-444); a folder book's name comes back percent-encoded (L-445); Refresh after a Save as
  to this computer brings back the site's copy (L-446); a site's API_START can move the reader back to an older place
  (L-450); the "changed on the server" note says to reload the page (L-451).
- *Saved speech.* The audiobook makes another language's chapters with the voice it began with but keys them with the
  voice worked out for that language, so reading aloud later plays one voice's audio as another's (M-211). A server
  voice's clip re-recorded while the page is open is still sent as it was, under the new version's key (L-447). A
  voice of your own deleted while its embedding is made comes back (L-448). The audiobook reads chapters in languages
  the voice doesn't speak, which reading aloud doesn't (L-449).
- *The top bar* runs past the window between 821 and about 915 px wide (a tablet in portrait), the title shrunk to
  nothing and Open off-screen; E-49 widened a gap that was there before (M-212).
- Tests T-64; docs D-39.

Findings: **Medium** M-210 to M-212. **Low** L-443 to L-451. **Tests** T-64. **Docs** D-39.

**Fixed** in `e533c90`: M-210 to M-212, L-443 to L-445, L-447, L-448, L-450, L-451, T-64, D-39, each with a test
that fails on the code before it. Left open as needing your decision: L-446 (Refresh after a Save as), L-449 (the
audiobook and chapters in languages the voice doesn't speak), and the parts of L-443 (pictures by address) and L-448
(a deleted voice's saved speech) noted in Resolved.

**Your decisions** (`e67e6f6`, each with a test that fails on the code before it): Refresh hidden once saved to this
computer (L-446); a chapter in a language the voice doesn't speak read in the book's language, else left out with a
note (L-449), and reading aloud doesn't prepare such a chapter ahead; a deleted voice's saved speech deleted with it
(L-448); pictures and fonts not forced past the cache (L-443); the top bar left as it is (M-212).

**Tests.** 549 tests at `8af8b21`, before the review: 543 pass, none fail. 557 at `e533c90`, after the fixes: 551 pass,
none fail. 560 at `e67e6f6`, after your decisions: 554 pass, none fail. Six need `SLOW=1` or `NETWORK=1` each time.

### Round 40

A full review at `e1ad43e` (after E-50, Reverb-TTS, with Reverb now off by default), by three reviewers each on a copy
of their own: one on reading aloud (every voice, Reverb against runntime 0.3.1's own code, saved speech, custom voices,
the voice scripts), one on opening books, security, layout, themes and the editor, and one on Settings, the
configuration, the scripts, the README and the tests. Each finding below was reproduced by a reviewer or checked
against the code; H-59, M-213 and M-214 were checked again here. No way found for a book, a config or an address to
run script, reach another site or leak data, and no resolved item back. What it found:
- *Hostile files that freeze or crash the tab.* A Markdown list item followed by many lines without a blank one takes
  time with the square of their number in marked (16,000 lines: 1.2 s to read; 200 KB: 50 s to open; a 1 MB file,
  minutes) (H-59). An SVG of about 1 KB whose `<use>` elements fan out tenfold at each of six or seven levels hangs the
  tab, even only as a book's cover, which the reader decodes for its tab icon (H-60). A 49 KB PNG of 20,000 by 20,000
  pixels as a cover or a page picture crashes the tab (M-216).
- *Reverb's licences.* Its audio codec (`higgs-audio-v2-tokenizer-Reverb`) is under the Boson Higgs Audio 2 Community
  License, based on Meta's Llama 3 licence, whose redistribution terms (a copy of both agreements, a Notice file with
  set wording, a "Built with Higgs Materials…" credit, an acceptable-use policy, an expanded licence from Boson past
  100,000 annual active users) a site that serves the codec from `reverb/models/` takes on; nothing says so (M-213). The engine's
  `LICENSES.txt` leaves out five bundled packages (js-tiktoken, base64-js, typed-binary, tinyest, tsover-runtime) and
  names a tokenizers version that isn't bundled (M-217).
- *Reverb's voices.* Because the reader passes `verbalize`, runntime rebuilds each voice without `speechFrames`, so a
  custom voice is paced by its whole clip, silences included, and speaks slower than its recording (M-214). A site
  voice's version is kept only in memory: a visit where its check fails finds neither its saved speech nor its made
  voice, and the recording must be fetched again (M-215). A site voice's words from its `.txt` aren't in its keys, and
  a recording replaced while the page is open isn't seen (L-452); a voice of your own's language isn't in the saved
  speech's key (L-453); runntime's errors show only their code (L-454); downloaded copies of other revisions or
  precisions are never removed, and a copy the browser didn't keep isn't noticed (L-455); a GPU lost while Reverb
  loads can still leave it "ready" (L-456); "Your voices" talks about Reverb on sites where it is off (L-457); a
  stray comment from the change to off by default (L-462).
- *Elsewhere.* Download progress in MB (Reverb, Pocket TTS, ZONOS3) is announced to screen readers at every MB, not
  every quarter: L-68 back for those (L-458). `fetch-reverb.sh` drops the last line of a checksum list without a final
  newline (yet writes `NOTICE.txt`), and resumes an old revision's partial file (L-459). Refresh on the default book
  shown after a `?book=` that failed asks for the failed address again (L-460). Markdown nested too deeply shows
  marked's "Please report this to …" in the notice (L-461).
- Tests T-65 to T-68; docs D-40 to D-45.

Findings: **High** H-59, H-60. **Medium** M-213 to M-217. **Low** L-452 to L-462. **Tests** T-65 to T-68. **Docs**
D-40 to D-45.

**Fixed** in `9d79c14`: H-59, H-60, M-213 to M-217, L-452 to L-462, T-65 to T-67 and D-40 to D-45, each with a test (the
licences by the script's test; L-453 and L-462 by reading). The round 40 tests run against the code before the fixes
didn't finish in 15 minutes (the hostile files hung it). The Reverb server repository's README states the codec's
licence too (`9129ccc` there). The full run after found one older test racing the "Added…" message, shown before the
list of your voices was drawn: the message now comes after it (the commit after `9d79c14`). T-68 (older tests that
lean on sleeps) is left open.

**Tests.** 589 tests at `9d79c14`: 582 pass, one fails (that race), six need `SLOW=1` or `NETWORK=1`. With the race
fixed, the ZONOS3, Reverb and round 40 files: 58 of 58 pass.

**Tests.** 574 tests at `e1ad43e`. The first run had 28 failures, all "Target crashed" or a closed browser in two
runs of `epubedit.test.js` and `layout.test.js` while a reviewer decoded 400-megapixel pictures alongside; those two
files run again alone: 59 of 59 pass. So 568 pass, none fail, and six need `SLOW=1` or `NETWORK=1`.

### Round 41

A review of the round 40 fixes (`9d79c14`, `9238746`) by two reviewers on copies of their own: one on opening books and
content safety, one on Reverb, the licences and the scripts. Several fixes didn't hold, or broke something:
- *Bypasses.* A page using a sprite file's big `<use>` group 2,000 times (22 million copies) still hung the tab, each
  file being capped on its own (H-61). A space after `data:` (`data: image/svg+xml,…`), which browsers ignore, skipped
  the cleaning of data: SVGs, in pages and styles (H-62). marked was still quadratic for a list inside a block quote, and
  after a line taken for a fence that marked doesn't take as one (```` ```x``` ````, a backtick in the info string, an
  indented one) (H-63). Huge pictures still crashed the tab as data: pictures in pages or inside SVGs, typed oddly
  (`image/x-png`) or not listed, or as a GIF whose frame is larger than its "screen" (M-218).
- *Regressions.* A data: SVG with a literal `%` (`width='100%'`) was dropped (M-219); every `<use>` on a page was dropped
  past 50,000 copies, so a MathJax chapter lost its formulas (M-220); a folder book's pictures were downloaded twice (L-463);
  an OS/2 BMP's 16-bit sizes were read as 32-bit (L-464); the list pre-pass could cut an HTML block or `$$` math after a
  list, or a fence in a quote (L-465); data: SVGs made new copies each time a page was drawn (L-466).
- *Reverb.* Every first download showed "downloaded again" (`rvKept` wasn't waited for, and read the flag already set)
  (M-221); two folders of a site deleted each other's copy, each visit downloading again (M-222); on a site with Reverb on,
  "Your voices" hid the words field of voices stored before (it was drawn before the config was read) (M-223); the codec's
  credit was only a tooltip, without "based on Meta Llama 3", and the README limited providing the agreements to serving
  the codec (M-224); saved speech made before M-214 was still played for preset voices (L-467); the audiobook didn't check a
  site voice's version, and could save new speech under an old version's key (L-468); runntime and js-tiktoken ship no
  licence file, so LICENSES.txt lacked their MIT texts (L-469).
- Docs D-46 (re-run `fetch-reverb.sh`; a sentence saying "these voices" twice); tests T-69 (the bypasses' shapes).

**Fixed** in the commit after `9238746`, each with a test but L-465's HTML-block case and L-468 (by reading):
- H-63: the pre-pass looks inside block quotes (and cuts with a `>` line), recognises fences as CommonMark does, and
  even inside a fence puts a blank line in after 2,000 lines; a list ends at a heading, an HTML block or `$$` (L-465).
  (A cut inside an indented item can still make its list loose, a cost only past 1,000 lines without a blank one.)
- H-61, M-220: SVG files record the copies each element with an id makes, and a page's `<use>` of a sprite counts its
  target's size, checked once the page's addresses are known; the limit is twice the page's own elements plus 50,000.
- H-62, M-219, L-466, M-218: data: addresses are read as browsers read them (whitespace before the type; percent-decoding
  that keeps a stray `%`); data: SVGs are kept per book; data: raster pictures (in pages, styles and SVGs) have their size
  checked; every file but fonts, sound, video, styles, captions and SVG has its header read whatever its type; GIF frames
  are counted; a site's file is read by its first 512 KB (L-463); OS/2 BMPs (L-464).
- M-221, M-222: the "loaded before" flag is read before it is set, and kept per copy (folder or Hugging Face); `rvKept`
  removes only other revisions' folders.
- M-223: "Your voices" drawn again once the config is read.
- M-224: the credit in the licence's words (with "based on Meta Llama 3") shown in Settings wherever Reverb is on, with
  Reverb's own and links to both agreements, CC BY-NC and the acceptable-use policy; the download offer says where; the
  README says so and that the agreements must be provided.
- L-467: Reverb's saved-speech key carries `s2`. L-468: the audiobook waits for the site voice's version, and a voice
  carries the version it was taken with. L-469: their upstream MIT licences kept in `tools/reverb-engine/licenses/`
  (pinned commits) and put in LICENSES.txt by the build. D-46 done.

**Tests.** 595 tests at `b8a76e2`: 584 pass, five fail, six need `SLOW=1` or `NETWORK=1`. The five were the CSS cleaner's
own tests, which take its functions out of index.html and lacked the new data: helpers (the commit after `b8a76e2` gives
them); run again: 8 of 8 pass.

### Round 42

A review of `b8a76e2` (round 41's fixes) by one reviewer on a copy of their own. The Reverb fixes, the sprite-by-fragment
limit, the picture checks for the forms tested and the folder books held; but the content defences can still be got
round, each way reproduced:
- `<use href="#%6c5">`: the browser decodes the fragment, the count doesn't, so a 1 KB fan-out hangs the tab again
  (H-64). A `<use>` of a whole file or data: SVG (no fragment) counts as one copy, though it draws the whole document:
  2,000 such uses hang the tab (H-65).
- Any heading, HTML-looking or `$$` line inside a list item stops the pre-pass counting while marked keeps the item going
  (`- a`, `<b>x</b>`, then 60,000 lines: 19 s to open; the editor runs it on every change too) (H-66). One long line of
  emphasis (`*a` 200,000 times, 400 KB) takes time with the square of its length in marked: 34 s, untouched by the
  pre-pass (H-67).
- data: pictures typed other than `image/…` (`application/octet-stream`, none, `text/plain`), or with `;base64` not last
  in their type, are drawn by the browser but not checked (M-225); one over 8 MB of text is let through unchecked (M-226);
  percent-encoded data: is decoded slowly (8 MB: 12 s) and again for each element and each pass (M-227). A huge picture
  typed `audio/mpeg`, `font/…`, `text/css` or `image/svgz`, or named `.mp3`, `.woff`, `.css`, skips `pictureFits` but is
  drawn (M-228).
- `svgUseCap` now walks every page whole, with no `<use>`, at least twice (200,000 elements: about 0.3 s a time) (L-470);
  a list followed by a block quote, or a table in a long item, is cut into a paragraph of pipes (L-471); a real code block
  over 2,000 lines gets an empty line (L-472); Reverb's credits can't be reached where Settings is hidden
  (`SHOW_SETTINGS_BUTTON: false`) (L-473); a page nested deeper than the count can follow loses its harmless `<use>`
  elements (L-474).

Findings: **High** H-64 to H-67. **Medium** M-225 to M-228. **Low** L-470 to L-474.

**Your decision:** all three, as proposed below. **Done** in the commit after `61c4785`, each with a test:
- *Markdown:* the pre-pass (`mdUnstick`) is gone. A document over 20,000 characters is first read by marked in a worker
  built from the same file the page loaded (its hash checked), for at most 5 s; past it the worker is stopped and the
  document shown as plain text, with a note. The editor's line matching reads long Markdown only once that check passed.
  The plain-text view also breaks words of 1,000 characters or more every 200: a 400 KB word took the browser 15 s to lay
  out, as a .txt too (0.5 s now). (marked's extensions, math and footnotes, aren't in the worker: their tokenizers are
  bounded already.)
- *SVG `<use>`:* references resolved as the browser does (a fragment decoded; none, the whole file; one that can't be
  resolved, nothing: round 43 corrected an earlier "the whole page", which dropped working uses), counted with a stack of its own, only on pages with `<use>`, sizes worked out only for SVG
  files.
- *Pictures:* every file but SVG has its header read whatever its type or name; every data: picture but SVG has its size
  checked whatever its type, from its first 512 KB, decoded quickly and once per address.

**Tests.** 597 tests at `1ed87f3`: 591 pass, none fail, six need `SLOW=1` or `NETWORK=1`.

**What this shows.** Three rounds of fixes to the Markdown pre-pass and the `<use>` count have each been got round by the
next review: both guess at what marked and the browser will do. Proposed instead, for your decision:
- *Markdown:* parse in a Web Worker with a time limit (say 5 s; the reader already builds workers from blobs), and past it
  show the document as plain text with a note. That bounds every slow construct in marked, the ones found and those not
  yet found, and the pre-pass can go.
- *SVG `<use>`:* resolve references as the browser does (fragments decoded; a reference without a fragment, or one that
  can't be resolved, counted as its whole document), count with an explicit stack, and only on pages that have `<use>`.
- *Pictures:* read the header of every resource whatever its type or name (blobs cost nothing; a site's files one
  ranged request), and every data: picture whatever its type, decoding only its first bytes, once per address.

### Round 43

A review of `1ed87f3` (round 42's redesign) by two reviewers on copies of their own: one trying to break the new
defences, one looking for what they broke. What it found:
- *Regressions.* WYSIWYG editing of long Markdown that fell back to plain text wrote the plain view back over the file,
  markup escaped and the note included (H-68, data loss). The editor started a check, a worker, on every scroll (1,285 in a
  minute of typing) (H-74). A `<use>` that resolves to nothing counted as the whole page, so 40 broken references removed
  400 working ones (M-229). Every font, sound and video a folder book serves was read before its page showed (15 s against
  4 on a slow line) (M-230). The `<wbr>` in long plain-text words could split a character outside the BMP (M-231). The
  data: check's cache held whole addresses across books (L-476).
- *Ways round.* A JPEG with stray bytes before its size marker, or the marker past 512 KB, wasn't sized and crashed the
  tab (H-69). A worker error (nesting past the worker's shallower stack) counted as a pass, so a document could switch the
  check off (H-72); so did a policy without blob: workers (M-232). Long unbreakable words froze HTML, EPUB and Markdown
  pages (100 KB: 11 s; 400 KB: 45 s); only plain text was covered (H-73). A `<use>` by `about:srcdoc#…`, the page itself,
  went uncounted where remote content is on (M-234).
- *Not fixed here* (below, open): nested `<marker>` and `<mask>` references multiply drawing as `<use>` did (1.8 KB: out of
  memory) (H-70); a footnote's body is lexed only with marked's extensions, on the page, so a slow list inside a footnote
  passes the check (H-71); after a passing check the page lexes the document again, up to about twice the check's time
  (M-233); the 5 s budget is fixed, so a legitimate large document can show as plain text on a slow device, differently
  from one visit to the next, and reading aloud speaks the note and the raw markup (L-475).
- Docs: nginx.conf.example's list of CDN hosts lacked cdnjs (D-47).

**Fixed** in the commit after `cc954ee`, each with a test but M-230 (by reading):
- H-68: long Markdown that doesn't pass the check is edited in Raw only (WYSIWYG not offered), and the plain view is never
  serialized back.
- H-74: one check per text, kept for the last four texts; the editor's line matching starts none (it waits for the
  page's own).
- H-72, M-232: a worker error is a failure; a worker that can't start or a marked that can't be fetched leaves documents
  over 200,000 characters as plain text, smaller ones read as before; the clock starts once the worker is ready.
- H-69: stray bytes skipped as the decoder skips them; a JPEG or AVIF whose size isn't found in its first 512 KB is left
  out.
- M-231: the plain-text view's breaks keep each character whole with its combining marks. (H-73, long words in HTML and
  EPUB pages, is left open: breaks there helped one kind of word and made another, which the reader showed in 1.4 s,
  take 7 to 40 s — the browser's layout of a long paragraph with break elements, not the reader's code; zero-width
  spaces instead changed nothing for the slow kind. See H-73.)
- M-229, M-234: a reference that resolves to nothing counts as one; `about:srcdoc#…` as this page; a `<use>` or
  `<feImage>` by any scheme but http(s), blob: and data: is removed.
- M-230: a folder book's sound, video, font and captions files served by their address aren't read first (a book's files
  in an archive are, at no cost).
- L-476: the cache per book, keyed by length and hash. D-47 done.

**Tests.** 602 tests at `4d65a91`: 596 pass, none fail, six need `SLOW=1` or `NETWORK=1`.

### Round 44

Your request: fix H-70, H-71 and M-233. **Fixed** in the commit after `962cf9c`, each with a test:
- H-71, M-233: the worker reads long Markdown with the reader's own tokenizers for math, emoji and footnotes (one
  function, `mdTokenizers`, used by the page and, as source, by the worker), so a footnote's body is read there as on the
  page; and the page parses the worker's tokens (`mdParseTokens`: the notes found from them, then marked's hooks around
  the parse), never reading the document again. The editor's line matching uses the worker's block lines. A paragraph,
  heading or line of more than 20,000 inline pieces is shown as plain text too: the reader's tokenizers split long text,
  so 100,000 emphasised letters in one paragraph were read in time, and then took the browser 50 s to lay out.
- H-70: a marker, mask, clip path or filter reference (an attribute, or in a style attribute) is dropped when what it
  points to holds such references of its own or a `<use>`, so they never nest; in SVG files and in pages. Marker
  properties in style sheets are dropped as sheets are cleaned (they could reach the shapes inside markers). Masks, clip
  paths and filters set by a style sheet's selectors are not counted: they would need the selectors matched.

**Tests.** 605 tests at `ad11b83`: 599 pass, none fail, six need `SLOW=1` or `NETWORK=1`.

### Round 45

A review of round 44's fixes (two reviewers). It found regressions in them and ways round H-70, all **fixed** in the
commit after `86673b9`, each with a test:
- H-75 (High): long Markdown with a note defined inside a list item, a quote or another note stopped opening, or lost the
  note: the page looked for notes only among top-level blocks of the worker's tokens. They are found now in the order
  the page's own reading finds them (inside lists, quotes and tables, a note's own notes before it), and a reference to a
  missing note no longer stops the document.
- H-76 (High, regression): marker properties were dropped from every style sheet, so CSS arrowheads disappeared. That
  sheet rule is gone; sheets are counted with the rest (H-77).
- H-77 (High): ways round H-70's check: `-webkit-mask` and `mask-image` in a style attribute, CSS escapes in the fragment
  (`url(#\6b 1)`), an animation that sets a mask, custom properties (`--m: url(#k0); mask: var(--m)`), and masks set by
  style-sheet classes. The check now counts depth over every way of pointing, read as the browser reads it: any
  attribute or declaration with `url(#…)` (escapes decoded, shorthands expanded, custom properties), `<use>` and
  `<feImage>`, style-sheet rules matched to the elements they reach (a selector depending on the reader, `:hover`
  say, matched without it; keyframes and nested rules reach everything), and what is inherited (markers, custom
  properties). Animations that would set a reference, class or style are removed. Masks, clip paths and filters may
  be two deep; a marker counts two. What points deeper is dropped.
- M-235: round 44's check dropped legitimate masks and clips (Sketch's mask holding a `<use>`, a clip path of a clipped
  shape, Illustrator's mask holding a filter). One level of nesting is kept now (H-77).
- M-236: emoji were missing when the worker read a document before the emoji names had loaded, and the editor then wrote
  `\:tada:`. The worker waits for the names, and a reading made without them is redone once they are there.
- M-237: the last three documents' token trees were kept (137 MB for 7 MB of Markdown). Tokens are let go once drawn
  (the editor's block lines kept); a second drawing reads again.
- M-238: footnote numbers were looked up in a list: 30,000 notes took 13 s. A map now (about 4 s to open).
- L-477: the 20,000-piece limit missed table cells, and one such block turned the whole document into plain text. Cells
  are counted; only the block (or cell) past the limit is shown as its text, long words given breaks, and text and
  inline HTML count for little.

**Tests.** 612 tests at `e469b5d`: 605 pass, six need `SLOW=1` or `NETWORK=1`, and one failed: H-59's test still expected `long-emphasis.md` to be shown whole as plain text with the note; it now expects only its long block as text (`6cb48c0`, passing).

### Round 46

A review of round 45's fixes at `975474f` (two reviewers, each finding reproduced in Chromium; two spot-checked again
here). **Open**, in the table below:
- SVG nesting (H-77's check): five more ways round it, each freezing the tab end to end (7.6 to 33 s): a `var()`
  with a fallback in a shorthand (`mask: var(--n, url(#k))`, which the CSSOM reports as empty longhands: H-78);
  `@scope` rules (`:scope` matched against the document: H-79); selectors that only match after the check, on attributes
  the reader adds later (`data-spine-path` by `markLinks`) or with `:has()` (H-80); `@import` in a body `<style>` or an SVG
  file's `<style>`, pasted in after the check (H-81); and an id that `sanitize` removes after the check (a named `<img
  id="open">`), so references then reach a later mask of the same id (H-82). And by design depth doesn't bound the cost:
  one allowed marker level on a 20,000-vertex line (135 KB) took 24.7 s; two-deep masks with 3,000 rects a level, 4.4 s
  (H-83). A regression (H-84): a reference that can reach its own target (a sheet rule `path{marker-end:url(#a)}` with a
  path inside the marker, keyframes, nested rules, `svg{--g:url(#gr)}`, `<g marker-end>` round its marker) counts as a
  loop, and then every effect on the page is dropped, Illustrator gradients and plain arrowheads among them. The check
  itself grows with rules × matched elements (a 200 KB page took 16.5 s: M-239). Pattern `href` inheritance isn't
  counted (L-478); a nested `@property` can't be removed though counted as dropped (L-479).
- Markdown: a line break counts a quarter piece, yet it is the costliest to lay out: 40,000 `<br>` in one paragraph,
  shown quickly as plain text before, now hangs the tab for minutes (H-85; 10,000 already got past before). A block
  shown as plain text is written back escaped after any WYSIWYG edit (every `*x*` becomes `\*x\*`): round 43's Raw-only
  guard no longer applies, as the document isn't marked slow (M-240, regression). Each Raw/WYSIWYG switch reads the
  document again in the worker, as its tokens were let go, each a new chance of the time limit (L-480).
- Tests: none of the above is covered; the effect tests time until text appears, not until painted (T-70). Round 45's
  note that "every way of pointing is read" overstated it (D-48).

**Fixed** (your go-ahead) in `1318844` and `9a3319c`, each with a test: the SVG check estimates drawings instead of depth
and reads every channel above; the Markdown worker caps line breaks per block and flags blocks shown as text, which make
the document Raw-only; the document drawn last keeps its tokens. Found while fixing: a backslash in the worker's source
(a template string) lost again (`\b` read as a backspace), which left the break cap doing nothing; caught by the test.

**Tests.** 616 tests at `bb3530e`: 610 pass, none fail, six need `SLOW=1` or `NETWORK=1`.

The direction taken (the reviewer's): stop trusting selector matching, counting
any reference made in a style sheet as reaching every element, without counting a reference to its own target or an
ancestor as a loop (the browser ignores those); read declarations from their serialized text too; run the check on the
final page (after imports, link marking and id clean-up); and estimate the number of drawings (uses times the target's
cost, a marker's uses its vertices) rather than depth.

### Round 47

A review of round 46's fixes at `7eebf4c` (two reviewers, each finding reproduced in Chromium). **Open**, in the table
below:
- SVG drawing estimate: `<use>` instances aren't multiplied, so a marker or mask inside a used group or symbol is charged
  once: 100 uses of a group with a 1,000-vertex line and a 400-circle marker crashed the tab (H-86). The vertex count reads
  numbers, but a path's `z` is a vertex with none (20,000 `z`, 8 s to paint; 100 KB would be about 40 s), and `h`/`v`
  have one each (H-87). A reference to an element holding the target is skipped as a loop, yet Chrome draws a mask nested
  inside another mask's element: 44 s (H-88). The budget is per SVG file: one picture under it shown 40 times at different
  sizes took 29 s (H-89). Filters cost by area, not count: 8,000 large blurred rects, 48 s (H-90). The check itself is
  quadratic in targets × page-wide references (8,000 each: 5.8 s; 20,000: 26 s), and `@property` drops are quadratic (M-241);
  its 20,000-step limit is global, so a page of 21,000 clip paths (PDF imports) loses 1,000 (M-242); and it builds an array
  the size of the page for every selector, even for gradients (4,000 classes: 3 s, 1.3 GB: M-243). `inherit` on any
  property containing "clip" or "mask" (`clip-rule`) multiplies every reference by the whole page, HTML too (L-481); and
  `CSSPropertyRule` isn't guarded, so on Firefox ESR 115 or Safari before 16.4 such a page fails to open (L-482).
- Markdown: `</br>` (which browsers read as `<br>`) isn't counted as a break: 40,000 froze the tab for over 90 s (H-91);
  nor are breaks inside an HTML block, never counted at all (H-92). Documents under 20,000 characters skip every check:
  9,900 backslash line breaks in 19.8 KB froze for 9 s (M-244). The last drawn document's tokens are kept after its book is
  closed (about 43 MB for 1.2 MB of Markdown: L-483). Raw-only, once set, isn't lifted when the block is fixed in Raw
  until the editor is reopened (L-484).
- Also seen, not yet looked into: 20,000 small rules `.cN{--vN:url(#c0)}` on a page without SVG effects didn't open in
  100 s (8,000 opened in 0.9 s): something superlinear elsewhere in the CSS pipeline (M-245).
- Tests: none of the above is covered (T-71).

**Fixed** (your go-ahead) in `b8a300f` and `d397e27`, each with a test, as suggested below. M-245 proved not to be a
freeze: the document was split with the style sheet's 363 KB counted as text, so its first part held only the sheet and
opened blank. Found while fixing: the editor's own rebuilds let go of what was read, so each switch read again (caught by
round 46's test); and checking the new estimate on a chain of 2,000 nested `<use>` took 1.2 s until it was worked out in
passes over the page.

**Tests.** 621 tests at `d397e27`: 615 pass, none fail, six need `SLOW=1` or `NETWORK=1`.

The direction taken: count `<use>` instances by their target's effect drawings, and give a `<use>` its target's vertices
and elements for inherited references; count path vertices by commands; skip a reference to an element holding the target
only when no mask, clip path, marker, pattern or filter lies between them; charge pages for each use of a picture
(keeping each file's drawings with its size); weight filter applications heavily; collapse page-wide references to
distinct targets, reset the step count per charge, and skip non-drawing targets before working out a selector's reach.
For Markdown: count `<\/?br`, count breaks in HTML blocks, and send short documents with many breaks to the worker too.

### Round 48

A review of round 47's fixes at `f877961` (two reviewers, each finding reproduced in Chromium). **Open**, in the table
below:
- SVG drawing estimate: pictures are charged per time their address is written, not per time they are drawn: one sheet
  rule giving 40 elements a heavy background took 18 s; `::before` content 31 s; a `<symbol>` of the picture used 40 times
  12 s; a pattern of it filling 100 rects 70 s (H-93). Effects inside the book's SVG files (`filter:url(filt.svg#f)`,
  markers, masks) are never charged: 300 divs with a file's 50-blur filter didn't paint in 120 s (H-94). Since HTML elements
  count nothing (L-481), page-wide references (custom properties, `@scope`) cost nothing on HTML: a blur on 1,500 divs, 30 to
  42 s (H-95). A value naming one target many times (`filter:url(#f) url(#f)…`) is charged once (H-96). `feMorphology` costs
  by radius: 400 rects, 39 s, under budget (H-97). And CSS alone, no SVG: repeated `filter: blur()` functions and
  `backdrop-filter` on large stacked divs, 14 s to over 120 s (H-98). The check is slow with many selectors on a deep tree
  (41 KB, 16 s: M-246). The flat filter cost drops ordinary shadows: Inkscape's drop shadow on 200 small circles, all
  dropped through a class (M-247). A harmless `<use>` loop elsewhere drops plain sheet arrowheads (L-485); a picture named
  twice in a sheet loses both when one would fit (L-486).
- Markdown: the HTML-block check (H-92) counts the whole block, so an HTML table of 3,000 rows, a `<div>` of 600 paragraphs
  with breaks, an inline SVG or a large HTML comment is shown as raw markup text, and the document made Raw-only: a
  regression (H-99). Older, seen again: a long paragraph shown as text (one long word broken every 200 characters) freezes
  in the browser's paint, over 90 s (M-248); 60,000 `<wbr>` in a paragraph, 96 s (M-249). The short-document check counts
  trailing spaces and `<br` in code too, sending code-heavy documents to the worker needlessly (L-487).
- Tests: none for the above; none that legitimate HTML blocks still render (T-72).

## Summary

Round 34 was a full review at `a955cc8`, after E-46 to E-48. Its High and Medium items are fixed (`e50e041`, `62de5b1`; see Resolved), and rounds 35 and 36 reviewed the fixes. L-431 to L-442 are fixed too (round 37), and the tests and docs items (round 38). E-49 (Refresh) is built. Round 39, a full review after it: its findings are fixed, the last ones by your decisions. E-50 (Reverb-TTS) is built, off by default. Round 40, a full review after it, found two High items (hostile Markdown and SVG that freeze the tab), five Medium (a crashing picture, Reverb's codec and engine licences, custom voices' pace, site voices' versions), eleven Low, four tests and six docs items: all fixed but T-68. Round 41, a review of those fixes, found three High items (bypasses of H-59 and H-60), seven Medium (M-218 to M-224) and seven Low (L-463 to L-469): fixed. Round 42, a review of those, found more ways round the same defences (H-64 to H-67, M-225 to M-228, L-470 to L-474): fixed by a sturdier approach, your decision (see Round 42). Round 43, a review of that, found regressions and ways round (fixed) and five items left open; round 44 fixed H-70, H-71 and M-233, leaving H-73 and L-475; round 45, a review of those fixes, found H-75 to H-77, M-235 to M-238 and L-477: fixed. Round 46, a review of those, found H-78 to H-85, M-239, M-240, L-478 to L-480, T-70 and D-48: fixed. Round 47, a review of those, found H-86 to H-92, M-241 to M-245, L-481 to L-484 and T-71: fixed. Round 48, a review of those, found H-93 to H-99, M-246 to M-249, L-485 to L-487 and T-72: open. Open (below): those, round 48's, T-68, T-69,
and the enhancements E-29, E-30, E-36, E-42 to E-45 and E-1 to E-4, E-6 to E-8, E-22 and E-25 (planned in TODO.md). L-110, T-43 and T-47 are left as they are, by your
decision (see Resolved).

## Open items

Most important first.

| ID | Title | Kind |
|---|---|---|
| H-99 | The Markdown HTML-block check shows ordinary HTML (a big table, a `<div>` of paragraphs, inline SVG, a comment) as raw text: regression (round 48). | High |
| H-93 | Pictures with effects charged per address written, not per drawing: sheet backgrounds, `::before`, symbols, patterns (12 to 70 s): round 48. | High |
| H-94 | Effects inside the book's SVG files (`filter:url(file.svg#f)`) never charged: over 120 s (round 48). | High |
| H-95 | Page-wide SVG effect references cost nothing on HTML elements (custom properties, `@scope`): 30 to 42 s (round 48). | High |
| H-96 | A value naming one SVG target many times is charged once (round 48). | High |
| H-97 | `feMorphology` costs by radius: 400 rects, 39 s, under budget (round 48). | High |
| H-98 | CSS filter functions and `backdrop-filter`, no SVG, on large stacked elements: 14 s to over 120 s (round 48). | High |
| M-248 | A long Markdown paragraph shown as text freezes the browser's paint (over 90 s): older (round 48). | Medium |
| M-249 | 60,000 `<wbr>` in a Markdown paragraph: 96 s (round 48). | Medium |
| M-246 | The SVG check is slow with many selectors on a deep tree (41 KB, 16 s): round 48. | Medium |
| M-247 | The flat filter cost drops ordinary small shadows (Inkscape drop shadows on 200 circles): round 48. | Medium |
| L-485 | A harmless `<use>` loop drops plain sheet arrowheads elsewhere on the page (round 48). | Low |
| L-486 | A picture named twice in a sheet loses both when one would fit (round 48). | Low |
| L-487 | The short-Markdown check counts trailing spaces and `<br` in code, sending such documents to the worker (round 48). | Low |
| T-72 | No tests for round 48's items, nor that legitimate HTML blocks still render (round 48). | Tests |
| T-69 | Round 41's bypasses have tests now (a list in a quote, after a fence-like line; a sprite group used many times; data: with a space and with %; data: and oddly typed huge pictures; GIF frames; many cheap uses); still none for a folder book's huge picture served by its address, or for L-465's HTML block after a list. | Tests |
| H-73 | Long unbreakable words freeze HTML, EPUB and Markdown pages in the browser's layout (`*a` × 50,000, 100 KB: 11 s; 400 KB: 45 s); plain text, and Markdown shown as plain text, are covered (round 43). Tried: a `<wbr>` every 200 characters (the word 7.7 s, but a 900 KB page of `` $`x `` that took 1.4 s then took over 40 s), fewer breaks (both about 5 to 7 s), zero-width spaces (no help for the slow word). The cost is Chromium's, with the reader's columns and wrapping: open, for a better idea. | High |
| L-475 | The check's 5 s budget is fixed: a legitimate large document can show as plain text on a slow device, and differently from visit to visit (positions and contents then differ); reading aloud and the audiobook speak the note and the raw markup (round 43). Fix: a budget scaled by a calibration sample; a "show as Markdown anyway" action; the note kept out of what is spoken. | Low |
| T-68 | Tests that can pass without testing: ZONOS3's "deleted while it is being made" (L-448) relies on a 400 ms sleep; M-210's Refresh test reads its place after 300 ms and never checks it moved from the start; L-447's (300/800 ms) and L-450's (500 ms) sleeps. | Tests |
| [E-50](#e-50-reverb-tts-a-voice-in-the-browser-and-on-the-server) | Reverb-TTS: a voice in the browser (runntime, WebGPU; int4, fp16 with full precision) and on the server; custom voices with their words; weights non-commercial (off by default, a site can turn it on) | Enhancement |
| [E-42](#e-42-skippable-parts-in-publisher-narration) | Publisher narration: skip footnotes, page numbers and the like (Media Overlays skippability) | Enhancement |
| [E-43](#e-43-publisher-narration-as-an-audiobook) | Audiobook export from the publisher's own narration, not only a natural voice | Enhancement |
| [E-44](#e-44-narration-across-files-and-without-text) | Publisher narration: clips whose text is in another file, and audio-only clips, shown | Enhancement |
| [E-45](#e-45-narration-on-fixed-layout-spreads) | Publisher narration highlighted on both pages of a fixed-layout spread | Enhancement |
| E-36 | Read math and emoji aloud (the TeX or "formula"; an emoji's name). | Enhancement |
| E-30 | The raw editor shows right-to-left documents left to right (CodeMirror isn't given the direction). | Enhancement |
| [E-29](#e-29-vertical-text) | Vertical text (Japanese, Chinese) laid out vertically, pages turning right to left | Enhancement |
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

### E-29. Vertical text
Books written in vertical text (`writing-mode: vertical-rl`, as many Japanese and Chinese novels are) laid out
vertically, with pages turning right to left and the scroll layout scrolling sideways. Until then they are laid out
across, so they can be read (H-33).

### E-25. Add, remove and reorder EPUB chapters
Change an EPUB's chapters, keeping its package file and contents in step. The plan is in TODO.md.

### E-42. Skippable parts in publisher narration
Media Overlays' skippability: footnotes, endnotes, page numbers, sidebars and the like (by `epub:type` on the SMIL's
`<par>`/`<seq>` or the text they point to) skipped while reading, with a setting for which kinds, as the EPUB 3 Media
Overlays specification suggests reading systems offer. Escapability (leaving a table or list being read) could follow.

### E-43. Publisher narration as an audiobook
The audiobook export (E-10) made from the book's own recording when it has Media Overlays: the clips cut and joined
per chapter (or one file), with the chapters' marks and the book's cover and metadata, in the formats export offers,
instead of only a natural voice. Chapters without narration read by the natural voice chosen, or left out.

### E-44. Narration across files and without text
A `<par>` whose text is in a file other than the chapter's own followed (the narration moving on to that chapter), and
audio-only clips (no text) shown as such in the read-aloud bar, rather than ignored or played with nothing marked.

### E-45. Narration on fixed-layout spreads
On a two-page fixed-layout spread, the passage being narrated highlighted (and given the book's active class) on
whichever page holds it, the facing page too, and the spread turned when the narration moves past it.

### E-50. Reverb-TTS: a voice in the browser and on the server
[Reverb-TTS](https://github.com/software-mansion-labs/Reverb-TTS) (Software Mansion, November 2026): a 297M-parameter
voice-cloning model, 7 languages (English, German, French, Spanish, Italian, Polish, Portuguese), 16 built-in voices,
the lowest word error rate on the Open TTS Leaderboard by its own figures, and fast (masked diffusion: a passage is made
whole, about 165x real time on an RTX 5090, 20x on an Apple M4 Pro). Code Apache 2.0; **weights CC BY-NC 4.0**
(non-commercial, with attribution), unlike Kokoro and ZONOS3 (Apache 2.0).

- **In the browser** ("Reverb" beside Kokoro, Pocket TTS and ZONOS3): through Software Mansion's `runntime` (MIT,
  WebGPU), whose `createTextToSpeech` runs Reverb, its audio codec and tokenizer. Built from its npm releases into
  `reverb/engine/` by a reproducible `tools/build-reverb-engine.sh` (runntime, TypeGPU, the tokenizer and Verbalis,
  versions and checksums pinned), as `zonos/engine/` is. Models from the Hugging Face Hub at pinned revisions, or from
  the site by a `fetch-reverb.sh` into `reverb/models/`. Downloads: with `FULL_PRECISION` (on by default), fp16 weights and
  math (about 753 MB with the codec) where the GPU has `shader-f16`, else int8 (about 478 MB); with it off, int4 (about 368 MB). Text
  spelled out first by Verbalis (numbers, dates, money, units) in all 7 languages. Offered for books in its languages;
  its built-in voices, the book's language first; saved speech keyed by model, voice and language. Off by
  default, for its non-commercial licence (your decision, reversing the first one); a site turns it on with
  `REVERB: true` in reader-config.json, and the README states the weights' licence.
- **Custom voices** (E-48's three ways), each needing what was said: a recording made in Settings reads a passage
  shown, so its words are known; an upload or a site recording takes its words beside it (Settings: a box for them;
  `REVERB_VOICES` entries with a `text`, or a `.txt` of the same name next to the recording). The voice (codec codes,
  under 100 KB) is made once on the GPU (`createVoiceMaker().fromRecording`) and kept in the browser.
- **On the server**: a service speaking the reader's server API (as epub-reader-tts-server-zonos3's adapter does),
  `reverb-tts` in fp16 on the GPU (594 MB; it computes in bfloat16 whatever the file), `/health` listing its 7
  languages and `"instructions": false`, voices from the voices folder's clips and their `ref_text`, the studio, in a
  repo of its own (your decision), apart from the Apache-licensed setups.
  **Built** in [jskenney/epub-reader-tts-server-reverb](https://github.com/jskenney/epub-reader-tts-server-reverb)
  (`ec79fa4`, `2fed7d5`): the API in the same process as the model, the studio, speech-to-text, `make-voice.sh`, the
  proxy examples and the Mac scripts; 21 tests with a stand-in; checked with the real model on the CPU (preset voices,
  a clip in another language, previews, `make-voice.sh`). Not yet built as a Docker image here (no GPU or Docker).
  **Browser engine built** (`e929ea5`, `617ebd3`): `reverb/engine/reverb.js`, reproducible from the pinned npm releases;
  checked in headless Chromium (WebGPU on SwiftShader) with the int4 model served from the site: it loaded (about 90 s
  there) and spoke a preset voice, the text spelled out by Verbalis.
  **In the reader** (`a5ecbb1`, and the commit after it, below): "Reverb" in the read-aloud bar, for books in its 7
  languages with WebGPU (the option says why not otherwise; off, and hidden, unless a site sets `REVERB: true`); its 16 preset
  voices listed at once, the book's language first; agreement to the download with its size, which follows
  `FULL_PRECISION` (on, the reader's default: fp16 where the GPU has `shader-f16`, int8 otherwise; off: int4); the files
  from `reverb/models/` when `fetch-reverb.sh` finished with those weights (default: fp16 and int8; `--int4`, `--all`),
  else from Hugging Face, or a reason with `ALLOW_CDN` off; kept by runntime in the origin's private file system, with
  ZONOS3's storage-quota warning and persistence request; the text's language and the voice's codes and transcript in
  each request, text spelled out by Verbalis; saved speech keyed by revision, weights, language and voice; a lost GPU
  stops it with the reason (a reload restarts it); `SPAN_MAX.reverb` 400; Generate config gives `REVERB` and
  `readAloud: "reverb"`; README sections (the voice, self-hosting, settings, upgrading, licence). 10 tests with a
  stand-in engine (`tests/reverb.test.js`) (`f5eaf39`).
  **Custom voices built** (the commit after `f5eaf39`): your own (Settings' "Your voices", now shared by ZONOS3 and
  Reverb: each with its words and language; a recording made there takes the passage read) and the site's,
  `REVERB_VOICES` in reader-config.json (`{"name", "url", "text", "language"}`, the words from a `.txt` beside the
  recording when `text` is left out; not a Settings field, so that a list with words needn't fit one line). Made once on
  the GPU by `createVoiceMaker().fromRecording` with the codec already loaded, the words spelled out in the recording's
  own language (runntime spells the voice's words in the book's), kept in the browser beside ZONOS3's embeddings, keyed
  by the words, the language and a site recording's version; deleting or changing a voice of your own deletes what was
  made from it, and the speech saved in it. A recording too short or too long for the voice maker, or without words,
  stops reading with the reason. Tests with the stand-in's voice maker.

Limits: no Chinese, Japanese or the like (ZONOS3 stays for those); not streamed, but quick; very new (the repo dates
from 19 November 2026, `runntime` 0.3.1), so pinned and checked as ZONOS3's engine is. Tests with a stand-in engine, as
for ZONOS3, and a check of the real one through WebGPU on SwiftShader.

## Suggested order

1. E-25, E-22, as laid out in TODO.md.
2. E-36 and E-30 (small), then the other enhancements, as wanted.

## Resolved

From all reviews so far, with the commits that fixed them. An item left as it is says so in place of a commit.

| ID | Title | Fixed in |
|---|---|---|
| H-86 | `<use>` instances aren't multiplied in the SVG estimate: 100 uses of a group with a heavy marker crashed the tab (round 47). A `<use>` holds its target's elements and vertices, and each is charged the effects inside what it shows. | `d397e27` |
| H-87 | SVG path vertices counted by numbers: `z` (none) and `h`/`v` (one) undercount; 20,000 `z` painted in 8 s (round 47). Vertices counted by path commands (each `z` one, `h`/`v` one number). | `d397e27` |
| H-88 | A reference to an element holding the target is skipped as a loop, though Chrome draws masks nested in masks: 44 s (round 47). A reference across a nested mask, clip path, marker, pattern or filter counts. | `d397e27` |
| H-89 | The SVG drawing budget is per file: one picture shown 40 times at different sizes took 29 s (round 47). Each SVG file's drawings kept; a page is charged for each time it shows one, past the budget left out. | `d397e27` |
| H-90 | SVG filters cost by area, not count: 8,000 large blurred rects, 48 s (round 47). Each filter application costs 1,000 drawings a primitive. | `d397e27` |
| H-91 | `</br>` isn't counted as a Markdown break: 40,000 froze the tab over 90 s (round 47). `</br>` counted as a break. | `d397e27` |
| H-92 | Breaks inside a Markdown HTML block are never counted: over 90 s (round 47). An HTML block's breaks and tags counted; past the limits, shown as its text. | `d397e27` |
| M-244 | Markdown under 20,000 characters skips every check: 9,900 backslash breaks froze 9 s (round 47). A short document with more breaks than a block may have is read by the worker too. | `d397e27` |
| M-241 | The SVG check is quadratic in targets × page-wide references (20,000: 26 s), and in `@property` drops (round 47). Page-wide references kept once per target and kind (at most 1,000 targets); `@property` rules removed in one pass. | `d397e27` |
| M-242 | The SVG check's global step limit drops legitimate clip paths on pages of over 20,000 (round 47). The step limit is each reference's own. | `d397e27` |
| M-243 | The SVG check builds a page-sized array per selector, gradients too (4,000 classes: 3 s, 1.3 GB): round 47. Non-drawing targets skipped before a selector is matched; groups keyed by what is left of the selector; no page-sized arrays. | `d397e27` |
| M-245 | 20,000 small custom-property rules on a page without SVG effects didn't open in 100 s (8,000: 0.9 s): not yet looked into (round 47). A long style sheet counted as text when a document was split, so its text began on the second part: a sheet's text no longer counts. | `d397e27` |
| L-481 | `inherit` on `clip-rule` and the like turns on page-wide inheritance in the SVG check, counting HTML elements too (round 47). Exact property names; HTML elements count for nothing. | `d397e27` |
| L-482 | `CSSPropertyRule` unguarded: on Firefox ESR 115 or Safari before 16.4 a page with SVG effects and a sheet fails to open (round 47). Guarded. | `d397e27` |
| L-483 | The last drawn Markdown document's tokens are kept after its book is closed (about 43 MB): round 47. Let go when another document or book opens. | `d397e27` |
| L-484 | Markdown Raw-only isn't lifted when its block is fixed in Raw, until the editor is reopened (round 47). Looked at again after edits in Raw. | `d397e27` |
| T-71 | No tests for round 47's items (round 47). Tests for each. | `d397e27` |
| H-84 | Round 45's SVG check counts a reference that can reach its own target as a loop, then drops every effect on the page (sheet arrowheads, keyframes, nested rules, gradients): regression (round 46). References to their own target or to what holds them aren't counted (the browser ignores them). | `9a3319c` |
| H-85 | 40,000 `<br>` in one Markdown paragraph hang the tab (a break weighs 0.25 of a piece; 10,000 got past before): round 46. More than 500 line breaks in a block: the block shown as its text. | `9a3319c` |
| H-78 | SVG nesting by `var()` with a fallback in a shorthand isn't seen (22.8 s inline, 14.9 s as a picture): round 46. Declarations read from their text, so a var() fallback counts. | `9a3319c` |
| H-79 | SVG nesting by `@scope` rules isn't seen (22.5 s): round 46. Scoped, nested and keyframe rules count as reaching every element. | `9a3319c` |
| H-80 | SVG nesting by selectors matching only after the check (attributes the reader adds, `:has()`): 33 s (round 46). A rule reaches every element matching its selector's last part, pseudo-classes and attributes left out; inherited declarations reach everything. | `9a3319c` |
| H-81 | SVG nesting by `@import` in a body or SVG-file `<style>`, pasted in after the check (7.6 s, 15.3 s): round 46. The check runs on the finished page, after imports are pasted in, and in SVG files after their sheets are rewritten. | `9a3319c` |
| H-82 | SVG nesting through an id `sanitize` removes after the check, so references reach a later element (15.4 s): round 46. The check runs after ids are cleaned. | `9a3319c` |
| H-83 | Depth doesn't bound drawing: one marker level on a 20,000-vertex line, 24.7 s; two-deep masks of 3,000 rects, 4.4 s (round 46). Fix: estimate drawings. Drawings estimated (vertices for markers, elements inheriting custom properties) instead of depth; past 500,000, references dropped. | `9a3319c` |
| M-240 | A Markdown block shown as plain text is written back escaped after a WYSIWYG edit (regression of round 43's Raw-only guard): round 46. A block shown as its text makes the document Raw-only, as a slow one. | `9a3319c` |
| M-239 | The SVG check grows with sheet rules × matched elements (200 KB page: 16.5 s): round 46. Selector groups indexed by the targets they reach; 200 KB page 2.8 s (was 16.5 s), 3,000 classes 0.4 s. | `9a3319c` |
| L-480 | Each Raw/WYSIWYG switch reads long Markdown again in the worker (round 46). Keep `ok` and blocks in a used entry. The document drawn last keeps its tokens; the editor's checks answer from a used reading. | `9a3319c` |
| L-478 | SVG pattern `href` inheritance isn't counted (round 46). href on patterns and gradients counted. | `9a3319c` |
| L-479 | A nested `@property` with a url can't be removed, yet is counted as dropped (round 46). A nested @property removed from its parent rule. | `9a3319c` |
| T-70 | No tests for round 46's items; the SVG tests time until text, not paint (round 46). Tests for each, timing paint (a screenshot) as well as text. | `9a3319c` |
| D-48 | Round 45 said every way of pointing is read: it isn't (round 46). Round 46's notes say what is read. | `9a3319c` |
| H-75 | Long Markdown with a note defined in a list item, quote or note stopped opening (round 45). Notes found in the page's reading order; missing ones tolerated. | `e469b5d` |
| H-76 | Sheet marker properties dropped, CSS arrowheads lost (round 45, regression). Rule removed. | `e469b5d` |
| H-77 | Ways round H-70: -webkit-mask, escapes, animations, custom properties, sheet classes (round 45). Depth counted over every way of pointing. | `e469b5d` |
| M-235 | H-70's check dropped one-level masks and clips (round 45). Two deep allowed. | `e469b5d` |
| M-236 | Emoji missing when the worker read before their names loaded; editor escaped them (round 45). Worker waits; reading redone. | `e469b5d` |
| M-237 | Token trees of three documents kept (round 45). Let go once drawn. | `e469b5d` |
| M-238 | 30,000 notes took 13 s (round 45). Numbers in a map. | `e469b5d` |
| L-477 | Piece limit missed table cells and made the whole document plain (round 45). Cells counted; only the block shown as text. | `e469b5d` |
| H-70 | Nested markers and masks multiplied drawing (round 43). References to targets holding references of their own dropped; sheet marker properties dropped. | `ad11b83` |
| H-71 | A footnote's body wasn't read by the worker's check (round 43). The worker uses the page's tokenizers. | `ad11b83` |
| M-233 | The page lexed long Markdown again after the check (round 43). The page parses the worker's tokens. | `ad11b83` |
| H-68 | WYSIWYG editing of long Markdown shown as plain text wrote the plain view back over the file (round 43, regression). Raw only for it; the plain view never serialized. | `153eff1`, `4d65a91` |
| H-69 | A JPEG with stray bytes before its size marker, or the marker past 512 KB, wasn't sized and crashed the tab (round 43). Stray bytes skipped; a JPEG or AVIF without a size in its first 512 KB left out. | `153eff1`, `4d65a91` |
| H-72 | A worker error counted as a pass (round 43). A failure. | `153eff1`, `4d65a91` |
| H-74 | The editor started a worker on every scroll (round 43, regression). One check per text; none from the editor. | `153eff1`, `4d65a91` |
| M-229 | A `<use>` resolving to nothing counted as the whole page, dropping working ones (round 43, regression). Counts as one. | `153eff1`, `4d65a91` |
| M-230 | A folder book's fonts, sound and video were read before its page showed (round 43, regression). Not read when served by their address. | `153eff1`, `4d65a91` |
| M-231 | The plain-text `<wbr>` could split a character outside the BMP (round 43, regression). Whole characters with their marks. | `153eff1`, `4d65a91` |
| M-232 | A policy without blob: workers, or marked not fetchable, let every document through unchecked (round 43). Over 200,000 characters shown as plain text then. | `153eff1`, `4d65a91` |
| M-234 | A `<use>` by `about:srcdoc#…` went uncounted with remote content on (round 43). Counted as this page; non-web schemes removed. | `153eff1`, `4d65a91` |
| L-476 | The data: check's cache held whole addresses across books (round 43). Per book, by length and hash. | `153eff1`, `4d65a91` |
| D-47 | nginx.conf.example's CDN hosts lacked cdnjs (round 43). Added. | `153eff1`, `4d65a91` |
| H-64 | `<use href="#%6c5">` (a percent-encoded fragment): the browser decodes it, `svgUseCap` doesn't, so a 1 KB fan-out hangs the tab (round 42). References resolved as the browser does: a fragment percent-decoded. | `1ed87f3` |
| H-65 | A `<use>` of a whole SVG file or data: SVG (no fragment) counts as one copy but draws the whole document: 2,000 hang the tab (round 42). A reference without a fragment counts as the whole file (its recorded size), or the whole page when it can't be resolved. | `1ed87f3` |
| H-66 | A heading, HTML-looking (`<b>`, an autolink) or `$$` line inside a list item ends the pre-pass's count while marked keeps the item: 120 KB, 19 s to open; the editor runs it on each change (round 42). The pre-pass is gone: Markdown over 20,000 characters is first read by marked in a worker (the same file, its hash checked) for at most 5 s; past it the document is shown as plain text with a note. The editor's line matching reads long Markdown only once that check passed. | `1ed87f3` |
| H-67 | One long line of emphasis (`*a` × 200,000, 400 KB) takes time with the square of its length in marked: 34 s, the tab busy after (round 42). The worker check; and the plain-text view breaks words of 1,000+ characters every 200 (a 400 KB word took 15 s to lay out, also as a .txt; now 0.5 s). | `1ed87f3` |
| M-225 | data: pictures typed other than `image/…`, or with `;base64` not last in the type, are drawn by the browser but their size isn't checked: a 20,000² PNG crashes the tab (round 42). Every data: picture but SVG has its size checked, whatever its type; base64 only when the type part ends in `;base64`. | `1ed87f3` |
| M-226 | A data: picture over 8 MB of text is let through unchecked (round 42). Only the first 512 KB decoded for the check, however long the address. | `1ed87f3` |
| M-227 | Percent-encoded data: is decoded a character at a time (8 MB: 12 s), for each element and each pass, uncached (round 42). A fast decoder of the first bytes only, and the result kept per address. | `1ed87f3` |
| M-228 | A huge picture typed `audio/mpeg`, `font/…`, `text/css` or `image/svgz`, or named `.mp3`, `.woff`, `.css`, skips `pictureFits` but `<img>` draws it (round 42). Every file but SVG (cleaned and counted on its own) has its header read, whatever its type or name. | `1ed87f3` |
| L-470 | `svgUseCap` walks every page whole, `<use>` or not, at least twice (200,000 elements: about 0.3 s a time) (round 42). `svgUseCap` does nothing on a page without `<use>`, and works out sizes only for SVG files. | `1ed87f3` |
| L-471 | The pre-pass keeps counting into a block quote after a list, and cuts a table in a long item into a paragraph of pipes (round 42). Gone with the pre-pass. | `1ed87f3` |
| L-472 | A real code block over 2,000 non-blank lines gets an empty line put in (round 42). Gone with the pre-pass. | `1ed87f3` |
| L-473 | Reverb's credits are in Settings only, which a site can hide (`SHOW_SETTINGS_BUTTON: false`); the offer still points there (round 42). Where Settings is hidden, the download offer gives the credits itself. | `1ed87f3` |
| L-474 | A page nested deeper than `svgUseCap` can follow (20,000 levels) loses all its `<use>`, harmless or not (round 42). Counted with a stack of its own, however deep. | `1ed87f3` |
| H-61 | A page's `<use>` of a sprite file's big group, many times over, hung the tab: each SVG file was capped on its own (round 41). A sprite's elements carry their copy counts; a page's use of one counts that much. | `b8a76e2` |
| H-62 | `data: image/svg+xml,…` (a space before the type) skipped the data: SVG cleaning, in pages and styles (round 41). data: addresses read as browsers read them. | `b8a76e2` |
| H-63 | marked still quadratic for a list in a block quote, or after a line taken for a fence marked doesn't take (round 41). The pre-pass looks inside quotes, recognises fences as CommonMark does, and cuts inside one after 2,000 lines. | `b8a76e2` |
| M-218 | Huge pictures still crashed the tab as data: pictures (pages, SVGs), typed oddly or unlisted, or as a GIF frame larger than its screen (round 41). Every non-font, non-media file's header read whatever its type; data: rasters checked; GIF frames counted. | `b8a76e2` |
| M-219 | A data: SVG with a literal `%` was dropped (round 41, regression from H-60's fix). Percent-decoding that keeps a stray `%`. | `b8a76e2` |
| M-220 | Every `<use>` of a page dropped past 50,000 copies, MathJax's glyphs included (round 41, regression). Limit twice the page's own elements plus 50,000. | `b8a76e2` |
| M-221 | Every first Reverb download said "downloaded again" (round 41, regression). The flag read before it is set, and kept per copy. | `b8a76e2` |
| M-222 | Two folders of a site deleted each other's Reverb copy, each visit downloading again (round 41, regression). Only other revisions' folders removed. | `b8a76e2` |
| M-223 | On a Reverb site, "Your voices" hid stored voices' words fields (drawn before the config) (round 41, regression). Drawn again once the config is read. | `b8a76e2` |
| M-224 | The codec's credit only a tooltip, without "based on Meta Llama 3"; the README limited providing the agreements to serving the codec (round 41). Shown in Settings wherever Reverb is on, with links to both agreements; the offer says where; README. | `b8a76e2` |
| L-463 | A folder book's pictures downloaded twice (round 41). Its first 512 KB asked for by range. | `b8a76e2` |
| L-464 | OS/2 BMPs' 16-bit sizes read as 32-bit, so refused (round 41). Read by their header's size. | `b8a76e2` |
| L-465 | The list pre-pass could cut an HTML block or `$$` math after a list, or a fence in a quote (round 41). A list ends at those; quotes followed. (A cut in an indented item can still make a list loose.) | `b8a76e2` |
| L-466 | data: SVGs copied anew each time a page was drawn (round 41). Kept per book. | `b8a76e2` |
| L-467 | Reverb speech saved before M-214 still played for preset voices (round 41). The key carries `s2`. | `b8a76e2` |
| L-468 | The audiobook didn't check a Reverb site voice's version, and could save new speech under an old key (round 41). It waits for the check; a voice carries its version. | `b8a76e2` |
| L-469 | runntime's and js-tiktoken's MIT texts missing from LICENSES.txt (they ship none) (round 41). Upstream licences kept at pinned commits, added by the build. | `b8a76e2` |
| D-46 | README: re-running `fetch-reverb.sh` for the licences; "these voices" twice (round 41). Done. | `b8a76e2` |
| H-59 | A Markdown list item followed by many lines without a blank one freezes the tab: marked's list tokenizer takes time with the square of the lines (`- a` then N lines `b`, or `  b`): 16,000 lines 1.2 s to read, 200 KB 50 s to open, 1 MB minutes; again at each parse. Reachable by `?book=`, `?get=` and links. Fix: a linear pre-pass ending a list paragraph after about 1,000 lines without a blank one (or a newer marked if fixed); a fixture. A linear pre-pass (`mdUnstick`) puts a blank line in after every 1,000 lines of a list item without one (not in a fenced code block, and not past the list's end), which only starts a new paragraph there; the editor's line matching allows for the lines put in. 200 KB of such a list: 0.04 s to read instead of 47 s. Tested. | `9d79c14` |
| H-60 | An SVG `<use>` fan-out (about 1 KB; ten `<use>` of the level below at each of six or seven levels) hangs the tab: inline in a document, as a picture, or as a book's cover, which `setBookIcon` decodes for the tab icon whatever the page shows; `data:image/svg+xml` pictures skip `svgURL`'s cleaning. Fix: count each SVG's expanded size (a `<use>` counts as its target, memoised by id) in `svgURL` and `sanitize`, dropping `<use>` past about 20,000; `data:` SVG pictures through the same cleaning. `svgUseCap` counts the copies an SVG's `<use>` elements would make (each counted as its target, once per element; a loop counted once; nesting too deep counted as too much) and drops its `<use>` elements past 50,000 more than its own elements: in SVG files and covers (`svgURL`, now `svgClean`) and inline in pages (`sanitize`, with targets found in the whole page). `data:image/svg+xml` pictures in pages and styles are cleaned as SVG files are (`svgDataURL`), not shown as they came; one inside an SVG isn't followed. Tested (inline, as data: pictures and in a style, as the cover). | `9d79c14` |
| M-213 | Reverb's codec is under the Boson Higgs Audio 2 Community License (Llama 3-based), stated nowhere: a site serving it from `reverb/models/` must ship both agreements, a Notice file with its set wording, and display "Built with Higgs Materials licensed from Boson AI…", and past 100,000 annual active users needs an expanded licence from Boson; `fetch-reverb.sh`'s NOTICE.txt names the codec without a licence, and the README speaks only of the weights' CC BY-NC (and of a `LICENSES/` folder it doesn't write). Fix: fetch the licence texts into `reverb/models/LICENSES/`, the Notice lines in NOTICE.txt, and the terms in the README beside CC BY-NC (and in the server repository's). `fetch-reverb.sh` fetches, checked like the rest, the codec's agreement (Boson Higgs Audio 2 Community License), the Meta Llama 3 Community License it takes in, and both model cards, at pinned revisions, into `reverb/models/LICENSES/`; its NOTICE.txt carries the Notice lines the agreement asks for and says what a site must display and follow. The reader shows both credits as the Reverb voice's title in the read-aloud bar; the README (the voice, the licences) and the server repository's README (`9129ccc`) state the terms. Tested (the script). | `9d79c14` |
| M-214 | Custom Reverb voices speak slower than their recording: with `verbalize` given to `createTextToSpeech`, runntime's `spokenInput` rebuilds the voice without `speechFrames`, so the pace follows the whole clip, silences included (a Settings recording with 3 s of silence: about 20% slower, longer gaps). Fix: spell the text (and preset transcripts once, in their language) in the reader and give runntime no `verbalize`, passing the voice whole. The reader no longer gives runntime `verbalize`: it spells the text itself (in the book's language) and each voice's words in their own language (presets once, as loaded; custom voices as made), and passes the voice whole, `speechFrames` and all. The stand-in engine now behaves as runntime does when given `verbalize` (dropping `speechFrames`), and the tests check `speechFrames` reaches it. | `9d79c14` |
| M-215 | A Reverb site voice's version is kept only in memory: a visit where its HEAD check fails (offline, 8 s, 5xx) keys it `''`, so its saved speech and made voice aren't found and the recording is fetched again (reproduced: nothing played, "couldn't be fetched"); a voice made under `''` may later stand for a replaced recording; old versions' made voices are never pruned. Fix: as ZONOS3: keep the last version seen in `store`, prune old ones once the current is known. Each site voice's last version is kept in this browser (`spine:reverbVersions`) and used when a check fails; made voices of older versions are deleted once the current one is known. Tested: the recording unreachable on a later visit, its saved speech plays and the voice isn't made again. | `9d79c14` |
| M-216 | A picture of huge dimensions crashes the tab: a 49 KB 1-bit PNG of 20,000 × 20,000 as `cover-image` (decoded for the tab icon) or in a page; a comic's first page is its cover; a reload by `?book=` crashes again. Fix: read width and height from the header (PNG, GIF, JPEG, WebP, BMP) where the blob is made and refuse past about 100 Mpx; for the icon, check `naturalWidth × naturalHeight` before decoding and drawing. `pictureSize` reads width and height from a picture's header (PNG, GIF, JPEG, WebP, BMP, AVIF/HEIF); `pictureFits` leaves out (as a missing picture) one over 100 million pixels, for pages, comics' pages and the cover (the tab icon, the audiobook's cover). Tested: a 20,000 × 20,000 PNG as cover and in a page, the tab still answering. | `9d79c14` |
| M-217 | `reverb/engine/LICENSES.txt` leaves out five packages bundled in `reverb.js` (js-tiktoken, base64-js, typed-binary, tinyest: MIT; tsover-runtime: Apache-2.0) and lists `@huggingface/tokenizers` 0.2.0, which isn't bundled (runntime's own 0.1.3 is); the compare mode doesn't check LICENSES.txt. Fix: build it from esbuild's metafile inputs, drop the unused dependency, checksum it too, and correct the README's list. `tools/build-reverb-engine.sh` writes LICENSES.txt from esbuild's metafile (every package bundled, sorted: nine, with their licence files) and checksums it too; the unused `@huggingface/tokenizers` 0.2.0 dependency is gone (the bundle is byte for byte the same); the README lists what is bundled. Tested. | `9d79c14` |
| L-452 | A Reverb site voice's words from its `.txt` aren't in its keys (`hashText('')`): a corrected `.txt` never remakes the voice nor drops its saved speech (reproduced); and `rv.checks` is never cleared, so a recording replaced while the page is open isn't seen (L-447 re-checks the server voice on a voice change). A site voice whose words are in a `.txt` has the `.txt`'s version in its own, so a corrected `.txt` makes the voice again (and new saved speech); a site voice is checked again when chosen. Tested. | `9d79c14` |
| L-453 | A voice of your own's language isn't in Reverb's saved-speech key: a passage being made when the language is changed is saved after the edit's clearing, under the same key, and later played as the new language's voice. Fix: `v.lang` in `rvVoiceTag`. The recording's language is in Reverb's saved-speech key, for voices of your own and the site's. | `9d79c14` |
| L-454 | Reverb's errors show only runntime's code ("(INVALID_ARGUMENT)"), never its message ("the text needs N frames, more than the M this device runs at once"; "longer than X s"). runntime's message is shown (its code only when it has none). Tested. | `9d79c14` |
| L-455 | Reverb's downloaded copies are never cleaned or checked: other revisions', the other precision's and Hugging Face's after self-hosting stay in the private file system (up to about 2 GB) with nothing to clear them; a copy the browser didn't keep (or a browser without the private file system) downloads again on each visit unnoticed, unlike ZONOS3's `znKept`. After loading, other `spine-reverb-*` folders and entries other than the weights, codec and tokenizer in use are removed from the private file system; a download the browser didn't keep, one made again since the last visit, or a browser without a private file system is said, as for ZONOS3. Tested. | `9d79c14` |
| L-456 | A GPU lost while `createTextToSpeech` is pending, then resolving, leaves Reverb `ready` over the error: each passage fails with a notice and "Try again" isn't offered. Fix: check `rv.dead` after the await. A GPU lost while Reverb loads is checked after the load: it fails with the reason, and Try again says to reload. Tested. | `9d79c14` |
| L-457 | "Your voices" shows Reverb's words and language fields, its section text and "for Reverb, give the words said in it" where Reverb is off (the default). Where Reverb is off, "Your voices" hides its words and language fields and its sentence about Reverb, and messages don't name it; the WebGPU note names neither voice. Tested. | `9d79c14` |
| L-458 | L-68 back for progress in MB: Reverb, Pocket TTS and ZONOS3 write "N of ~M MB", which the quarter rule (`/(\d+)%/`) doesn't match, so screen readers hear every MB (up to about 750 for Reverb's fp16). "N of ~M MB" progress is announced by quarters, as percentages are. Tested. | `9d79c14` |
| L-459 | `fetch-reverb.sh` reads its list with `while read`, dropping a last line without a newline (the README says to write `checksums/reverb.sha256` by hand): that file is never fetched, yet NOTICE.txt is written; and it has no `.part.url` check (L-58), so after a revision change an old partial file is resumed from the new address, fails its checksum and is downloaded again. The list is read with `sed`, so a last line without a newline is fetched; a partial file from another address is dropped (`.part.url`, as fetch-zonos.sh does). Tested (with the list written without a final newline). | `9d79c14` |
| L-460 | Refresh on the default book shown after a `?book=` (or `?get=`) that failed asks for the failed address again: `openDefault` keeps the failed opening's `asked`. `openDefault` drops the failed opening's record, so Refresh asks for the default book. Tested. | `9d79c14` |
| L-461 | Markdown nested too deeply (`>` 10,000 times, `**` 30,000 times) shows marked's "Please report this to https://github.com/markedjs/marked" in the notice. marked's "Please report this…" is taken out; a stack overflow says the document is nested too deeply to be shown. Tested. | `9d79c14` |
| L-462 | A stray comment, "(off: no Reverb voice, for a site its non-commercial licence doesn't fit…)", trails the `REVERB_VOICES` setting (`index.html`), left from turning Reverb off by default. Removed. | `9d79c14` |
| T-65 | No tests of `fetch-reverb.sh` (its three file sets, a bad option, a failed check, `--no-verify`, NOTICE.txt only after success; `sandbox()` doesn't copy it) or of `build-reverb-engine.sh` refusing a bad option; the versions test doesn't compare `REVERB.rev`/`codecRev` with the script, `REVERB.models` and `REVERB_VOICES` with `checksums/reverb.sha256`, or the engine with its checksum (they agree today). Tests of `fetch-reverb.sh` (its three sets, the licences, NOTICE.txt only after success, a last line without a newline, an old partial file, a bad option) and of the versions and engine agreeing (revisions, model paths, voices, the engine's checksums and licences, a bad build option). | `9d79c14` |
| T-66 | Reader behaviour without a test: REVERB off with `readAloud` "reverb" stored (from another folder); Generate config's default `REVERB: false`; a voice of your own's words changed after it was made (made again, old speech dropped); one deleted while it is made; the real `reverb.js` exporting the names the reader calls. Tested: REVERB off with Reverb stored, nothing loading and the device voice reading; Generate config's `REVERB: false`. (A voice's words changed after it was made, and one deleted while made, were tested already by the custom-voice tests and L-448's.) | `9d79c14` |
| T-67 | The stand-in engine isn't runntime: its `synthesize` keeps `speechFrames` and doesn't spell the transcript in `voice.language` (so M-214 can't show), and its voice maker takes 1 s where runntime needs 3 (the custom-voice tests use a 2 s clip); no test of a site voice's version check failing (M-215); no hostile fixtures for H-59, H-60 or M-216. The stand-in now drops `speechFrames` and spells the words in the voice's language when given `verbalize`, as runntime does, and its voice maker needs 3 s (the clips used are 4 s); M-215's test fails a site voice's check; hostile fixtures for H-59, H-60 and M-216. | `9d79c14` |
| D-40 | README: "Your ZONOS3 voices" is now "Your voices". Corrected. | `9d79c14` |
| D-41 | README: "3–15 seconds" works best for Reverb's custom voices; Settings and the errors say 5–15. 5–15 seconds. | `9d79c14` |
| D-42 | README: the `FULL_PRECISION` row says what a site with `ALLOW_CDN` false needs for Pocket TTS, not that Reverb then needs `./fetch-reverb.sh --all`. The row says Reverb then needs `./fetch-reverb.sh --all`. | `9d79c14` |
| D-43 | README: int4 is "about 370 MB" (MiB) in one place and "about 385 MB" (MB) in another for the same files; one unit throughout. One unit: MB of 1,048,576 bytes, as the reader shows them (fp16 about 753, int8 478, int4 368; the script's sets about 1,050, 370 and 1,230). | `9d79c14` |
| D-44 | README: a `?get=` EPUB from another site is "downloaded whole (its size and ranges aren't shown to other sites)", but it is read in place by range requests when that site exposes `Content-Range`, so it sees which chapters are read and when. Fix the README, or always download a foreign book whole. The code now does what the README said: a book on another site, or sent on to one, is downloaded whole, never read by ranges. Tested (another site exposing `Content-Range`). | `9d79c14` |
| D-45 | REVIEW.md E-50's first bullet says int4 is the default download and fp16 "about 790 MB"; with `FULL_PRECISION` on by default fp16 is, at about 753 MB (the entry says so later). Corrected. | `9d79c14` |
| T-59 | No tests of: search, the audiobook or read-aloud ahead on pages with TeX; Settings' check of MATH_DELIMITERS; a resize across a spanning media query; text files; a `<pre>`-only `language-x` block. (Most came with the fixes in `cfb5b89`; left open by your instruction, as tests.) The rest now has tests: a chapter with TeX read ahead and exported is asked for without the TeX (search beside formulas, Settings' check of the marks, a resize across a spanning media query, text files and a `<pre>`-only block had them already). | `4af6c6d` |
| T-60 | No test of H-49; M-187's test checks the overflow rule, not that the formula can be scrolled. H-49 is tested by H-52's test (unclosed `\(` opens in good time); the wide formula is now scrolled in two columns and the scroll layout, as well as one column. | `4af6c6d` |
| T-62 | The E-47 test clears the shared mock server's ZONOS3 mode only on its last line, so a failure in it breaks the server-voice tests after it. Fix: `try/finally` or `t.after`. The test clears the server's ZONOS3 mode in `finally`. | `4af6c6d` |
| T-63 | No tests of H-56, H-57, M-204 (the stand-in engine can't hang its speaker routes), a deleted voice's embedding, a slow HEAD with ZONOS3, folder-relative site voices, a missing `spk/`; or of E-47's language in the saved-speech key and the export, and an `"instructions": false` server dropping a saved voice. Tested: the language in saved audio's key (a French book's same words made again; with Breeze, not), each chapter's language in the export, and a voice that needs instructions dropped for one of a clip. (The ZONOS3 items came with their fixes in rounds 34 and 35.) | `4af6c6d` |
| D-37 | README: the `readAloud` values leave out `"zonos"`; `SPAN_MAX` names three keys (there are four, with `zonos: 600`), and "(ZONOS3 has no such limit)" doesn't say which ZONOS3; French books: doesn't say ZONOS3 in the browser reads French. README: `"zonos"` among `readAloud`'s values; `SPAN_MAX`'s four keys, and which ZONOS3 has no limit; French books read by ZONOS3 in the browser too. | `4af6c6d` |
| D-38 | README: "a bad entry is left out" of `ZONOS_VOICES` holds for a list, but one bad entry in a single string makes the whole setting ignored; nothing tells a site to re-run `fetch-zonos.sh` for `spk/` (M-207). A single string in `reader-config.json` is now taken entry by entry, a bad one left out, as the README says (tested); the README says so, and to run `fetch-zonos.sh` again after updating. | `4af6c6d` |
| L-431 | With `$` among MATH_DELIMITERS, text full of "$`" takes time of its length × 8000 (about 3.4 s frozen per MB, again for search): each "$`" scans up to 4000 characters. `$`…`$` looked for only when its closing mark is ahead in the line, found once and kept, as H-52's fix does. | `daa3a1a` |
| L-432 | The page's math pass and search's (`chapterDoc`) share one budget, so a search starting between them can leave raw `\(…\)` on the page. Each math pass keeps its own budget while it lets go of the thread (checked by reading: not reproduced). | `daa3a1a` |
| L-433 | The server voice prepares the next chapter in the shown page's language, so a chapter in another (`en-GB` after `en`) is made twice and pauses at the break; the audiobook export uses one language for the book. Passages made ahead, and the audiobook's, in their own chapter's language (kept on its detached copy too), keyed and sent so. | `daa3a1a` |
| L-434 | `ZONOS_VOICES` parsing: an unnamed address with a query (`/v/n.wav?v=2`) splits at `=`; a bad `%` is refused as "URI malformed", or, named, throws when used; a config address with `|` becomes two voices. A name has no / or ?, so an address with a query isn't split; a bad % is kept as written; a config address with | is left out with the reason. | `daa3a1a` |
| L-435 | A value refused in Settings puts the old value back, so a long `ZONOS_VOICES` list must be typed again, and the reason isn't announced to screen readers. A refused value stays in the field to be corrected, and the reason is announced. | `daa3a1a` |
| L-436 | Deleting your voice leaves its embedding in IndexedDB and in memory (queued passages still use it); embeddings of replaced site recordings pile up, and since M-206's fix so do those kept under a site voice's old relative key. A deleted voice's embedding goes with it; a site recording's older versions, and those kept under an old relative address, are cleared once its current one is known. (The engine has no way to remove a session speaker: one per voice, as each is made once.) | `daa3a1a` |
| L-437 | "Your ZONOS3 voices": without WebGPU each message ("Added…", "Deleted…", errors) is overwritten at once by the WebGPU note; focus falls to the page after save, rename and delete; every rename field has the same label. The WebGPU note has a place of its own; focus moves to the voice added or renamed, the next one after a delete, or Upload; each name field names its voice. | `daa3a1a` |
| L-438 | Custom voices, smaller: the take's object URL is never revoked; each encoding leaves a session speaker (up to 60 s of audio) in the worker; no size limit before decoding an upload; a double click on Save adds the voice twice; `zn.encoding` isn't cleared on failure; the recording is fetched without `cache: 'no-cache'` (not reproduced in Chromium). Uploads over 25 MB refused before decoding; the take's address released; Save once at a time; `zn.encoding` cleared and the recording fetched with `no-cache` (round 35). | `daa3a1a` |
| L-439 | `tools/build-zonos-engine.sh` needs `sha256sum` (fails on macOS after the whole build) and ignores options other than `--write`. `build-zonos-engine.sh` uses `shasum -a 256` where there's no `sha256sum`, checked before the build, and refuses unknown options. | `daa3a1a` |
| L-440 | With a box of a book's that has stopped being one (animated, or a style applying later), following a link, a search hit, read-aloud follow or focus still lands on the wrong page: `position` measures before `showPage` marks the boxes again (round 36; turns are right). Boxes are marked again in `geom()` itself, before anything is measured. | `daa3a1a` |
| L-441 | A site theme with an id that's a string but not valid (`"paper"`) is still taken before generated ids, so a valid explicit id it then takes from its name is refused on the theme that gave it (round 36). Only an id that will be used as given (`s-…`) is taken before the generated ones. | `daa3a1a` |
| L-442 | A site voice's recording download that never finishes leaves ZONOS3 on "Preparing voice…" until reload (no timeout; the job ends only on a failed engine) (round 36). The recording's download gives up after 30 s, with the reason; the next passage tries again. | `daa3a1a` |
| H-58 | A book can freeze the reader and keep a chapter from showing: a rule on the attribute the multi-column check marks boxes with (`[data-span-box]{display:contents}`, or a `:has()` on `data-span-own`) makes `spanCheck` → `unspan` → `relayout` call itself until the stack runs out (12-15 s; "Maximum call stack size exceeded"). Regression from M-196's fix. | `e50e041`, `62de5b1` |
| H-56 | Closing Settings while the browser asks for the microphone leaves it recording (up to 30 s) with no controls in sight: `znRecStop(true)` runs before `getUserMedia` resolves, then recording starts in the closed dialog. | `e50e041`, `62de5b1` |
| H-57 | A second "Record a voice" (or Record again) while the microphone permission is pending leaves the first stream, recorder, AudioContext and timer running until the page closes, and the first recorder's chunks are mixed into later takes (a save then fails as "isn't a recording"). | `e50e041`, `62de5b1` |
| M-204 | M-201 is back for custom voices: if the engine dies while a voice is being made (a likely time: the encoder is loading onto the GPU), reading stays on "Preparing voice…" for good; `znEmbedding`'s two engine calls take no signal. | `e50e041`, `62de5b1` |
| M-205 | ZONOS3 waits for a HEAD request to every site voice (up to 8 s each) before reading starts, on every visit, chosen or not (6.3 s with a 6 s HEAD). | `e50e041`, `62de5b1` |
| M-206 | A relative site-voice address (`voices/n.mp3`) is one voice id, embedding key, saved-speech key and version entry in every folder of the site, though it's a different file in each: without differing validators a folder is read in another folder's recording. | `e50e041`, `62de5b1` |
| M-207 | A site that ran `fetch-zonos.sh` before E-48 has no `spk/` but still counts as complete, so every custom voice fails with "speaker embedding computation failed (maximum 60 seconds)" for a 10 s clip; the README doesn't say to run it again (likewise an older copy without L-427's manifests). | `e50e041` |
| M-208 | A site theme chosen in one folder breaks the theme in folders without it: `data-theme` stays, its colours are gone, so the page is light whatever the device, no theme is checked and the theme button is wrong; the colour cache is one for the site, rewritten by each folder, so going back flashes the wrong theme. | `e50e041`, `62de5b1` |
| M-209 | Themes whose names have no Latin letters or digits ("Ночь", "День", CJK…), or that slug alike ("C", "C++"), all get one id (`s-theme`): all but the first are dropped, `"theme"` can pick the wrong one, and Generate config of your own themes makes such a config (renaming isn't checked for duplicates either). | `e50e041`, `62de5b1` |
| L-430 | A book's inline `column-span: all` inside its own multi-column box is always removed (the override runs before its spanners are marked). Regression from M-194's fix. | `e50e041`, `62de5b1` |
| M-210 | Refresh of a `?get=` book that was redirected asks for the address it was sent to (`book.from`), not the one asked for, so it opens at the start and its place is kept under a second key. Refresh asks for what was asked for, kept on the book (and its `?get=` or not), not the address a redirect sent it to. | `e533c90` |
| M-211 | The audiobook makes a chapter in another language with the voice it began with (its snapshot) but keys it with the voice worked out for that language (or one changed since), so reading aloud later plays that audio as another voice's. Each language's key and the voices it names are taken together, in that language. | `e533c90` |
| M-212 | The top bar runs past the window between 821 and about 915 px wide: the title shrinks to nothing and Open is off-screen (E-49's button widened a gap from before). The bar's compact spacing goes up to 1100 px, so it fits from 821 px up with the title showing; no control is hidden (left so, by your decision). | `e533c90` |
| L-443 | Refresh doesn't reach a document's linked stylesheets and SVGs, nor a folder book's files read as blobs (no `no-cache` there); pictures the page loads by address stay cached too. A document's stylesheets and SVGs and a folder book's files are fetched past the cache on Refresh. Pictures and fonts the page loads by their address can still come from the cache: not forced, by your decision; the README says so. | `e533c90` |
| L-444 | Refresh with unsaved edits lets them go when confirmed, before it's known the refresh works; if it fails the edits are gone though the book stays; the question speaks of another book. Unsaved changes are let go only once the book is read again; the question speaks of a refresh. | `e533c90` |
| L-445 | A folder book's name (download name, title fallback) comes back percent-encoded after Refresh. Refresh asks for the address as it was asked for (M-210's fix). | `e533c90` |
| L-447 | A server voice's clip re-recorded while the page is open: its new version is in the key, but the clip kept from before is still sent, so old-clip audio is saved under the new key. The clip is kept by its version too. | `e533c90` |
| L-448 | A voice of your own deleted while its embedding is being made comes back (the job saves it after); speech saved in that voice stays until it ages out, which needs your decision. A voice deleted while it is made isn't kept or used. Your decision: its saved speech is deleted with it. | `e533c90`, `e67e6f6` |
| L-450 | After Refresh, the site's place (API_START) is asked for again, and an older one (the last progress not yet written) can move the reader back. Refresh doesn't ask API_START. | `e533c90` |
| L-451 | The note for a book changed on the server mid-read says to reload the page; Refresh now does it in place. The note names Refresh. | `e533c90` |
| T-64 | Refresh's tests don't cover a redirected `?get=` book, a folder book, or an EPUB served whole (where the cache matters); the EPUB test passes without the fix. Tests for each, with an EPUB served whole and a page whose cache is really used. | `e533c90` |
| D-39 | README and REVIEW say Refresh opens at the same place for `?get=`, untrue with a redirect (M-210) or a site's API (L-450). README: what Refresh keeps and what can still come from the cache. | `e533c90` |
| L-446 | After a Save as to this computer, Refresh brings back the site's copy, not the file saved. Your decision: Refresh is hidden once it has been saved to this computer from the editor. | `e67e6f6` |
| L-449 | The audiobook reads chapters in languages the voice doesn't speak (sent anyway, or read by the book's model), which reading aloud doesn't. Your decision: such a chapter is read in the book's language, or left out with a note if the voice can't do that either; reading aloud no longer prepares ahead a chapter it won't read with the natural voice. | `e67e6f6` |
| E-49 | Refresh: a button between Edit and Open for a book from the site (`?book=`, the default book, `?get=`, a link between documents) that reads it again from the site, past the browser's cache, without reloading the page, at the same place; hidden for a file from this computer, the sample and while editing; the book shown stays if it can't be read; in Text settings too; `SHOW_REFRESH_BUTTON`. No keyboard shortcut. | `1c0de7b`, `0ce6c28` |
| E-48 | Custom voices for ZONOS3 in the browser, listed first among its voices: recordings by address (`ZONOS_VOICES`, a setting and in reader-config.json, checked as settings are, in Generate config), uploaded files and recordings made with the microphone in Settings (meter, timer, a stop at 30 s, play back, then save or record again), kept in the browser (IndexedDB) with play, rename and delete. On first use the engine's speaker encoder (`spk/`, 45 MB once, with progress; now fetched by `fetch-zonos.sh`) makes a speaker embedding from the clip, which the reader keeps and sends with each passage, so later visits need neither the clip nor the encoder; a site recording's version (ETag or date) is part of its key. Limits as written up: embedding-only voices, and uploads and recordings stay in one browser. | `f49f85c` |
| E-46 | ZONOS3-Mini in the browser: a "ZONOS3" natural voice on WebGPU (43 languages, ~30 built-in voices, the book's language first), with its engine built from source into `zonos/engine/` (reproducible; `tools/build-zonos-engine.sh`), the models self-hosted by `fetch-zonos.sh` or from Hugging Face, and English numbers, money, dates and abbreviations spelled out first (`zonosText`). | `6ef2a33`, `d66077e` |
| H-54 | A ZONOS3 passage cut off partway (the engine ends the stream as if finished when it fails once audio has started) was kept and played cut short on every reread. An answer much shorter than its text fails, and is asked for again one sentence at a time. | `31be1bc` |
| H-55 | After a lost GPU, "Try again" reported ZONOS3 ready on the dead engine (it starts up once and keeps its workers), and each retry added a failure callback. The engine is marked dead, says to reload, and has one callback. | `31be1bc` |
| M-201 | Passages in flight when ZONOS3's engine died could wait for good (it doesn't end them), blocking every later one. They are aborted, and the queue starts afresh. | `31be1bc` |
| M-202 | `zonosText` made correct English worse: "$1.5 million" as "one dollar.5 million", "Part C" as "one hundred", "1:1" half converted, phone numbers and dates read as sums, "007" as "seven", "Elm St." as "Saint". Each left as written or read right; ranges ("10-20") read "ten to twenty". | `31be1bc` |
| M-203 | A ZONOS3 download that stopped partway (or lost a bad file to the check) was used, with no fallback. Only a finished one is (fetch-zonos.sh's NOTICE.txt, removed at the start of each run). | `31be1bc` |
| L-423 | The saved audio's key had no version for `zonosText`'s rules, so clips with old readings stayed. It has one. | `31be1bc` |
| L-424 | `zonosLang` read a script subtag as the region ("en-Latn-GB" as US English). Skipped. | `31be1bc` |
| L-425 | The audiobook dialog didn't name ZONOS3 among the natural voices. | `31be1bc` |
| L-429 | L-428 missed the common case: Chrome refused to keep ZONOS3's models for lack of room in the site's quota (QuotaExceededError, which the engine only logs), keeping some files, and the check counted any file as a copy. A copy counts as kept only with all 16 model files, and before downloading the reader checks the room left (navigator.storage.estimate) and says, with the figures, when the models won't fit, pointing to disk space and "Saved speech kept in this browser". | `b500bac` |
| L-428 | When the browser didn't keep ZONOS3's models (a private window, site data cleared when it closes, storage full or reclaimed), they were downloaded on every visit with nothing said, and a load from the browser's copy looked like a download. Now: "Loading ZONOS3 from this browser's copy" when nothing is downloaded; a notice, with the site's storage figures, when a download wasn't kept or a copy from an earlier visit was dropped; and the browser is asked once to keep the site's storage (navigator.storage.persist). The cache name is checked against the engine's. | `539ff49` |
| L-427 | On a site that answers missing files with a page and status 200 (not 404), self-hosted ZONOS3 failed to start: its engine reads the manifests of three models fetch-zonos.sh left out (speech editing, its aligner, the full-size decoder) and takes only a 404 as "not here". fetch-zonos.sh fetches those manifests too (the weights still load only when used, which the reader never asks for); the reader's own check of the folder already turned such pages away (now tested). | `fad0b02` |
| L-426 | ZONOS3's download size was ~940 MB (decimal, every file) in the offer and ~878 MB (binary, the tensors) in the progress. One unit: about 900 MB. | `d432b4c` |
| T-61 | The stand-in engine started afresh on every call, kept one failure callback and never cut or held a stream, so tests couldn't see H-54, H-55 or M-201. It behaves like the real one now, with tests for each. | `31be1bc` |
| E-47 | Server voice in the book's language: `/health` may list the server's languages (ZONOS3, in the new jskenney/epub-reader-tts-server-zonos3) and say `"instructions": false`; Server voice is then offered for books in those languages, the book's language is sent with each request (and kept in the saved audio's key), and instruction-only voices are left out. A server listing none (Breeze) works as before. | `c670c10` |
| E-40 | Code and alert colours follow the theme: a theme's own (`code`, `alerts` in THEMES) as given, else GitHub's made readable (4.5:1) on its background; in e-ink and high contrast the text's colour, in bold. | `b39c8c8` |
| E-41 | E-ink (no shadows or motion), High contrast (and System when the device asks for more contrast) and Night (warm, dark) themes; e-ink and high contrast show a book's text in their own colours. | `b39c8c8` |
| E-38 | Themes of the reader's own: made from the theme in use in Settings, named, coloured (page, text, links, interface), dark or not, with a warning under 4.5:1 contrast; kept in the browser and drawn before the first paint; the rest of the interface's colours worked out; hex colours only. | `b70323c` |
| E-39 | A site's `THEMES` in reader-config.json, offered beside the built-in ones; `theme` may name one as the folder's default, `LOCKED` can lock it; a bad one left out with a warning; Generate config gives the site's and the reader's themes. | `b70323c` |
| H-52 | H-49 wasn't fixed. The next closing mark is found once and kept until the scan passes it: linear. | `257eaf5` |
| H-53 | Some highlight.js grammars took time with the square of a block. Blocks of up to 20,000 characters, with no word over 300. | `257eaf5` |
| M-193 | Each `chapterDoc` had a page's whole budget. Text read for search, reading aloud ahead and the audiobook gets no colours, and math within one budget for the book, filled up slowly, giving the thread back every 50 ms; Temml results are kept by their TeX. | `257eaf5` |
| M-194 | A book's inline `column-span:all !important` beat the pin. Overridden in place, outside a book's own box. | `257eaf5` |
| M-195 | A "multi-column box" that wasn't one exempted its blocks. Only block containers count. | `257eaf5` |
| M-196 | Fixing a book's columns froze its responsive layouts. Not fixed any more; boxes are checked again on relayout and page turns, and lose their exemption if they stop being boxes. | `257eaf5` |
| M-197 | Laying out colours wasn't bounded. At most 60,000 characters of code coloured per page or document. | `257eaf5` |
| M-198 | Wide display math couldn't scroll in the page layouts. A formula's own scrolling isn't undone, and a sideways wheel over it scrolls it. | `257eaf5` |
| M-199 | The reader's colours could land on a dark `<code>` or a page's own `.hljs` theme. Its background and colour go on the `<code>` too. | `257eaf5` |
| M-200 | Pseudo-elements, `html::marker` and `head` pushed the page. `column-span` pinned on pseudo-elements, html `display:block`, the head hidden, markers off. | `257eaf5` |
| L-417 | The highlighting budget was checked before its reset. Reset before blocks are chosen. | `257eaf5` |
| L-418 | A formula before any backslash took its tick form. Only before a digit, `$` or `\$`. | `257eaf5` |
| L-419 | The pin removed a book's html/body decorations. They're taken out of the flow instead, still shown. | `257eaf5` |
| L-420 | Each click on a display formula added a paragraph. An empty one after it is used again. | `257eaf5` |
| L-421 | `unspan`'s check never skipped. The reader's own styles aren't looked at. | `257eaf5` |
| L-422 | Nested multi-column boxes took exponential time. Past three deep they're laid out as one column. | `257eaf5` |
| D-36 | README on the limits for math and code, Markdown included. | `257eaf5` |
| H-49 | Unclosed `\(` froze the tab. A closing mark not found isn't looked for again before where the search ended. | `cfb5b89` |
| H-50 | Temml work wasn't bounded. Each document or page has 3 s of Temml time (failures charged) and 5,000 formulas; past them TeX is shown as written. | `cfb5b89` |
| H-51 | highlight.js took time with the square of a long word. 2 s of highlighting per document or page, and no block with a word over 1,000 characters. | `cfb5b89` |
| M-186 | Search, the audiobook and read-aloud ahead read the raw TeX. `chapterDoc` reads TeX and code as the page does. | `cfb5b89` |
| M-187 | HTML and EPUB display math overflowed. The overflow rule is for every document. | `cfb5b89` |
| M-188 | The reader's code colours on a book's dark background. Its coloured blocks have its own background and text colour. | `cfb5b89` |
| M-189 | `unspan` could be passed. `column-span` is pinned in the flow again; only blocks inside a book's own multi-column box carry the session token that exempts them, and that box's columns are fixed so it can't stop being one. | `cfb5b89` |
| M-190 | Pseudo-elements and scroll-marker groups pushed the page out. `::before`/`::after` on html, body and the clip, and `scroll-marker-group`, pinned to none. | `cfb5b89` |
| M-191 | A document's own `data-ed-unwrap` was unwrapped. The holder's attribute holds the session token, checked on write-back. | `cfb5b89` |
| M-192 | Marks around math wasn't checked in Settings. Checked as in reader-config.json, refused with its reason, saved in its normal form. | `cfb5b89` |
| L-409 | A `<pre>` holding its code wasn't coloured. The colours apply to it. | `cfb5b89` |
| L-410 | E-37 ran on plain text. Not any more. | `cfb5b89` |
| L-411 | An E-37 library that never answered kept a chapter from showing. Waited for at most 8 s, then not again. | `cfb5b89` |
| L-412 | A click on a display formula and typing. Alone: a new paragraph after it. (Within a line, the space after it can still be lost as Chromium collapses it.) | `cfb5b89` |
| L-413 | `#noticeLive` kept a long notice's start. Cut in the middle as the notice is. | `cfb5b89` |
| L-414 | marked 18 left out the line break after an HTML block. Put back. | `cfb5b89` |
| L-415 | All 32 noncharacters made the marker collide. Then every `$` is escaped, with no marker. | `cfb5b89` |
| L-416 | A `\ref` alone lost its TeX. Shown, and written back, as written. | `cfb5b89` |
| D-35 | README and `fetch-libs.sh` on Temml and highlight.js beyond Markdown; Settings' list. | `cfb5b89` |
| E-37 | Math and code highlighting in HTML pages and EPUB chapters: TeX between `\(` `\)` and `\[` `\]` as MathML by Temml (not MathJax: no script runs in the book's frame, the browser draws MathML, one engine with Markdown's), code blocks naming their language coloured by highlight.js, each library loaded only for a page that needs it; not while editing (the source is saved as written), in fixed-layout pages or comics; a book's own highlighting keeps its colours. Which marks count (`\(`, `\[`, `$$`, `$`) is the setting `MATH_DELIMITERS`, `\( \[` by default. | `1004c3c`, `966c3e7` |
| T-47 | `NCACHE_SEC` had no test. Left as it is, by your decision: it acts only after minutes of audio played, which streamed audio can't be sped through in a test, and the cache never goes below about a minute of audio; a test would need a hook in the reader for tests alone. The setting only decides how much finished audio is kept in memory for replay (more memory, or audio made again sooner, if wrong); its eviction is one line, and `LOOKAHEAD_SEC` has a test (`3d1deb1`). | Left as it is, by your decision |
| H-47 | marked 15.0.12 took time with the square of emphasis delimiters. marked 18.1.3, which doesn't (`'a _'` × 20,000: under a second). | `56f3a4e` |
| H-48 | Typing into a formula was lost (Chromium ignores contenteditable on MathML). In the editor a formula is held in a span the caret can't enter, and a click on a mark puts the caret after it. | `3420e89` |
| M-182 | `mdNoMarks` cut a document's words naming the marks. Gone: a document's HTML is left as written; the reader's marks carry a token drawn per session, and only marks with it are written back from. | `3420e89` |
| M-183 | M-173 was passed with `/`. With the token, a document's marks however spelled are written back as the HTML they are. | `3420e89` |
| M-184 | Enter twice in a note lost the next text. What lies outside the notes' list is written back in the note before it. (One Enter still shows a second item until the page is rebuilt; it is written back as one note.) | `f050f54` |
| M-185 | The marker U+E000 turned a document's own into `$`. A noncharacter the document holds nowhere, chosen at each write-back. | `2b11dc3` |
| L-399 | A document's own zero-width spaces after a mark were removed. Only one at the text's start or end is taken out. | `2b11dc3` |
| L-401 | The headings cached for a page went stale in the editor. Found afresh while editing or when one has gone. | `21617cf` |
| L-402 | L-388 missed a code block of one huge line. Split into parts too. (A block with elements in it, and a huge paragraph, are still one.) | `21617cf` |
| L-403 | `mdDollars` cost length × `$`s. Past 60 in a block, every one is escaped. | `21617cf` |
| L-404 | Focus was lost when the notice's origin was hidden. The page takes it then. | `21617cf` |
| L-405 | `#noticeLive` kept a closed notice's text. Cleared. | `21617cf` |
| L-406 | With FORCE_LTR the Direction row said left to right for text that turns right to left. It says what the text does. | `21617cf` |
| L-407 | At 320 px Open wrapped alone to the left. It stays at the right end. | `21617cf` |
| L-408 | A long notice lost its reason. Cut in the middle. | `21617cf` |
| T-58 | `waitFor` didn't survive a throwing check. It counts as not yet. | `21617cf` |
| H-45 | `column-height` (rows of columns) stopped paging. Pinned with `column-wrap`. | `b3636b6` |
| H-46 | The footnote mark's search scanned the rest of the paragraph at each stop. Within 4 KB. | `164f990` |
| M-180 | The html box's margin and width, and the clip's writing mode, weren't pinned (no text seen). Pinned. | `b3636b6` |
| M-181 | Scroll snapping put the clip back where it snapped. Pinned to none. | `b3636b6` |
| L-400 | `column-span:none` on everything broke spanners in a book's own multi-column boxes. Only those whose nearest multi-column box is the reader's flow are kept to a column. | `164f990` |
| H-44 | A book could stop paging with `offset-path` or `columns` on html. Both pinned. | `c0e4fa1` |
| M-169 | `column-span:all` broke paging. Pinned to none in the pages. | `c0e4fa1` |
| M-170 | The emoji `start` made one paragraph quadratic. It returns the first `:name:`-shaped place, within 4 KB. | `89a2506` |
| M-171 | Without blank lines, `mdParaStart` scanned the rest of the document. It looks 16 KB ahead at most. | `89a2506` |
| M-172 | An unclosed `` $` `` was looked for to the end. Within the line and 4,000 characters. | `89a2506` |
| M-173 | A document's raw HTML could carry the editor's marks. They're stripped from its HTML as it is read, and only the reader's formulas (`data-md-tex`) come back as TeX. | `1009c49` |
| M-174 | Each page turn sorted the section's headings pairwise. They're ordered once per page build. | `d314209` |
| M-175 | Writing back many notes was quadratic. Notes are found by label from one map. | `0cfc433` |
| M-176 | `maxExpand: 200` turned away ordinary formulas. 1000, as KaTeX; the size caps still bound it. | `89a2506` |
| M-177 | Right to left, both footer buttons pointed inward. The row is reversed. | `5fcac22` |
| M-178 | A note's lazy line took `---` and `***`. A rule or an underline ends the note. | `0cfc433` |
| M-179 | `$`s split by emphasis or a link became math when written back. A block's `$`s are settled once it is whole. | `00e1419` |
| L-384 | Text typed after a mark could change it. A formula before `$` takes its tick form; emoji before a digit stay emoji (only digit names are times). | `00e1419` |
| L-385 | The zero-width space leaked when typing before it. It is taken out wherever it is in the text after a mark (a document's own one there goes too: the editor's write-back sees only the original attributes). | `ecb88f9` |
| L-386 | A `~~~` fence with a backtick in its info came back as a broken backtick fence. Tildes then. | `da0b32f` |
| L-387 | `pathPlain` didn't resolve `..`. Resolved after decoding. | `da0b32f` |
| L-388 | A huge code block was one `<pre>`. Plain code is split by lines into parts. | `da0b32f` |
| L-389 | Enter in a note made a hidden second definition. Items of one label are one note. | `0cfc433` |
| L-390 | A huge summary or head was copied into each piece. Only one under 2,000 characters. | `da0b32f` |
| L-391 | The body's geometry variables could be overridden. Important (comics' values in the same rule). | `c0e4fa1` |
| L-392 | The phone bar ran past the edge at 320 px. It wraps. | `72a4776` |
| L-393 | Long notices scrolled on phones. Full width, no height limit. | `72a4776` |
| L-394 | Right-to-left documents said "Left to right" in the scroll layout. From the text in every layout. | `5fcac22` |
| L-395 | Focus was lost when a notice closed; OK and × did the same. Focus goes back; no × beside OK. | `72a4776` |
| L-396 | A status notice might not be announced. Information notices go through a status region always there. | `72a4776` |
| L-397 | Read aloud's reason was only in a title. Text settings shows it (R also says it in a notice). | `72a4776` |
| T-57 | The L-378 and L-379 tests let L-392 and M-177 through. They check 320 px and the buttons' sides. | `5fcac22` |
| D-34 | README on the emoji list's trigger and the highlighting limit. | `3545a82` |
| H-38 | The reader's CSS layer had a fixed name a book could join and undo the pins with. It is named at random per page. | `5f32611` |
| H-39 | A book could stop page turns with `@property` on the offset variable or slow transitions. The variable is named at random and set inline, transitions and animations pinned to none. | `5f32611` |
| H-40 | Opening Markdown took time growing with the square of its length. Block starts are looked for only to the paragraph's end; a note is read line by line. | `453acac` |
| H-41 | A few KB of TeX could freeze the tab. Temml runs with expansion and size limits, and TeX and MathML per formula and per document are capped. | `453acac` |
| H-42 | SVGs naming further SVGs got past the per-page budget. An SVG inside an SVG isn't followed. | `453acac` |
| H-43 | Text typed after an emoji, a note mark or a formula was lost. They aren't editable in place, and the caret goes after them. | `1d3bf62` |
| M-161 | The SVG budget was never given back. A page's count starts again each time it is built; reads for no page have the picture's limit only. | `453acac` |
| M-162 | Math and dollars written back could change meaning. A formula is written in a form that reads back as the same formula; only a $ that would close one is escaped; TeX that failed comes back as written. | `382dd9c` |
| M-163 | History positions were reset on reload. They are kept in the history entries. | `d7f8d55` |
| M-164 | Footnotes and code in the write-back. A note is written back where it was, a second of the same label and an unknown `[^label]` as written, labels match in any case; a fence keeps its info string, and Enter in code is kept. (The unindented next line: `453acac`.) | `8fc122a` |
| M-165 | Bare URLs stopped being linked once the emoji list was loaded. Fixed. | `d7f8d55` |
| M-166 | Large code blocks were slow to highlight. Blocks over 100 KB aren't highlighted. | `8fc122a` |
| M-167 | A draft's notice offered only Edit, and Cancel deleted the draft without saying so. The notice can be closed, and the question says what Cancel does. | `382dd9c` |
| M-168 | Math in a heading showed its TeX too in titles and contents. Heading text leaves out the annotation. | `382dd9c` |
| L-373 | The reader's page opened as a document by other spellings. Paths are compared decoded with slashes merged. | `47eb00c` |
| L-374 | Two footnote labels could make the same id. Every other character is written by its code between two underscores. | `47eb00c` |
| L-375 | `noImportant` lost shorthands using `var()`. It works on the style as the browser writes it back. | `47eb00c` |
| L-376 | The layered copy made the reader's important styling beat a book's. The layer holds the layout rules only. | `5f32611` |
| L-377 | An emoji in a heading gave an anchor unlike GitHub's. The anchor uses the emoji's name. | `382dd9c` |
| L-378 | Line spacing left the phone bar at 400 px, and couldn't be reached with Settings hidden. Below 400 px only, and not with Settings hidden. | `784e473` |
| L-379 | Right-to-left text without the book saying so: "Left to right" in the information panel, chevrons the other way. Both follow the pages. | `2d8c53d` |
| L-380 | Long notices clipped on phones; Read aloud off with no reason; every notice an alert. Shown whole on phones; the button says why; info notices are statuses. | `f78d940` |
| L-381 | A time like 10:30:45 loaded the emoji list. Digits-only names beside digits don't count. | `d7f8d55` |
| L-382 | Split `<details>`, tables and reversed lists lost their summary, head and numbering. Each piece keeps them. | `d1b7a05` |
| L-383 | In the scroll layout the hidden bar's corner was gone once scrolled down. It comes back on scrolling up. | `ceb3c46` |
| T-55 | Flaky waits. Tests wait for the notice they expect (`noticeLike`), `readThenPause` checks its waits, and the editor's tests wait for the text to settle. The 2 s reading-time waits in progress tests are kept, with their margins: they test that time. | `28248b9` |
| T-56 | Test gaps of round 28. Added with the fixes, and the ribbon clicked right to left. | `73dbbb8` |
| D-33 | README on the editor's write-back, the emoji list's source and trigger, line spacing on phones, the corner in the scroll layout, the fonts' size. | `a4e5e9f` |
| M-158 | Edit opened at the last heading of the page shown. It opens at the heading the page falls under, or at the top. | `726d31c` |
| M-159 | Notices with no action couldn't be put away; Read aloud wasn't off for comics. They have OK; it is off. | `f507fc8` |
| M-160 | On phones 360 px wide and less the top bar's last buttons were cut off. Line spacing leaves the bar below 400 px. | `f507fc8` |
| M-156 | Documents opened directly had no size limit, and one huge block wasn't split. 32 MB limit; long blocks split into copies of them. | `13c796b` |
| M-157 | SVG pictures weren't limited per page. 4 MB a picture, 24 MB a page. | `13c796b` |
| L-359 | A folder book's file sent compressed or without a length was read whole before the check. Read as it arrives, given up past the limit. | `13c796b` |
| L-360 | A same-site link whose path starts with // was refused as another site's. Passed on whole. | `e109718` |
| L-361 | A document's link could open the reader's own page as a document. Refused, by link and by ?book=. | `e109718` |
| L-362 | A book's own data-spine-* marks on a link were followed. Taken off before marking. | `e109718` |
| L-363 | A link to the document itself by a name holding "," wasn't recognised. Compared as names. | `e109718` |
| L-365 | A Back or Forward called off pushed the old address again. It goes back by as many steps. | `e109718` |
| L-366 | A document's link clicked in the editor's page gave a false error. It says links work after Done. | `e109718` |
| L-364 | A document right to left by CSS on body or a wrapper read left to right. Direction in their own style is carried too. | `9ea472d` |
| L-367 | Right-to-left books: Next's tooltip named the right arrow, the ribbon filled from the left. Both follow the pages. | `9ea472d` |
| L-368 | Accessibility: the Aa button's name, the menu's check mark read, focus lost by Escape in the contents, no name for the logo. All fixed; NAVBAR_ALT added. | `9ea472d` |
| L-369 | The top bar's corner covered the scroll layout's page and hid with any notice. Kept off the page scrolled down and its scrollbar; hidden only for a notice reaching it. | `9ea472d` |
| L-370 | The !important removal from a body style missed escaped forms. Read and written again by the browser's CSS parser. | `9ea472d` |
| L-371 | fetch-fonts.sh --strict's message for a new family; a link's query dropped silently. A message of its own; the README says links leave the query out. | `8f39ba2` |
| L-372 | Sandboxing by extension follows nginx's types; Caddy didn't sandbox a folder's index.html. The README says so and gives a matcher for folder addresses. | `8f39ba2` |
| T-53 | Flaky tests pressing Space a fixed time after R, and clicking Play after Read aloud. They wait for reading to start. | `8f39ba2` |
| T-54 | Test gaps of round 27. Added with the fixes (Back to ?edit=, unsaved edits and a missing link, a self-link with ",", folder files over 16 MB, the body style, Edit at the page's start, 360 px). | `8f39ba2` |
| D-32 | README: following a document's links; the font preference's g- ids. | `8f39ba2` |
| E-31 | LaTeX math in Markdown (`$…$`, `` $`…`$ ``, `$$…$$`, ` ```math `) as MathML by Temml, the TeX kept in each formula; written back as it was. | `a53b5b3` |
| E-32 | Footnotes in Markdown (`[^1]`), numbered as referred to, gathered at the end with links both ways; written back as they were. | `a53b5b3` |
| E-33 | Alerts in Markdown (`> [!NOTE]` and the rest), set apart in their colours, the dark themes too; written back as they were. | `a53b5b3` |
| E-34 | Emoji shortcodes in Markdown (`:smile:`), from gemoji's list, read only for a document with a `:name:`; written back as their names. | `0d9a2d2` |
| E-35 | Syntax highlighting in Markdown's code blocks naming a language (highlight.js), in each theme; written back as plain fenced code. | `0d9a2d2` |
| H-36 | A book's `--spine-x: … !important` stopped page turns. The offset is set inline with priority. | `9c9c624` |
| H-37 | A book's `@layer` rules beat every `!important` pin of the reader. The reader's rules are also given in a layer of their own, named before any of the book's. | `9c9c624` |
| M-153 | Back or Forward to an `?edit=` entry opened the default book. It opens that document for editing. | `9c9c624` |
| M-154 | Unsaved edits were let go before a document's link was opened, and kept no more when the target was missing. They are let go only once the other document has opened. | `9c9c624` |
| M-155 | Book CSS still moved or clipped the pages (the flow's height, html padding, body position, columns, grid, translate/scale, content-visibility). All pinned in the paged layouts. | `9c9c624` |
| M-144 | A document's link to a missing file, or up a folder, replaced the document with the default book. Links are followed as written against the document's own address, and the target is opened before it is added to the history: a missing one leaves the document open, with a notice. | `4ea6db9` |
| M-145 | After following a document's link, Back and Forward changed only the address; unsaved changes and a running export weren't asked about. They open the documents again (popstate), and both are asked about. | `4ea6db9` |
| L-340 | A document's link to an EPUB or comic beside it gave an error; a link to its own file name reloaded it. Books beside it open; a link to itself goes to the place. | `4ea6db9` |
| L-346 | Link names holding `%2F` were encoded twice. Followed as written. | `4ea6db9` |
| M-146 | The focus handler turned back a page when a link running onto the next page was clicked there. The page stays when part of the focused element is on it. | `9a2a930` |
| M-147 | Right-to-left EPUBs: Edit, then Done or Discard, went to the wrong heading. The editor's place is found by page. | `9a2a930` |
| M-148 | HTML and Markdown documents lost a right-to-left direction. `dir` on html, body or a wrapper is carried to every part. | `9a2a930` |
| L-341 | Horizontal writing also flattened a vertical table header and SVG text. Table cells and SVG keep theirs. | `55e28cc` |
| L-342 | Right-to-left text without `page-progression-direction`: the right arrow went on. The arrows, swipes and sideways wheel go the way the pages come in. | `55e28cc` |
| L-354 | A book's CSS could hide or move the end-of-chapter marker. Its display and position are the reader's. | `55e28cc` |
| L-358 | A saved place could come back a page off in a section of over 1000 pages. Kept to a millionth. | `55e28cc` |
| L-348 | A font added in Settings on a site that self-hosts fonts was blocked in the open page. The page is made again under the new policy. | `987f9ce` |
| L-349 | `fetch-fonts.sh --config` with a relative path failed from another folder. Options are read first. | `987f9ce` |
| L-350 | A family name starting with a digit dropped every extra font. Only style names and numbers continue the styles before them. | `987f9ce` |
| L-356 | `fetch-fonts.sh` read `ADDITIONAL_FONTS` differently from the reader. It leaves out the menu's fonts, takes the styles given when a family is named twice, and skips (with a warning) a family Google doesn't know. | `987f9ce` |
| L-351 | A logo made the top bar three rows tall on phones. Room is left for it. | `156043c` |
| L-352 | A long title or author list couldn't be read in full. They have it as their title. | `156043c` |
| L-353 | `NAVBAR_LINK` without a scheme became a link in the reader's folder. A host-like value is taken as `https://`, with a note. | `156043c` |
| L-355 | With `SHOW_READ_ALOUD` false, focus was lost after Read aloud from Text settings and after closing the bar. It goes to Play, then to the page. | `156043c` |
| L-343 | The sandbox extension list missed other XML types. `kml`, `xspf`, `wml`, `wsdl`, `xsd`, `gpx`, `xbl` and `plist` added (nginx, Caddy, test server). | `4646606` |
| L-344 | A download named like "Notes v1.2" was taken to have an extension. Only the type's own extension counts. | `4646606` |
| L-345 | A book's link could fill the notice with long text. Kept to 400 characters and a few lines. | `4646606` |
| L-347 | Patterns ending in `\s+$`. Replaced by `trimEnd`. | `4646606` |
| L-357 | A file of mixed line endings with an edit undone was marked changed. Line endings alone don't count. | `4646606` |
| T-52 | Two tests failed outside a full checkout. A sample `.mjs` of the suite's own; the line-endings test is skipped without `.git`. | `3e8c886` |
| D-27 | Caddy's `>` deferred header needs a recent Caddy. The example uses the block form with `defer`. | `3e8c886` |
| D-28 | README on `fetch-fonts.sh`: `--list`, the configs it reads, rerunning after `ADDITIONAL_FONTS`, examples without Lexend. | `3e8c886` |
| D-29 | README's `SHOW_*` row: only R, T, L and F are single-key shortcuts. | `3e8c886` |
| D-30 | README's `SPAN_MAX` row: the config form and range. | `3e8c886` |
| D-31 | README's Caddy example: exempt each folder's own copy of `index.html`. | `3e8c886` |
| T-50 | No tests of a link split across pages, hostile link shapes, Back after a linked document, vertical text in single elements, the editor's place right to left, a long notice. All added with this round's fixes. | `3d1deb1` |
| T-51 | Test gaps of round 26 (drift, book CSS on the flow, the Contents heading, the corner, fonts, Text settings → Read aloud). Added with the fixes; reading is seen word by word. | `3d1deb1` |
| H-34 | A document's link with empty steps (`.///host/x.html`) opened a page of another site as a linked document, even with external links off. Such paths are refused, and a linked document must be on the same site. | `555ff0c` |
| H-35 | No size limit for markup below `MAX_ENTRY`: a 144 KB EPUB with a 40 MB chapter froze the tab. Pages, style sheets and contents files over 16 MB of text (`MAX_MARKUP`) are refused with a notice. | `555ff0c` |
| M-149 | A book's CSS on the reader's column flow (padding, border, width, zoom, transform, even `!important`) broke page turns. The flow and its clip are kept free of them, and the page turn goes through the reader's own `!important` rule. | `9dc26bc` |
| M-150 | The page step drifted over hundreds of pages (a column gap of a fraction of a pixel, laid out snapped to 1/64 px), and search hits deep in a chapter landed a page early. The flow's width and gap are rounded down to whole pixels. | `9dc26bc` |
| M-151 | Two elements had `id="tocHead"`, hiding the Contents heading and naming the contents navigation after the book. The title block is `#tocMeta`. | `2eb3e9d` |
| M-152 | The invisible top-right corner covered the editor's Save as… and Done buttons and a notice's buttons. It is hidden while editing and while a notice shows. | `2eb3e9d` |
| H-32 | Right-to-left books (Arabic, Hebrew: `dir="rtl"` or `direction:rtl`) show only the first page of each chapter in the page layouts | `44e4e05` |
| H-33 | Books in vertical text (`writing-mode: vertical-rl`) can't be read past the first screen of a chapter, in any layout | `44e4e05` |
| M-141 | Relative links between HTML or Markdown documents don't open the other document, though the README says they do | `44e4e05` |
| M-142 | Tab moves the focus to links on other pages while the page stays put | `44e4e05` |
| M-143 | A 2 KB EPUB freezes the tab as it opens (a tag-stripping pattern over its leading chapters) | `44e4e05` |
| L-333 | Notices are hidden in full screen, and not announced | `44e4e05` |
| L-334 | Durations can read "1 h 60 min" | `44e4e05` |
| L-335 | The search count says "500+" with exactly 500 matches | `44e4e05` |
| L-336 | Typing in WYSIWYG freezes on a document with many unclosed comments | `44e4e05` |
| L-337 | More patterns slow on hostile text: Markdown write-back, saving HTML, packing an EPUB | `44e4e05` |
| L-338 | The sandbox in the nginx and Caddy examples is a list of extensions: a server typing another extension as XML leaves it active | `44e4e05` |
| L-339 | `blobType` keeps the book's own type string after checking its trimmed form | `44e4e05` |
| D-25 | README: reflowable right-to-left books don't show "the later page on the left" | `44e4e05` |
| D-26 | README: overstates how book files are protected when linked to directly | `44e4e05` |
| M-140 | README's Caddy example: the sandbox header ran before the reader policy, which replaced it (and was case-sensitive) | `a9fee6d` |
| L-331 | A download whose name has no extension lost the one Chromium added from its type | `a9fee6d` |
| L-332 | An audiobook cover's type was taken from its blob, not its bytes | `a9fee6d` |
| M-135 | A folder book's picture of another declared type (an SVG typed PNG) is served as the site's own file: on a server without the example's sandbox header, opened in a new tab, its script runs as the reader | `c9e6702` |
| M-136 | A long front-matter line in Markdown freezes the tab (a regex that backtracks) | `c9e6702` |
| M-137 | Verse with longer lines (poetry, plays, contents with page numbers) is joined into paragraphs (as before this round) | `c9e6702` |
| M-138 | Word text with tab-indented paragraphs and "Chapter One" lines is read as code | `c9e6702` |
| M-139 | Unwrapped stories with short, similar lines and no blank lines become one paragraph (as before) | `c9e6702` |
| L-318 | Unsaved EPUB chapter drafts aren't found after L-311's new key | `c9e6702` |
| L-319 | L-311's guard on old keys is too broad ("HTML: The Definitive Guide" loses its place) | `c9e6702` |
| L-320 | A `?get=` document sent on to another site keeps this site's folder as its base | `c9e6702` |
| L-321 | WYSIWYG write-back of an HTML fragment starting with many comments freezes (a regex) | `c9e6702` |
| L-322 | Markdown write-back of a very long code span is slow (a regex) | `c9e6702` |
| L-323 | Saving a document ending in many unclosed `<meta` is slow (a regex) | `c9e6702` |
| L-324 | Splitting a very long text paragraph searches to the end each time | `c9e6702` |
| L-325 | The editor's download is a blob of the document's own type, live for 60 s in the reader's origin | `c9e6702` |
| L-326 | "CHAPTER I" with its title in capitals below gives two headings | `c9e6702` |
| L-327 | Non-Latin headings (第一章, Greek capitals) aren't found | `c9e6702` |
| L-328 | Quoted signatures in capitals ("M.D.") become headings | `c9e6702` |
| L-329 | Hard-wrapped text with no blank lines and no indents is one paragraph | `c9e6702` |
| L-330 | Tab indentation is dropped in line blocks | `c9e6702` |
| T-49 | No test of L-316 (an archive JSZip reads whole with overlapping files) or of L-312 for archives | `c9e6702` |
| D-24 | The test server exempts every linked copy of index.html, the nginx example only the exact one; the Caddy example has no sandbox for book files | `c9e6702` |
| H-31 | `svgURL` doesn't check the file is an SVG: an XHTML page typed as SVG, opened in a new tab, runs a form's `javascript:` action as the reader (reproduced) | `5aeab40` |
| M-131 | nginx example: the sandbox misses book files named `index.*` and `.shtml`, `.svgz`, `.rss`, `.atom`, `.xsl` | `5aeab40` |
| M-132 | Indented-paragraph text without blank lines and with short (dialogue) paragraphs becomes one paragraph | `5aeab40` |
| M-133 | Text hard-wrapped at more than 80 columns, with blank lines, is split at every line | `5aeab40` |
| L-311 | A book's identifier (or title, without one) can name another book's position key: it takes that book's place and finished mark | `5aeab40` |
| L-312 | `?get=` of a same-site address sent on to another site reports the same-site path to the site's API | `5aeab40` |
| L-313 | A small unwrapped file (a few long lines) is joined into one paragraph | `5aeab40` |
| L-314 | Code or logs with a few long lines lose their line breaks and indentation | `5aeab40` |
| L-315 | A wrapped line starting "chapter three …" becomes a heading in the middle of a paragraph | `5aeab40` |
| L-316 | An archive the in-place reader leaves to JSZip (ZIP64) isn't checked for overlapping files | `5aeab40` |
| L-317 | An SVG declared with a parameter (`image/svg+xml; charset=utf-8`) breaks; caption files (`text/vtt`) lose their type | `5aeab40` |
| T-48 | No test of a non-SVG root in `svgURL`, of the sandboxed extensions, or of encoded paths in the test server's mirror | `5aeab40` |
| D-23 | README: the `/bookshelf/` sandbox doesn't exempt `index.html` | `5aeab40` |
| M-134 | The progress bar's marks were drawn evenly while its fill and clicks count sections by size | `0095173` |
| L-308 | Finishing a book didn't mark its looser record, so leaving at once let an edited copy report it again (the rest of L-282) | `0095173` |
| L-309 | The L-306 fix had folded a statement into its comment | `0095173` |
| L-310 | A change of layout or text size sends a progress update (now in the README) | `0095173` |
| H-30 | A book picture's blob takes the book's declared type: one declared `text/html`, opened in a new tab, runs the book's script as the reader (reproduced) | `8e7fc77` |
| M-126 | `section_percentage` is 100 for a section shown whole (L-298), so another device opens that chapter at its end | `8e7fc77` |
| M-127 | Hard-wrapped text marked by indentation loses its chapter headings into the paragraphs (L-294) | `8e7fc77` |
| M-128 | Unwrapped text with some indented lines is merged again (L-294 undoing M-122) | `8e7fc77` |
| M-129 | Nested or unclosed `attr(` in a book's CSS hangs the tab (each one re-reads the rest of the sheet) | `8e7fc77` |
| M-130 | nginx example: book files under `/bookshelf/` (and books under `/reader/`) opened directly run their scripts on the reader's origin | `8e7fc77` |
| L-299 | Unwrapped text with scene breaks and short lines isn't a paragraph per line (M-125) | `8e7fc77` |
| L-300 | Indentation parting cuts lists, alternately indented poems and code (L-294) | `8e7fc77` |
| L-301 | A host answering 403 for a missing file still stops a folder book being saved (M-124) | Left as it is: refusing the save is the safe side |
| L-302 | `.gitattributes` misses the checksum lists, the workflow and `.gitignore` (M-121) | `8e7fc77` |
| L-303 | With remote content on, an SVG `<set>` on `href` gets round link handling (the animation is only removed when remote content is off) | `8e7fc77` |
| L-304 | No limit on the total decompressed; entries can share data | `58499fb` |
| L-305 | Lowering "saved speech kept" (or 0) frees nothing; the sweep only runs on saving | `8e7fc77` |
| L-306 | The export list's first shift-click uses the previous book's last-clicked item | `58499fb` |
| L-307 | nginx example: its `add_header` drops server-level headers (HSTS) for `/reader/`; no `gzip_vary` | `8e7fc77` |
| T-46 | Tests: the "until reloaded" half of a progress test can't fail; L-76's test can pass having tested nothing; the sample and the flush on opening another book aren't tested; saved speech eviction, media keys, the sleep timer while paused, `LOOKAHEAD_SEC`/`NCACHE_SEC`; the nginx types test is circular | `8e7fc77`, `58499fb` (all but `LOOKAHEAD_SEC`/`NCACHE_SEC`: T-47) |
| D-22 | README: the Tests section (six servers, about 50 minutes); an empty 2xx answer (204) counts as no API | `8e7fc77` |
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
| L-289 | The hidden top bar's corner button covered part of the page | `dc862b1`; reworked after you saw the page pushed down: the button now sits in the page's own top margin and padding, with no strip of its own |
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
