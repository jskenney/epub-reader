# Code and security review

Review of the repository (2026-11-09, round 11): `index.html` (about 4,700 lines), the fetch scripts,
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

The other low items, T-19 and D-7 are open below.

Two more independent reviewers then went over those commits: one on the loading changes, one on the read-aloud
changes and the new tests. They found two medium regressions and a few low gaps, fixed in `c28c12d` and
`1ba12ab`, each with a test that fails on the code before it:
- **M-28:** the new decoding (M-26) trusted a stale declared encoding over text that is valid UTF-8.
- **M-29:** the new look-ahead (M-23) took a chapter that failed to load once as having no text, and skipped it.
- **L-90 to L-97:** smaller gaps in the same changes (see Resolved).
The rest is open: L-98, L-99 and T-20.

*Reproduced* means confirmed in Chromium, Node or nginx against the real code; *read* means confirmed by
reading the code only.

**Tests.** All 126 tests pass. Five more need `SLOW=1` or `NETWORK=1`: the real Kokoro and Pocket TTS models,
self-hosted and from the CDNs, and the libraries and fonts from the CDNs. They passed in round 10; round 11
changed only which self-hosted voice folders are used, which the new M-27 test covers. Every fix in round 11
has a test that fails on the code before it.

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
| **C** | Critical: code running where it shouldn't, data loss, or the reader unusable. *None found.* |
| **H** | High: a security or privacy protection that doesn't hold, or a serious bug. |
| **M** | Medium: a real bug or gap that affects people in normal use. |
| **L** | Low: minor, rare, or defence in depth. |
| **T** | Tests: gaps in the test suite. |
| **D** | Documentation. |
| **E** | Enhancement: a new feature or improvement. |

## Summary

