# Code and security review

Review of the repository (2026-11-08, updated after round 6): `index.html` (about 4,400 lines), the fetch
scripts, `tools/make-checksums.py`, `nginx.conf.example`, `.github/workflows/slow.yml` and the test suite in
`tests/`. Open items keep their IDs from earlier versions of this document; new findings are numbered after the
highest earlier ID in each group. Fixed items are listed under [Resolved](#resolved) with their commits.

## Method

Each round fixes the items asked for. An independent reviewer then goes over the round's commits, with the
code and what the changes were for but not the author's conclusions. Each finding is checked again before it
is recorded. *Reproduced* means confirmed in Chromium or Node against the real code; *read* means confirmed
by reading the code only.

- **Round 3** (`7c5c55c` to `630738a`): the review found H-4, an exponential regex. Fixed in `87cd424`.
- **Round 4** (`432deba` to `b834226`): the review found H-5, another exponential regex. Fixed in `78a8a9e`.
- **Round 5** (`48d5993` to `a9c1cce`) fixed L-6 to L-11, L-17, L-29, L-30, L-31, T-3, T-4, T-5 and T-10. Its
  review found:
  - **M-11:** four differences between the new CSS tokenizer and Chromium's that let remote addresses
    through, imported sheets joining into new addresses, and a quadratic rescan. Reproduced in Chromium;
    fixed in `3a98b99`.
  - **M-12:** the loose position record mixed up different books that share a cover page. Reproduced; fixed
    in `5199dda`.
  - **L-32 to L-34:** fixed in `76a92bc`, `f7c6ef9` and `87c0cff`.
  - **What is left:** recorded as L-35 to L-37 and T-11.
- **Round 6** (`23100cb` to `cd29fca`) added E-13 and E-14 and fixed L-35, L-36 and L-37. No independent review
  was run for this round.

**Tests.** All 90 tests pass. Five more need `SLOW=1` (the real Kokoro and Pocket TTS models) or `NETWORK=1`
(the CDNs). The real-model tests passed in this session, after a broken pattern in the Kokoro worker was
caught and fixed. The `NETWORK=1` tests could not be run here, because this machine has no internet access
(see T-11). Each fix in round 5 has a test, and most of those tests were run against the code before the fix
and failed there. The suite now also covers:
- CSS cleaning against every bypass found so far, with each result loaded in Chromium.
- Device voices (with a fake speech engine) and publisher narration (a narrated test book).
- The CDN version of the reader policy, checked offline by answering CDN requests with local copies.
- `lazyZip` run in Node on archives built in memory.

**Labels.** Each item has an ID you can ask for by name (for example, "fix L-18 and T-11").

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

No critical, high or medium items are open. One low item is open, L-18, which is in the server repository.
T-11 is about tests that only the new weekly workflow runs, and that workflow hasn't run yet.

## Open items

| ID | Title | Area |
|---|---|---|
| [L-18](#l-18-tts-server-ports-are-open-to-the-network) | TTS server ports are open to the network (server repo) | Security |
| [T-11](#t-11-the-network-and-model-tests-only-run-weekly) | The network and model tests only run weekly | Tests |
| [E-1](#e-1-footnote-pop-ups) to [E-11](#e-11-a-settings-panel) | Enhancements | — |

## Low

### L-18. TTS server ports are open to the network

*In jskenney/epub-reader-tts-server.* Breeze (port 7860) and the studio (7861) listen on all interfaces, by
choice. Anyone who can reach those ports can use the GPU without a password. The studio also lets them
delete voices and upload files of up to 1 GB.

**Fix:** a firewall rule that allows only the proxy host.

## Tests

### T-11. The network and model tests only run weekly

New.
- **Not run in this session.** The tests that load everything from the CDNs (`NETWORK=1`) couldn't run here:
  there is no internet access. The offline check of the CDN policy did run.
- **Workflow not yet run.** `.github/workflows/slow.yml` runs these tests and the real models weekly and on
  demand, but it hasn't run yet.
- **Scheduled runs can lapse.** GitHub disables scheduled workflows after 60 days without activity in the
  repository.
- **`--strict` isn't run in CI.** A fresh checkout has no font list to check against.

**Fix:** run the workflow once by hand (Actions → Slow tests → Run workflow) and fix anything that fails there.

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

1. **T-11:** run the slow workflow once by hand (Actions → Slow tests → Run workflow).
2. **L-18,** in the server repository, and the enhancements, as wanted.

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
| M-11 | The CSS tokenizer let remote addresses through in four ways (number, final escape, NUL, unclosed url string); imported sheets joined into new addresses; quadratic rescan (round 5 review) | `3a98b99` |
| M-12 | The loose position record mixed up books sharing a title, file names and cover page, and deleted their keys (round 5 review) | `5199dda` |
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
| D-1 | The README overstated the remote-content protection | `2e5345f` |
| D-2 | No web server example for the reader | `2e7a63d` |
| D-3 | No upgrade checklist for pinned versions | `630738a` |
| E-12 | Hide French from Pocket TTS until it works | `590aab6` |
| E-13 | A quieter read-aloud bar: short voice names (Device, Kokoro, Pocket, Server); the sleep timer off unless `SLEEP_TIMER` | `23100cb` |
| E-14 | The time left in the footer off unless `TIME_LEFT` | `23100cb` |
