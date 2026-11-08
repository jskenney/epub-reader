# Code and security review

Review of the repository (2026-11-08, after round 8): `index.html` (about 4,700 lines), the fetch scripts,
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

All of these are in the Resolved table. *Reproduced* means confirmed in Chromium, Node or nginx against the real
code; *read* means confirmed by reading the code only.

**Tests.** All 109 tests pass, as root and (for the scripts) as an unprivileged user. Five more need `SLOW=1` or
`NETWORK=1`. They passed here before the last two fix commits, which don't touch the voice or loading code:
- the real Kokoro and Pocket TTS, self-hosted and from the CDNs under the CDN policy
- libraries and fonts from the CDNs

Most fixes in rounds 7 and 8 have a test, and those tests fail on the code before the fix. Some were checked
by reading only: L-46, L-47 and L-50 to L-53, and the smaller parts of L-55.

**Two mistakes in this session, both repaired.**
- **curl overwritten (T-12).** A test replaced this machine's `/usr/bin/curl` when run as root. That made
  downloads look blocked, which is why earlier versions of this document said there was no internet access.
  The test is fixed, and curl was restored from the package's own copy (checksum checked).
- **Working files overwritten.** While checking the nginx example, the author wrote test files into a review
  folder that linked back into the repository. That overwrote the working `index.html` and
  `libs/jszip.min.js`. No commit was affected: both were restored and checked, and the links were removed.

**Labels.** Each item has an ID you can ask for by name (for example, "fix T-11 and D-4").

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

No critical, high, medium or low items are open from this round's reviews, except the three minor
observations L-68 to L-70. The other open items are:
- **Tests:** T-11 (the weekly workflow hasn't run yet) and T-13 to T-17.
- **Documentation:** D-4.
- **Enhancements.**

## Open items

| ID | Title | Kind |
|---|---|---|
| [L-68](#l-68-the-read-aloud-status-announces-every-download-step) | The read-aloud status announces every download step | Low |
| [L-69](#l-69-nginxconfexample-compressible-files-ignore-range-requests-when-the-browser-accepts-gzip) | nginx.conf.example: compressible files ignore range requests when the browser accepts gzip | Low |
| [L-70](#l-70-looking-up-a-file-that-differs-only-in-case-scans-every-name) | Looking up a file that differs only in case scans every name | Low |
| [T-11](#t-11-the-weekly-workflow-hasnt-run-yet) | The weekly workflow hasn't run yet | Tests |
| [T-13](#t-13-a-self-hosting-test-needs-internet-but-isnt-gated) | A self-hosting test needs internet but isn't gated | Tests |
| [T-14](#t-14-the-hostile-book-tests-only-run-behind-the-readers-own-policy) | The hostile-book tests only run behind the reader's own policy | Tests |
| [T-15](#t-15-test-housekeeping) | Test housekeeping | Tests |
| [T-16](#t-16-coverage-gaps) | Coverage gaps | Tests |
| [T-17](#t-17-workflow-upkeep) | Workflow upkeep | Tests |
| [D-4](#d-4-documentation-out-of-date) | Documentation out of date | Docs |
| [E-1](#e-1-footnote-pop-ups) to [E-11](#e-11-a-settings-panel), [E-15](#e-15-fixed-layout-books) | Enhancements | — |

## Low

### L-68. The read-aloud status announces every download step

*Read* (new). `#ttsStatus` is now a live region (L-54), so a screen reader hears each progress update while a
voice model downloads ("Downloading natural voice… 12%", "13%", …). **Fix:** announce the start and the end, and
update the percentage without announcing it (or every 25%).

### L-69. nginx.conf.example: compressible files ignore range requests when the browser accepts gzip

*Reproduced with nginx 1.24* (unchanged by round 8). nginx serves gzip-eligible types (such as `.wasm`) whole
when compressing, ignoring `Range`. Nothing in the reader asks for ranges of those files, so this only matters
for other clients. **Fix:** leave it, or turn off gzip for files that are fetched by range.

### L-70. Looking up a file that differs only in case scans every name

*Read* (new). `getFile`'s case- and Unicode-insensitive fallback (L-48) compares against every entry name on
each miss: about 4.6 ms per miss in an archive of 20,000 files. **Fix:** build the folded-name map once per
archive.

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

## Documentation

### D-4. Documentation out of date

*Read.*
- README says "the 27 voices" in one place; there are 28.
- `tests/run.sh` says Node 18+; Playwright needs Node 20.
- README says Markdown is loaded from cdnjs; it comes from `libs/` first.
- The fetch scripts' "run it in that folder" leaves out that they work in their own folder and need
  `checksums/` and `index.html` beside them.
- A comment on Pocket TTS in `index.html` says the int8 models are the default; full precision is.

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

### E-15. Fixed-layout books

Pre-paginated (fixed-layout) EPUBs are shown reflowed in columns, and `linear="no"` items are read in order with
the rest (which the spec allows). Laying out fixed-layout pages as pages (and optionally skipping non-linear
items) would suit comics-style and picture books.

## Suggested order

1. **T-11:** run the workflow once by hand.
2. **D-4** and **T-13 to T-17:** documentation and test housekeeping.
3. **L-68 to L-70,** then the enhancements, as wanted.

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
| D-1 | The README overstated the remote-content protection | `2e5345f` |
| D-2 | No web server example for the reader | `2e7a63d` |
| D-3 | No upgrade checklist for pinned versions | `630738a` |
| E-12 | Hide French from Pocket TTS until it works | `590aab6` |
| E-13 | A quieter read-aloud bar: short voice names (Device, Kokoro, Pocket, Server); the sleep timer off unless `SLEEP_TIMER` | `23100cb` |
| E-14 | The time left in the footer off unless `TIME_LEFT` | `23100cb` |