No critical, high or medium items are open. The open items are:
- **Low:** L-74, L-76 to L-79, L-84 to L-89, L-98 and L-99. None keeps a book or a voice from working.
- **Tests:** T-11 (the weekly workflow hasn't run yet), T-13 to T-17, T-19 and T-20.
- **Documentation:** D-7.
- **Enhancements:** E-1 to E-11 and E-15.

## Open items

| ID | Title | Kind |
|---|---|---|
| [L-74](#l-74-pocket-tts-asks-to-download-again-after-a-language-change) | Pocket TTS asks to download again after a language change | Low |
| [L-76](#l-76-a-short-outage-makes-passages-read-sentence-by-sentence) | A short outage makes passages read sentence by sentence | Low |
| [L-77](#l-77-keep_positions_days-applies-to-the-whole-site) | `KEEP_POSITIONS_DAYS` applies to the whole site | Low |
| [L-78](#l-78-the-position-ribbon-from-the-keyboard) | The position ribbon from the keyboard | Low |
| [L-79](#l-79-the-narrow-screen-contents-has-no-focus-handling) | The narrow-screen contents has no focus handling | Low |
| [L-84](#l-84-css-urls-lose-their-fragment) to [L-87](#l-87-the-body-style-attribute-isnt-cleaned) | Smaller CSS cleaning gaps | Low |
| [L-88](#l-88-obfuscated-fonts-arent-de-obfuscated) | Obfuscated fonts aren't de-obfuscated | Low |
| [L-89](#l-89-the-checksum-check-passes-files-the-list-doesnt-name) | The checksum check passes files the list doesn't name | Low |
| [L-98](#l-98-every-chapter-looked-at-is-kept-in-memory) | Every chapter looked at is kept in memory | Low |
| [L-99](#l-99-two-small-read-aloud-races) | Two small read-aloud races | Low |
| [T-11](#t-11-the-weekly-workflow-hasnt-run-yet) | The weekly workflow hasn't run yet | Tests |
| [T-13](#t-13-a-self-hosting-test-needs-internet-but-isnt-gated) | A self-hosting test needs internet but isn't gated | Tests |
| [T-14](#t-14-the-hostile-book-tests-only-run-behind-the-readers-own-policy) | The hostile-book tests only run behind the reader's own policy | Tests |
| [T-15](#t-15-test-housekeeping) | Test housekeeping | Tests |
| [T-16](#t-16-coverage-gaps) | Coverage gaps | Tests |
| [T-17](#t-17-workflow-upkeep) | Workflow upkeep | Tests |
| [T-19](#t-19-two-script-tests-match-anywhere-in-the-page) | Two script tests match anywhere in the page | Tests |
| [T-20](#t-20-round-11-test-gaps) | Round 11 test gaps | Tests |
| [D-7](#d-7-documentation-nits) | Documentation nits | Docs |
| [E-1](#e-1-footnote-pop-ups) to [E-11](#e-11-a-settings-panel), [E-15](#e-15-fixed-layout-books) | Enhancements | — |

## Low

### L-74. Pocket TTS asks to download again after a language change

*Read* (needs the real model). After English Pocket TTS has loaded, `pk.state` stays `'ready'`, and
`ttsUpdateBar` loads on its own only from `'idle'`. So a German book, whose model was downloaded before, shows
the download offer again instead of loading quietly. One click loads it. **Fix:** also load on its own when
`pk` is ready for another language and the new one was agreed to.

### L-76. A short outage makes passages read sentence by sentence

*Read.* Every failed passage is added to `n.failed`, including network blips, the server being briefly gone, a
timeout and a crashed Kokoro worker. Those paragraphs are then read one sentence at a time until reload, which
phrases worse. **Fix:** record only errors from a server that answered.

### L-77. `KEEP_POSITIONS_DAYS` applies to the whole site

*Read.* The daily sweep covers every position on the site with the current folder's value, so a folder set to
`0` ("keep forever") still loses positions when a page in another folder runs with a shorter setting.
**Fix:** say in the README that the setting is site-wide, or keep the longest value seen.

### L-78. The position ribbon from the keyboard

*Read.* Enter on the focused ribbon in the last chapter re-renders that chapter from its start. The ribbon is
`role="progressbar"` but can be focused and clicked, with no keyboard way back. **Fix:** ignore Enter in the
last chapter; consider `role="slider"` with arrow keys.

### L-79. The narrow-screen contents has no focus handling

*Read.* At 820 px or narrower, opening the contents doesn't move focus into it, Escape doesn't close it,
closing it doesn't return focus to the button, and tapping the page leaves it open. **Fix:** all four.

### L-84. CSS URLs lose their fragment

*Reproduced.* `url(s.svg#b)` in a stylesheet becomes the file's address without `#b` (attributes keep it), so
an SVG sprite in CSS shows the wrong picture. **Fix:** carry the fragment over, as attributes do.

### L-85. A remote `@import` after an inlined one is dropped

*Reproduced* (only with `ALLOW_REMOTE_CONTENT` on). Once a local import is pasted in, a following remote
`@import` comes after style rules and is removed. **Fix:** move kept remote imports above the pasted text.

### L-86. An imported sheet's `@namespace` is lost

*Reproduced.* Pasted after other rules or inside a wrapper, `@namespace` is dropped, so `prefix|…` selectors in
that sheet stop working (rare: `epub|type` selectors never match anyway). **Fix:** give such a sheet its own
`<style>`.

### L-87. The body style attribute isn't cleaned

*Read.* `style` on `<body>` is copied to the page without the CSS cleaning. The book policy blocks what it would
load, and with remote content on a relative `url()` points at the reader's site. **Fix:** include `<body>`.

### L-88. Obfuscated fonts aren't de-obfuscated

*Read.* Fonts obfuscated by the IDPF or Adobe method (`META-INF/encryption.xml`) fail to load, and the book's
text falls back to the reader's fonts. **Fix:** undo the XOR of the first 1040 (IDPF) or 1024 (Adobe) bytes
with the key from the identifier.

### L-89. The checksum check passes files the list doesn't name

*Reproduced.* A downloaded file with no line in `checksums/*.sha256` only prints a note, and the run still ends
"All files match" with exit 0, though the README says the check fails closed. Today every file is listed.
**Fix:** fail for files the script itself downloads; keep the note for extra files.

### L-98. Every chapter looked at is kept in memory

*Read.* The detached copies of chapters made for looking ahead (and now, at chapter ends, with the device voice
too) stay in `n.chap` for the whole session, with their DOM. **Fix:** keep only the sentence positions, or keep
the few nearest chapters.

### L-99. Two small read-aloud races

*Reproduced / read.* Pause and Play while the reader is looking past picture pages replays the last passage
before going on. And R pressed just as another book opens (while the server voice is checked) starts reading in
the new book. **Fix:** check the token and the book after each wait.

## Tests

### T-11. The weekly workflow hasn't run yet

Updated.
- **The tests it runs do pass here:** `SLOW=1 NETWORK=1` (the real models, self-hosted and from the CDNs, under
  both reader policies).
- **T-12 is fixed,** so the scripts test also passes as a non-root user, as on a GitHub runner.
- **Not run yet:** `.github/workflows/slow.yml` itself.
- **Scheduled runs can lapse:** GitHub disables scheduled workflows after 60 days without activity.

**Fix:** run it once by hand (Actions → Slow tests → Run workflow).

### T-13. A self-hosting test needs internet but isn't gated

*Read.* "Without local libraries the CDN copy is used" allows cdnjs and expects JSZip from it, so it fails on
an offline machine, though the README says the suite runs locally. **Fix:** skip without `NETWORK=1`, or answer
cdnjs locally as `cdn.test.js` does.

### T-14. The hostile-book tests only run behind the reader's own policy

*Read; checked by hand.* `security.test.js` runs on the port that sends nginx.conf.example's reader policy,
which alone blocks every request to the other sites, so the "nothing reached another site" checks can't fail.
The common setup (any static server, no such header) isn't tested. The reviewer ran the hostile books without
the reader policy and nothing leaked. **Fix:** also run them on a port without the policy.

### T-15. Test housekeeping

*Reproduced.*
- `scripts.test.js` leaves a `spine-worker-*` folder in the temp directory on every run, and its sandbox folders
  when an assertion fails (no `finally`).
- `run.sh` doesn't notice a server that failed to start, or a port already used by something else, and its wait
  depends on `curl`.
- `server.py` listens on every interface; `127.0.0.1` is enough.

### T-16. Coverage gaps

*Read.* Not tested:
- That the reader sends `If-Range`: the replacement test also passes through the size and checksum checks.
- That `checksums/*.sha256` match each script's `--list` (they do today).
- `TTS_SERVER`, `SPAN_MAX`, `SAVED_AUDIO_MB` eviction, `SEARCH_MAX`, `COMIC_PART`, `BOOKSHELF` from a config,
  and `KEEP_POSITIONS_DAYS: 0`.
- The test server's file types are its own, not nginx.conf.example's.

### T-17. Workflow upkeep

*Read.* `slow.yml` uses Node 20 (end of life since April 2026), `checkout@v4`/`setup-node@v4` (Node 20
runtime), `npm install` rather than `npm ci`, and downloads about 900 MB of models every run without a cache.

### T-19. Two script tests match anywhere in the page

*Reproduced.* The integrity test in `scripts.test.js` checks that each library's file and hash appear somewhere
in `index.html`, so swapped hashes pass (books would then fail to open, which other tests catch). The version
check uses `includes` over the whole page, so a comment counts, and doesn't check `TRANSFORMERS` though the
README says it does. **Fix:** read `LIBS` and the version constants by name.

### T-20. Round 11 test gaps

*Read.*
- Passing over picture pages and then reading a later text chapter isn't tested (it works when tried by hand).
- The M-23 test checks the page shown, not the saved position.
- The M-27 test names port 8790; the T-18 checks run right after loading, so a refused request logged later
  is missed.
- L-75 (giving up on a stalled stream) has no test: it would take a minute of waiting, or a setting for tests.

## Documentation

### D-7. Documentation nits

- `nginx.conf.example` sets `default_type "text/markdown; charset=utf-8"`, so `.md` files probably aren't
  gzipped (`gzip_types` compares the whole type). *Read only.* Use `default_type text/markdown; charset utf-8;
  charset_types text/markdown;`.
- The README's test requirements leave out `unzip` (used by `urls.test.js`) and `curl` (`run.sh`), say Node 20+
  where `--test-concurrency` needs 20.10, and give "about a minute" for what takes about 3.5.
- "Each script also has a `--list` option": `fetch-fonts.sh` has none.
- Kokoro's download is "about 450 MB" in its script and "about 435 MB" in the README (436 MB measured).
- `tools/make-checksums.py` sorts `libs/LICENSES/*` before `libs/jszip.min.js`, unlike the committed list, so
  regenerating with no change still makes a diff.

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

Export chosen chapters as an audiobook in `.m4b` (AAC in MP4, with chapter markers), with any of the natural
voices: Kokoro, Pocket TTS or the server voice. All three return raw samples through the same `generate()` call,
so one export path serves them all; the server is simply the fastest. The device voice can't be exported:
`speechSynthesis` plays straight to the speakers and gives the page no access to the audio.

**Choosing chapters.** An "Export audiobook" dialog lists the chapters with checkboxes, All / None, and
shift-click to select a range.
- Each row shows an estimated length, from the word count (as "time left" does).
- Units follow the table of contents, not the book's files: each entry runs from its heading to the next one,
  since a file can hold several chapters and a chapter can span files.
- Untitled front matter (cover, copyright) starts unticked; everything else starts ticked.
- A summary line updates as you tick, for example "12 chapters · about 6 h 40 min · about 190 MB", with a
  generation-time estimate for the selected voice.

**Output.** Either:
- **one file:** a single `.m4b` with a chapter marker at each chosen chapter, or
- **a file per chapter:** `NN - Title.m4b`, each with the same album, author and cover tags, a track number and
  its own chapter marker, so audiobook apps group them as one book.

Both use AAC at 64 kbps mono (about 29 MB per hour), at 1× speed (players have their own speed control).

**Saving.**
- **One file:** where the browser has a save picker (Chrome, Edge), the file is written to disk as it is
  encoded. Elsewhere the encoded file is kept in memory and downloaded at the end.
- **A file per chapter:** where the browser has a folder picker (Chrome, Edge), each file is written as its
  chapter finishes, so a cancelled run keeps the finished chapters. Elsewhere each file is downloaded
  separately as it finishes (the browser may ask once to allow several downloads). If the browser blocks them,
  a fallback offers the finished files as one ZIP of `.m4b` files (stored, not compressed).

**During the run.**
- A progress bar shows the current chapter and the time remaining, with Pause and Cancel.
- Generated passages go into the saved-audio cache, so a cancelled or interrupted run resumes where it stopped,
  and passages already listened to are reused at once.
- The screen is kept awake (Wake Lock) while exporting.
- Reading aloud is paused for the duration, since both would use the same voice engine.

**Limits.**
- Encoding uses the browser's WebCodecs `AudioEncoder`. The dialog checks for AAC support when it opens. Where
  it's missing (Firefox today, and some Safari versions), the menu item is disabled with a note that export
  needs Chrome, Edge or Safari. There is no fallback format.
- With the device voice selected, the item is disabled with a note that export needs Kokoro, Pocket TTS or the
  server voice.

**Work.**
- A small MP4 writer in `index.html` (AAC frames, Nero-style `chpl` chapters, title, author and cover tags):
  about 300 to 400 lines, no new dependencies.
- The dialog, per-chapter text and the export loop reuse the reader's existing code.
- **Tests:** check the output with `ffprobe` (chapter count, titles, duration), and run one short end-to-end
  export with the server voice.

### E-11. A settings panel
A panel in the page for the options that are now only in `index.html` or `reader-config.json`: look-ahead,
saved-audio limit, remote content, shortcuts and so on.

### E-15. Fixed-layout books

Pre-paginated (fixed-layout) EPUBs are shown reflowed in columns, and `linear="no"` items are read in order with
the rest (which the spec allows). Laying out fixed-layout pages as pages (and optionally skipping non-linear
items) would suit comics-style and picture books.

## Suggested order

1. **T-11:** run the workflow once by hand (Actions → Slow tests → Run workflow).
2. **L-89 and T-19:** the checksum and pinned-version checks.
3. **L-74, L-76, L-79:** small read-aloud and narrow-screen fixes.
4. **T-13 to T-17, D-7:** test and documentation housekeeping.
5. The other low items and the enhancements, as wanted.

## Resolved

From all reviews so far, with the commits that fixed them.

| ID | Title | Fixed in |
|---|---|---|
| H-1 | Remote-content stripping could be bypassed; book pages now get a Content-Security-Policy | `2e5345f` |
| H-2 | Uppercase XHTML tags got past the sanitizer | `2e5345f` |
| H-3 | Empty files broke chapters read with range requests | `c5cfe41` |
| H-4 | Runs of CSS hex escapes (common for CJK font names) froze the page: exponential regex in `plainFunctionNames` (a regression from L-20, found in this review) | `87cd424` |
| H-5 | Unclosed `<base`/`<meta` tags with `= a` pairs froze the page: exponential regex in the pre-parse stripping (a regression from L-24, found in round 4) | `78a8a9e` |
| H-6 | A stylesheet importing itself many times froze the tab (N⁴ copies) | `01c0bdd`, `84bc895` |
| H-7 | Declarative shadow DOM skipped every cleaning step, so a link could navigate the book frame | `160a734` |
| H-8 | Markup reading back differently once serialized (mutation) brought back uncleaned content (round 8 review) | `84bc895` |
| H-9 | A font pasted in as `data:` into every style naming it made pages of hundreds of MB (round 8 review) | `84bc895` |
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
| D-1 | The README overstated the remote-content protection | `2e5345f` |
| D-2 | No web server example for the reader | `2e7a63d` |
| D-3 | No upgrade checklist for pinned versions | `630738a` |
| D-4 | Documentation out of date (voice count, Node version, Markdown library, fetch-script folders, model precision) | `614e88c` |
| D-5 | Inaccurate sentences from D-4 and L-69: the gzip note, which files each fetch script reads, FULL_PRECISION on WebGPU (round 9 review) | `7a86a5f` |
| D-6 | The Caddy example didn't revalidate files (an old library fails a new hash); upgrading needs two fetch runs | `299ded9` |
| E-12 | Hide French from Pocket TTS until it works | `590aab6` |
| E-13 | A quieter read-aloud bar: short voice names (Device, Kokoro, Pocket, Server); the sleep timer off unless `SLEEP_TIMER` | `23100cb` |
| E-14 | The time left in the footer off unless `TIME_LEFT` | `23100cb` |
| E-16 | Default book: `default.epub`, else `default.md` (an ordered `DEFAULT_BOOK` list, with "not found" page checks) | `a29374c` |
