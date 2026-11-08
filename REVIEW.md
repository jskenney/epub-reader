# Code and security review

Full review of the repository (2026-11-08, round 7): `index.html` (about 4,500 lines), the fetch scripts,
`tools/make-checksums.py`, `nginx.conf.example`, `.github/workflows/slow.yml`, the README and the test suite in
`tests/`. Open items keep their IDs from earlier versions; new findings are numbered after the highest earlier
ID in each group. Fixed items are listed under [Resolved](#resolved) with their commits.

## Method

Rounds 1 to 6 each fixed the items asked for, and most ended with an independent review of that round's
commits (rounds 3 to 5 found H-4, H-5, M-11 and M-12 that way).

Round 7 is a full review of the whole repository, not of recent changes. It was done by four independent
reviewers, one per area:
- the book page pipeline and its security
- opening and reading books, archives and positions
- reading aloud and the interface
- scripts, server configuration, documentation and tests

Each was given the code and the threat model but not the author's conclusions. Each finding was checked again
before it was recorded; the high and medium findings were re-run or re-read by the author. *Reproduced* means
confirmed in Chromium, Node or nginx against the real code; *read* means confirmed by reading the code only. No
code was changed in this round.

**Results:**
- **Two high items:** H-6, a stylesheet that freezes the tab, and H-7, shadow DOM that skips the cleaning.
- **Eight medium items:** M-13 to M-20.
- **Low items:** L-38 to L-59.
- **Test items:** T-12 to T-17. T-12 is urgent: a test replaces the system's `curl` when run as root.
- **Documentation:** D-4.
- **Enhancement:** E-15.

**What held up.** The reviewers confirmed these as sound:
- **The sandbox:** no scripts, forms, downloads or top navigation.
- **Book data and markup:** no HTML sinks for book data in the reader page.
- **The book policy:** placed first, with `<base>` and `<meta http-equiv>` removed before and after parsing.
- **The CSS tokenizer** on every earlier bypass.
- **The in-place ZIP reader's** checks.
- **Position keys and their migration.**
- **The server voice's** host restrictions and retries.
- **Pins, checksums and SRI hashes**, re-generated against upstream.
- **nginx.conf.example's policy and types,** run in nginx 1.24.
- **The README settings table** against the code.

L-18 (the TTS server's open ports) was removed earlier: it belongs to the TTS server's repository. Its ID
isn't reused.

**Tests.** All 90 tests pass (as root; see T-12). Five more need `SLOW=1` or `NETWORK=1`; see T-11 for what ran.

**Labels.** Each item has an ID you can ask for by name (for example, "fix H-6 and T-12").

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

Fix first:
- **H-6:** a book can freeze the tab every time it is opened, with a self-importing stylesheet.
- **H-7:** a book can make a link navigate its frame to another site, with declarative shadow DOM.
- **T-12:** the test suite replaces `curl` when run as root, and fails when run as any other user.

The medium items are:
- **M-13 and M-14:** two more ways around the cleaning. The reader policy contains both.
- **M-15:** a race between opening books.
- **M-16:** pictures held in memory.
- **M-17 and M-18:** two read-aloud bugs, wrong audio and speech after closing the bar.
- **M-19:** a slow document case.
- **M-20:** Pocket TTS doesn't start from the CDNs under the CDN policy.

## Open items

| ID | Title | Kind |
|---|---|---|
| [H-6](#h-6-a-stylesheet-that-imports-itself-many-times-freezes-the-tab) | A stylesheet that imports itself many times freezes the tab | High |
| [H-7](#h-7-declarative-shadow-dom-skips-every-cleaning-step-so-a-link-can-navigate-the-book-frame) | Declarative shadow DOM skips every cleaning step, so a link can navigate the book frame | High |
| [M-13](#m-13-a-pasted-in-import-can-close-a-style-in-the-chapter-body-and-add-uncleaned-markup) | A pasted-in import can close a `<style>` in the chapter body and add uncleaned markup | Medium |
| [M-14](#m-14-encoded-slashes-in-a-documents-or-folder-books-paths-make-the-reader-page-fetch-from-other-sites) | Encoded slashes in a document's or folder book's paths make the reader page fetch from other sites | Medium |
| [M-15](#m-15-a-book-that-finishes-loading-late-replaces-the-one-opened-afterwards) | A book that finishes loading late replaces the one opened afterwards | Medium |
| [M-16](#m-16-pictures-in-epubs-stay-in-memory-until-the-book-is-closed) | Pictures in EPUBs stay in memory until the book is closed | Medium |
| [M-17](#m-17-publisher-narration-can-play-the-previous-books-recording) | Publisher narration can play the previous book's recording | Medium |
| [M-18](#m-18-reading-aloud-can-carry-on-after-the-bar-is-closed) | Reading aloud can carry on after the bar is closed | Medium |
| [M-19](#m-19-many-identical-headings-make-a-document-take-seconds-to-open) | Many identical headings make a document take seconds to open | Medium |
| [M-20](#m-20-pocket-tts-from-the-cdns-doesnt-start-under-the-cdn-version-of-the-reader-policy) | Pocket TTS from the CDNs doesn't start under the CDN version of the reader policy | Medium |
| [L-38](#l-38-middle-click-gets-around-allow_external_links-internal-links-middle-click-to-broken-pages) | Middle-click gets around ALLOW_EXTERNAL_LINKS; internal links middle-click to broken pages | Low |
| [L-39](#l-39-a--fragment-link-stops-an-html-or-markdown-document-opening) | A `#…%` fragment link stops an HTML or Markdown document opening | Low |
| [L-40](#l-40-some-legitimate-content-is-lost-or-not-localized) | Some legitimate content is lost or not localized | Low |
| [L-41](#l-41-text-documents-with-long-runs-of-trailing-spaces-can-be-slow-outside-chromium) | Text documents with long runs of trailing spaces can be slow outside Chromium | Low |
| [L-42](#l-42-a-compressed-file-with-extra-bytes-after-its-data-cant-be-read) | A compressed file with extra bytes after its data can't be read | Low |
| [L-43](#l-43-a-stray--in-a-file-name-drops-that-chapter-when-a-folder-in-its-path-has-a-space) | A stray `%` in a file name drops that chapter when a folder in its path has a space | Low |
| [L-44](#l-44-a-package-path-with-a-leading-slash-doesnt-open) | A package path with a leading slash doesn't open | Low |
| [L-45](#l-45-search-misses-words-with-soft-hyphens-zero-width-spaces-or-ligatures) | Search misses words with soft hyphens, zero-width spaces or ligatures | Low |
| [L-46](#l-46-blob-urls-made-after-a-book-is-closed-are-never-revoked) | Blob URLs made after a book is closed are never revoked | Low |
| [L-47](#l-47-a-gzip-encoded-reply-to-the-range-probe-aborts-the-book-attempt) | A gzip-encoded reply to the range probe aborts the `?book=` attempt | Low |
| [L-48](#l-48-paths-differing-only-in-case-or-unicode-form-break-links-or-drop-chapters) | Paths differing only in case or Unicode form break links or drop chapters | Low |
| [L-49](#l-49-clicking-a-picture-only-page-while-paused-jumps-to-the-next-chapter) | Clicking a picture-only page while paused jumps to the next chapter | Low |
| [L-50](#l-50-natural-voice-audio-can-be-saved-under-the-wrong-speed-or-voice) | Natural-voice audio can be saved under the wrong speed or voice | Low |
| [L-51](#l-51-kokoro-leaks-audio-blob-urls-for-cancelled-passages) | Kokoro leaks audio blob URLs for cancelled passages | Low |
| [L-52](#l-52-the-sleep-timer-overruns-by-up-to-a-minute-with-publisher-narration) | The sleep timer overruns by up to a minute with publisher narration | Low |
| [L-53](#l-53-a-crashed-kokoro-worker-or-a-silent-voice-server-leaves-reading-stuck) | A crashed Kokoro worker or a silent voice server leaves reading stuck | Low |
| [L-54](#l-54-accessibility-errors-arent-announced-focus-is-lost-space-does-two-things) | Accessibility: errors aren't announced, focus is lost, Space does two things | Low |
| [L-55](#l-55-settings-and-read-aloud-details) | Settings and read-aloud details | Low |
| [L-56](#l-56-nginxconfexample-caching-can-keep-an-old-indexhtml-or-old-libraries-that-fail-their-new-hashes) | nginx.conf.example: caching can keep an old index.html, or old libraries that fail their new hashes | Low |
| [L-57](#l-57-nginxconfexample-a-regex-location-elsewhere-can-take-over-reader) | nginx.conf.example: a regex location elsewhere can take over `/reader/` | Low |
| [L-58](#l-58-fetch-scripts-a-stale-partial-download-can-block-or-spoil-later-runs) | Fetch scripts: a stale partial download can block or spoil later runs | Low |
| [L-59](#l-59-fetch-script-nits) | Fetch-script nits | Low |
| [T-11](#t-11-the-model-and-cdn-tests-only-run-weekly-and-the-workflow-hasnt-run) | The model and CDN tests only run weekly, and the workflow hasn't run | Tests |
| [T-12](#t-12-a-test-overwrites-the-systems-curl-when-run-as-root-urgent) | A test overwrites the system's `curl` when run as root (urgent) | Tests |
| [T-13](#t-13-a-self-hosting-test-needs-internet-but-isnt-gated) | A self-hosting test needs internet but isn't gated | Tests |
| [T-14](#t-14-the-hostile-book-tests-only-run-behind-the-readers-own-policy) | The hostile-book tests only run behind the reader's own policy | Tests |
| [T-15](#t-15-test-housekeeping) | Test housekeeping | Tests |
| [T-16](#t-16-coverage-gaps) | Coverage gaps | Tests |
| [T-17](#t-17-workflow-upkeep) | Workflow upkeep | Tests |
| [D-4](#d-4-documentation-out-of-date) | Documentation out of date | Docs |
| [E-1](#e-1-footnote-pop-ups) to [E-11](#e-11-a-settings-panel), [E-15](#e-15-fixed-layout-books) | Enhancements | — |

## High

### H-6. A stylesheet that imports itself many times freezes the tab

*Reproduced* in Chromium and in Node against the real code. `rewriteCss` pastes local `@import`s in up to 4
levels deep. It has no check for repeats or cycles and no size limit.
- **Scenario:** a 1.5 KB `a.css` with 30 lines of `@import "a.css";` makes N⁴ copies of itself.
  - With 20 lines, the tab froze for 13 s and built a 171 MB page.
  - With 30 lines, it froze for 52 s and then failed with "Invalid string length".
  - With 10 lines, Node built 11 MB from that 1 KB sheet.
- **Every reopen:** the position is saved, so the book freezes the tab again each time it is opened.
- **Not only cycles:** the same works without a cycle (a→b→c→d, each imported 30 times), and with thousands of
  `<link>`s to one large sheet.

**Fix:**
- Skip an import already on the chain of sheets being pasted (browsers ignore cyclic imports).
- Set a page budget (for example 100 pasted sheets or a few MB of CSS), after which imports are dropped.
- Cache each sheet's cleaned text per page.

### H-7. Declarative shadow DOM skips every cleaning step, so a link can navigate the book frame

*Reproduced* in Chromium.
- **Cause:** the parser keeps `<template shadowrootmode="open">` as an inert template, and the cleaning
  (`sanitize`, `stripRemote`, `localize`, `markLinks`) never looks inside `template.content`. The frame's
  parser then turns the template into a live shadow root, uncleaned.
- **Effect:** the click handler sees the shadow host, not the link, so it doesn't stop the click. A plain
  `<a href="https://other.site/">` inside the shadow root navigates the book frame to that site, inside the
  reader's window. That works even with `ALLOW_EXTERNAL_LINKS` off, and `target=_blank` links open too.
- **Where it applies:** works from XHTML chapters as well as HTML and Markdown.
- **What still holds:**
  - Scripts don't run (the sandbox has no `allow-scripts`).
  - Remote fetches from inside the shadow root are still blocked by the book policy.
  - Under nginx.conf.example's reader policy (`frame-src 'self'`), the frame goes to an error page instead of
    the other site, so it's medium there. A same-site address would still load.

**Fix:** remove `<template>` elements in `sanitize` (or strip `shadowrootmode`/`shadowroot` from every
template, including nested ones), and stop middle-clicks too (see L-38).

## Medium

### M-13. A pasted-in import can close a `<style>` in the chapter body and add uncleaned markup

*Reproduced* in Chromium. Body `<style>` text is rewritten after the chapter has been cleaned. If an imported
sheet contains `</style>`, the frame's parser ends the style there, and whatever follows is parsed as markup
nothing has cleaned.
- **Observed:** an injected `<a target=_blank>` opened another site despite `ALLOW_EXTERNAL_LINKS` off; any
  element or attribute gets past the cleaning.
- **Contained:** scripts and meta refresh are still refused by the sandbox, and remote images by the book policy.
- **Not affected:** SVG `<style>`, which is escaped on output.

**Fix:** rewrite body styles before the cleaning (or clean again after), and at least write `</style` as
`<\/style` in rewritten text.

### M-14. Encoded slashes in a document's or folder book's paths make the reader page fetch from other sites

*Reproduced* in Chromium.
- **Cause:** `resolve` decodes `%2F` after the path has been normalized, so `%2F%2Fevil.example%2Fx.css` becomes
  `//evil.example/x.css`. For HTML or Markdown documents with a base, and for extracted EPUB folders,
  `dirSource` then fetches that from the reader page itself (stylesheets and `@import`s).
- **Escaping the folder:** `a%2F..%2F..` climbs out of the book's folder to any same-site path.
- **Observed:** with remote content off and no reader policy, Chromium requested the other site. The
  nginx.conf.example policy (`connect-src 'self'`) blocks it.

**Fix:** in `resolve`, refuse results with empty segments, `..`, a leading `/` or a backslash. In `dirSource`,
check that every address starts with the book's folder.

### M-15. A book that finishes loading late replaces the one opened afterwards

*Reproduced.* Nothing marks which open is the newest, so whichever finishes last is shown.
- **Scenario:** open a slow `?book=` link, then upload a text file. The text file shows, and two seconds later
  the slow book replaces it.
- **Same cause:**
  - A failing `?book=` link falls back to `default.epub` over a book uploaded meanwhile.
  - Two quick drops can finish out of order.

**Fix:** an open counter, increased by every open (file, link, default, sample) and checked in `startBook`,
which disposes a stale result.

### M-16. Pictures in EPUBs stay in memory until the book is closed

*Reproduced.* `resourceURL` keeps every picture's blob URL for the life of the book; only comics release
theirs.
- **Measured:** 30 chapters each with a 2 MB picture kept 60 MB.
- **Worse case:** a fixed-layout manga EPUB (one picture per page, often hundreds of MB) keeps every page shown.

**Fix:** release pictures used only by chapters other than the current one and its neighbours, as comics do.

### M-17. Publisher narration can play the previous book's recording

*Reproduced.* The narration `<audio>` element is shared for the life of the page, and it remembers the last
audio file's path, not which book it came from.
- **Scenario:** play narrated book A, then open narrated book B with the same audio path
  (`audio/ch1.mp3` is common). B plays A's recording.
- **Also:** after an audio file fails to load, later attempts on it fail too.

**Fix:** forget the audio element's source when a book opens and on errors.

### M-18. Reading aloud can carry on after the bar is closed

*Reproduced.* `ttsReadHere` waits for the voice server's health check (up to 5 s) and the narration file, then
starts reading without checking that the bar is still open.
- **Scenario:** with the server voice chosen and the server hanging, press R, then close the bar. When the check
  fails, the device voice reads with no bar.
- **No way to stop it:** Space and the media keys can't stop it; only reopening the bar does.
- **Smaller effects:** `ttsTogglePlay` and `ttsSetEngine` can leave a highlight behind the same way.

**Fix:** check that the bar is open (or a token is unchanged) after every wait.

### M-19. Many identical headings make a document take seconds to open

*Reproduced.* Heading ids are made unique by counting up from 1 for each repeat, which is quadratic.
- **Measured:** a 40 KB Markdown file of 20,000 `# a` headings took 20 s to open. With unique headings it took
  1.6 s.

**Fix:** remember the next number for each heading text.

### M-20. Pocket TTS from the CDNs doesn't start under the CDN version of the reader policy

*Reproduced* with `SLOW=1 NETWORK=1`. Pocket's worker starts from a blob that imports
`https://cdn.jsdelivr.net/npm/pocket-tts-js@0.1.0/src/worker.js` with a static `import`. Chromium checks that
against `worker-src 'self' blob:`, which doesn't list the CDN, and blocks it: "the worker failed to start".
Kokoro's worker uses a dynamic `import()`, which `script-src` (with the CDN) allows, and it works. Sites
that self-host Pocket TTS, or send no reader policy, aren't affected.

**Fix:** load Pocket's worker code with a dynamic `import()`, as Kokoro does, or add `https://cdn.jsdelivr.net`
to `worker-src` in the CDN policy. The CDN test (`cdn.test.js`) already catches this when run with
`SLOW=1 NETWORK=1`.

## Low

### L-38. Middle-click gets around ALLOW_EXTERNAL_LINKS; internal links middle-click to broken pages

*Reproduced.* `urlText` strips only tabs and newlines, but browsers also strip other control characters.
`href="&#1;http://other.site/"` is taken for an in-book link and keeps its address: a left click is handled,
but a middle click or "open in new tab" opens the other site. Middle-clicking a real in-book link opens a
broken address on the reader's site.

**Fix:** strip all control characters and spaces at the ends; rewrite in-book links to `#…` (keeping their
data attributes); stop middle-clicks on links.

### L-39. A `#…%` fragment link stops an HTML or Markdown document opening

*Reproduced* by two reviewers. `openDocument` decodes link fragments without a fallback, so
`<a href="#50%">` gives "couldn't be opened: URI malformed". **Fix:** `safeDecode`, as `fragOf` does.

### L-40. Some legitimate content is lost or not localized

*Verified in Chromium.*
- **Object fallbacks:** `<object>` is removed together with its fallback content, so EPUB 3's
  `<object data="x.svg"><img src="x.png"/></object>` shows nothing. Unwrap it instead: the policy blocks the
  object itself.
- **Not localized:** `<table background>`, SVG `<use href="sprite.svg#id">`, `<feImage>`,
  `<input type=image>` and SVG `fill`/`filter`/`mask` attributes with `url()` request reader-site addresses,
  which the book policy refuses.

### L-41. Text documents with long runs of trailing spaces can be slow outside Chromium

*Node only.* `textToHtml`'s `/\s+$/` is quadratic in V8's normal regex engine (80,000 spaces took 2.2 s in
Node); Chromium's linear fallback handled a 300 KB case instantly. Firefox and Safari untested. **Fix:**
`trimEnd()`.

### L-42. A compressed file with extra bytes after its data can't be read

*Reproduced.* Chromium's `DecompressionStream` rejects junk after the end of compressed data, while JSZip and
Python's zipfile ignore it. The error comes when the file is read, so there is no fallback, and the JSZip path
uses the same inflate. **Fix:** accept the output when the error comes after exactly the declared size (the
checksum still checks it).

### L-43. A stray `%` in a file name drops that chapter when a folder in its path has a space

*Reproduced.* `resolve('My Book/content.opf', '100%.html')` gives `My%20Book/100%.html`, which isn't found,
so the chapter silently leaves the spine. **Fix:** treat a `%` not followed by two hex digits as a literal
(`%25`), or decode each segment separately.

### L-44. A package path with a leading slash doesn't open

*Reproduced.* `container.xml` with `full-path="/OEBPS/content.opf"` gives "the package file … is missing".
**Fix:** strip leading slashes there and in `getFile`.

### L-45. Search misses words with soft hyphens, zero-width spaces or ligatures

*Reproduced in Node.* "hyphen&amp;shy;ation" doesn't match "hyphenation", nor "ﬁnd" "find"; many typeset EPUBs
(German and Dutch especially) are full of soft hyphens. **Fix:** allow those characters between query
characters in the search pattern, or fold them out with an offset map.

### L-46. Blob URLs made after a book is closed are never revoked

*Read.* A chapter render or cover icon of the previous book still running when the next opens adds its blob
URL after the list was cleared. **Fix:** a disposed flag that revokes at once.

### L-47. A gzip-encoded reply to the range probe aborts the `?book=` attempt

*Read.* Decoding the 4-byte probe isn't guarded, so a server that compresses the whole file and serves ranges
of the compressed bytes skips the other candidates and the whole-file fallback. **Fix:** catch it and fetch
the whole file.

### L-48. Paths differing only in case or Unicode form break links or drop chapters

*Read.* Reads fall back to a case-insensitive match, but links, the spine and the contents compare exactly: a
link to `chapter1.xhtml` when the manifest says `Chapter1.xhtml` is "not part of the reading order", and
NFD file names (archives made on macOS) against an NFC manifest leave the spine silently. **Fix:** normalize
(NFC, plus a case-folded lookup) wherever paths are compared.

### L-49. Clicking a picture-only page while paused jumps to the next chapter

*Reproduced.* A click with no text after it makes `ttsGo` treat it as the end of the chapter even when nothing
is playing (the sample's cover went from section 1 to 2), and leaves a flag set that makes the next chapter
start reading from its top. **Fix:** do nothing past the end when not speaking; reset the flag.

### L-50. Natural-voice audio can be saved under the wrong speed or voice

*Reproduced for Kokoro's speed.* The saved-audio key is computed when a passage is queued, but the voice and
speed are read when it is made. Changing either while a passage waits (paused, so nothing cancels it) saves
1.2× audio under the 1.0× key, which then plays wrongly whenever that passage is read at 1.0×. **Fix:** take
the settings once per passage and use them for both the key and the generation.

### L-51. Kokoro leaks audio blob URLs for cancelled passages

*Reproduced (count).* A Kokoro generation can't be interrupted; when one finishes after its passage was
cancelled, its blob URL is still created and nothing revokes it (about 1 MB per jump while Kokoro works).
**Fix:** check for cancellation after generating, before creating the URL.

### L-52. The sleep timer overruns by up to a minute with publisher narration

*Reproduced* (the timer is off by default). Consecutive clips of one audio file advance without checking the
timer, so only the one-minute fallback stops it. **Fix:** check the timer before moving to the next clip.

### L-53. A crashed Kokoro worker or a silent voice server leaves reading stuck

*Read.* If the Kokoro worker dies after loading, its pending passages never settle and it is never reloaded;
the server voice's request has no timeout, so a server that never answers leaves "Preparing voice…" forever.
**Fix:** on a worker error, fail pending passages and reset the engine; add a time limit for the first bytes
from the server.

### L-54. Accessibility: errors aren't announced, focus is lost, Space does two things

*Verified in Chromium.*
- `#notice` and `#ttsStatus` aren't live regions, so errors ("voice server isn't responding", "Natural voice
  failed") and the download prompt aren't announced. **Fix:** `role="alert"` and `role="status"`.
- Focus falls to the page when a focused button hides itself (Close, Back to reading, Download). **Fix:** move
  focus to the read-aloud button or Play.
- With the bar open, Space on the Open control (a label acting as a button) or on a `<summary>` also pauses
  reading, and the summary can't be opened with Space. **Fix:** leave Space to any focused control.

### L-55. Settings and read-aloud details

*Read.*
- `fontSize` in reader-config.json accepts 60–250, but the A−/A+ buttons clamp to 70–200, so a config of 250
  makes A+ shrink the text; `lineSpacing` 3 quietly becomes 2.6.
- Numbers aren't checked to be finite (`1e999` is Infinity): `NCACHE_SEC` Infinity never trims, `LOOKAHEAD_SEC`
  Infinity prepares 5 chapters ahead, and `LOOKAHEAD_SEC` above `NCACHE_SEC` can revoke the clip being played.
- `SAVED_AUDIO_MB: 0` still keeps up to 9 clips per session.
- Narration resumed after a pause restarts its clip from the beginning.
- If the saved engine is unusable now, the menu shows Device, and choosing Device saves nothing.
- The server voice's saved audio doesn't depend on `TTS_SERVER.api`, so it is reused after moving servers.

### L-56. nginx.conf.example: caching can keep an old index.html, or old libraries that fail their new hashes

*Reproduced with nginx 1.24.* index.html gets no `Cache-Control`, so browsers cache it heuristically (the
comment says changes show up at once). `libs/`, `fonts/`, `kokoro/` and `pocket/` get 30 days without
revalidation: after a library upgrade, a returning visitor's cached old `jszip.min.js` fails the new hash, and
with `ALLOW_CDN` off no book opens for up to 30 days. **Fix:** `Cache-Control: no-cache` for index.html (re-adding
the policy headers in that location), revalidation for the libraries, and a note in the upgrade checklist.

### L-57. nginx.conf.example: a regex location elsewhere can take over `/reader/`

*Read.* `location /reader/` is a plain prefix, so a regex location in the same server (for example for
`\.(js|css|html)$`) wins and drops the policy and types. **Fix:** `location ^~ /reader/`, and note that other
folders with a linked `index.html` need the same headers.

### L-58. Fetch scripts: a stale partial download can block or spoil later runs

*Reproduced with real curl.* An existing `.part` is always resumed: on a server that ignores ranges curl fails
("cannot resume") and the `.part` stays, so every rerun fails; after a version change, an old `.part` is
resumed into a mixed file (the checksum catches it, but the run must be repeated). **Fix:** drop the `.part`
on that error, and don't resume across a pin change.

### L-59. Fetch-script nits

*Read.* `fetch-fonts.sh` builds local paths from Google's stylesheet without refusing `..` (it trusts TLS and
Google); `fetch-pocket.sh` expands `all` only as the first language.

## Tests

### T-11. The model and CDN tests only run weekly, and the workflow hasn't run

Updated.
- **The `NETWORK=1` tests do run here.** An earlier version of this document said there was no internet
  access. That was wrong: T-12 had replaced this machine's `curl`, which made downloads look blocked. Run here
  with `NETWORK=1`, the libraries and fonts load from the real CDNs under the CDN policy and pass.
- **With `SLOW=1 NETWORK=1`:** Kokoro loaded entirely from the CDNs and spoke under the CDN policy. Pocket TTS
  didn't start; that's M-20, found this way.
- **The workflow hasn't run yet, and will fail on GitHub until T-12 is fixed:** the runner isn't root, so the
  test that overwrites `curl` fails there.
- **Scheduled runs can lapse:** GitHub disables scheduled workflows after 60 days without activity.

### T-12. A test overwrites the system's `curl` when run as root (urgent)

*Reproduced: it happened on this machine.* `pathWithoutHashTools()` in `tests/scripts.test.js` fills a folder
with symlinks to every command in `/usr/bin` and `/bin`, and the checksum test then writes a stub `curl`
(`exit 7`) into that folder, which writes through the symlink.
- **As root** (containers, this machine): the real `/usr/bin/curl` is replaced, and every later download
  fails, including the fetch scripts and `run.sh`'s server wait.
- **As another user** (a GitHub runner, macOS): the write is refused and the test fails.

**Fix:** remove the link before writing (or build a separate folder of stubs), for `curl` and `sha256sum`.
Restore curl on affected machines (`apt-get install --reinstall curl`).

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

1. **T-12,** and restore `curl` wherever the suite ran as root. Then **T-11:** run the workflow once by hand.
2. **H-6 and H-7,** with tests in the hostile book.
3. **M-13 and M-14** (the cleaning), then **M-15 to M-20.**
4. **L-38 to L-48:** content and loading details.
5. **L-49 to L-55:** read-aloud and settings details.
6. **L-56 to L-59, T-13 to T-17, D-4:** server example, scripts, tests and docs.
7. The enhancements, as wanted.

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
