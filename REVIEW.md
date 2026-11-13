# Code and security review

Review of the repository (2026-11-13, round 31): `index.html` (about 10,300 lines), the fetch scripts,
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

## Summary

Round 31's findings are open (below), sorted by importance, with the enhancements E-29, E-30, E-36
and E-1 to E-4, E-6 to E-8, E-22 and E-25 (planned in TODO.md). L-110, T-43 and T-47 are left as they are, by your
decision (see Resolved).

## Open items

Most important first.

| ID | Title | Kind |
|---|---|---|
| H-49 | Unclosed `\(` or `\[` (the default marks) costs a 4000-character search each: 4 MB of them took 66 s to open, paid on every visit. Reproduced. | Hardening |
| H-50 | Temml work isn't bounded: TeX that fails (after 1000 expansions, ~0.3 s each) is never charged (100 formulas, a 2 KB EPUB: 44 s; Markdown too), and 200,000 small formulas make 83,000 `<math>` (1–2 minutes to lay out). Reproduced. | Hardening |
| H-51 | highlight.js takes time with the square of a long word (`java` with 99,000 `$`: 108 s; `js`: 21 s); HLJS_MAX is the only cap, per block, with no total. Reproduced. | Hardening |
| M-186 | E-37 changes only the page: search (its index from `chapterDoc`) can't show a match in a block with a formula; the audiobook, read-aloud ahead and lengths read the raw TeX. Reproduced. | Bug |
| M-187 | HTML and EPUB display math has no overflow rule (Markdown's only): it runs over the next column or is cut off. Reproduced. | Bug |
| M-188 | The reader's code colours (light theme) on a book's own dark `pre` background: strings at 1.4:1. Reproduced. | Bug |
| M-189 | `unspan` (L-400) is passed by an escaped `column-sp\61n`, a style applying later (`:hover`, a media query after a resize): M-169 again (121 pages, text cut off). Reproduced. | Security |
| M-190 | `::before` on html or body (and `::scroll-marker-group`) pushes the page out of the frame: no text on any page. Reproduced. | Security |
| M-191 | A document's own `data-ed-unwrap` elements are unwrapped on write-back: hidden text becomes visible in the saved file (as M-182). Reproduced. | Data loss |
| M-192 | Marks around math typed in Settings isn't checked: a bad value is saved without a word, offers a reload, goes into Generate config, then is dropped; a good one isn't put in its normal form. Reproduced. | Bug |
| L-409 | A `<pre class="language-js">` holding the code itself is given spans but not coloured. Reproduced. | Bug |
| L-410 | E-37 runs on plain text too: a text file's `\(ab\)` becomes math. Reproduced. | Bug |
| L-411 | A library for E-37 that never answers keeps a chapter from showing (no time limit). Reproduced. | Bug |
| L-412 | A click on a display formula and typing: alone, the text joins the next paragraph; within a line, the space after it is lost. Reproduced. | Bug |
| L-413 | `#noticeLive` keeps a long notice's start, not the middle cut the notice shows (L-408). Read. | Accessibility |
| L-414 | marked 18 leaves out the line break after an HTML block: two pictures in blocks of their own touch. Reproduced. | Bug |
| L-415 | With all 32 noncharacters U+FDD0–U+FDEF in a document, the write-back's marker collides with one (M-185). Reproduced. | Data loss |
| L-416 | A formula only `\ref` or `\eqref` gives no `<math>` (a bare link), so the editor writes the link back, not the TeX. Reproduced. | Bug |
| T-59 | No tests of: search, the audiobook or read-aloud ahead on pages with TeX; Settings' check of MATH_DELIMITERS; a resize across a spanning media query; text files; a `<pre>`-only `language-x` block. | Tests |
| D-35 | README: Temml and highlight.js are said to be for Markdown (and in `fetch-libs.sh`); Settings' list lacks Marks around math. | Docs |
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

## Suggested order

1. H-49 to H-51, M-189 to M-191, M-186 to M-188, M-192, then the lows and docs.
2. E-25, E-22, as laid out in TODO.md; E-36 and E-30; then the other enhancements, as wanted.

## Resolved

From all reviews so far, with the commits that fixed them. An item left as it is says so in place of a commit.

| ID | Title | Fixed in |
|---|---|---|
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
