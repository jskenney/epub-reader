# Code and security review

Second review of the repository (2026-11-08): `index.html` (about 3,800 lines), `fetch-libs.sh`,
`fetch-fonts.sh`, `fetch-kokoro.sh`, `fetch-pocket.sh`, `tools/make-checksums.py` and the test suite in
`tests/`. It follows the first review and the changes made in response to it (commits `6832de6` and
`efa4068`). No code was changed as part of this review.

**Method.** The code was read twice: once by the author of the recent changes and once by an independent
reviewer who was given the code but not those conclusions. Findings marked *reproduced* were confirmed in
Chromium against the real `index.html`, using hostile test books served by `tests/server.py`. The rest
were confirmed by reading the code. The test suite (`tests/run.sh`) passed three times in a row: 31 tests,
with 2 more (real Kokoro and Pocket TTS) passing under `SLOW=1`.

## Summary

The reader is in good shape:
- No way was found for a book, `voices.json`, `reader-config.json` or the address to run script in the
  reader's own page or escape the sandboxed book frame.
- The bugs from the first review are fixed, with tests.
- Self-hosting and integrity checks work. With the fetch scripts run, a test confirms nothing is loaded
  from other sites.

The main new finding is that the remote-content stripping added in this round can be bypassed in several
ways (finding 1). It removes known-bad patterns, and some patterns are missed. A book can therefore still
contact another site, which is a privacy leak, not code execution. A Content-Security-Policy on the book
frame would close this whole class of problem at once. That was security item 2 of the first review and is
still the most valuable change to make. Finding 2 is a small bug that leaves the reader stuck on a
malformed link.

## Status of the first review

| First review item | Status |
|---|---|
| 1a. Self-hosted voices fail on soft-404 sites | **Fixed.** `realFile()` checks what came back. Tested, including with real models. |
| 1b. `?book=` gives up instead of trying `/bookshelf/` on soft-404 sites | **Fixed** for EPUB, CBZ, folders, text and Markdown. HTML documents are only partly covered; see finding 3. |
| Security 1. CDN code without integrity checks | **Fixed** for JSZip and marked (SRI on local and CDN copies). Voice code can't use SRI (dynamic imports and workers); this is mitigated by the fetch scripts' checksums and `ALLOW_CDN = false`. |
| Security 2. No Content-Security-Policy | **Open.** Now the recommended fix for finding 1. |
| Security 3. Books can contact other sites | **Partly fixed.** `ALLOW_REMOTE_CONTENT` covers the common cases but can be bypassed; see finding 1. |
| Security 4. SVG and image-map links navigate the frame | **Fixed.** All links are handled, and clicks can't navigate the frame. Tested. |
| Security 5. Google Fonts on every load | **Fixed.** `fetch-fonts.sh` and local-first fonts. |
| Security 6. `TTS_SERVER` hard-coded; `svRef` follows any URL in `voices.json` | **Partly.** `TTS_SERVER` can now be set in a config file. `svRef` still follows absolute URLs. |
| Security 7. Breeze and studio ports open to the network (server repo) | **Open** (outside this repository). |
| Large comics fill memory | **Fixed.** Other sections' images are released. Tested. |
| Kokoro model not pinned | **Fixed.** The worker redirects to a pinned revision, and `fetch-kokoro.sh` uses the same one. Tested. |
| Fetch scripts don't verify downloads | **Fixed.** `checksums/*.sha256` for 118 files; bad files are removed. Tested by tampering. |
| Whole book file held in memory | Open (documented behaviour). |
| Positions shared by books without an ID and with the same title | Open. |
| `openFromUrl` falls back to the sample, not `default.epub` | Open. |
| Server voice cache key depends on field order | Open. |
| Single-letter shortcuts clash with screen readers | Open. |
| Enhancements: per-folder config, `fetch-libs.sh`, listening features, test suite | **Done.** |

## Findings

Ranked by importance. *Reproduced* means confirmed in the browser.

### 1. Remote-content stripping can be bypassed (privacy; reproduced)

With `ALLOW_REMOTE_CONTENT = false` (the default), a test book still made requests to another site in six
ways:

- **Protocol-relative and backslash URLs:** `<img src="//host/x">` and `/\host/x`. `isExternal()`
  (`index.html` ~419) only recognises a scheme, so these are treated as paths inside the book. Nothing is
  found, the attribute is left alone, and the frame (which inherits the reader's base URL) fetches
  `https://host/x`.
- **A tab or newline inside the scheme:** `src="ht&#9;tp://host/x"`. The regex fails, but the browser's
  URL parser removes the tab. The same trick defeats the `^\s*javascript:` check in `sanitize()`; scripts
  still can't run there, because the frame has no `allow-scripts`.
- **Uppercase element and attribute names in XHTML chapters:** `<IMG SRC=…>`. Chapters are parsed as XML,
  which keeps the case. The HTML-document selectors and `getAttribute()` calls in `sanitize()`,
  `stripRemote()` and `localize()` don't match them, but serialising for `srcdoc` turns them into working
  lowercase elements. This also lets an uppercase `<IFRAME>`, `<BASE href>` or `<META http-equiv="refresh">`
  through. Scripts still can't run, but a `<base>` redirects every relative URL in the chapter, and a meta
  refresh can reload the frame with another page. If `allow-scripts` were ever added, this would become
  script execution.
- **CSS forms the regexes don't cover:**
  - `URL(…)` in upper case.
  - `image-set("https://…" 1x)`, which uses a plain string with no `url()`.
  - `@import"…"` with no space, plus `@IMPORT` and `@import/**/"…"`.
  - Escapes such as `url(\68ttps://…)`.
  - An inline `style="…URL(…)"`, which the case-sensitive `[style*="url("]` selector never reaches.
- **Relative URLs not in the book** (`<img src="missing.png">`) are left as they are. They resolve against
  the reader's own site, so a book can make GET requests to any path there. This is the same site, not a
  privacy leak, but unexpected.
- **SVG animation** (`<set attributeName="href" to="https://…"/>`) could set a remote address after the
  static attributes were checked. Not reproduced.

**Fix.** Stop chasing patterns:
- Put a CSP `<meta http-equiv="Content-Security-Policy">` first in the `<head>` that `buildPage()` writes
  when `ALLOW_REMOTE_CONTENT` is off. For example: `default-src 'none'; img-src data: blob:; media-src blob:;
  style-src 'unsafe-inline' <fonts origin>; font-src data: blob: <fonts origin>`, plus the book's folder
  origin for books opened from a folder. The browser then refuses every vector above, including ones not
  listed.
- Also lowercase names when copying XHTML into the page (or serialise through an HTML document before
  sanitizing).
- Treat any value that resolves to a different origin as remote: `new URL(v, base).origin !==
  location.origin`.
- Remove relative references that aren't found in the book.

The hostile-book test (`tests/security.test.js`) should gain these vectors and assert that `page.blocked`
is empty as well as checking the logging server. See finding 9.

### 2. `?book=` containing `%` leaves the reader stuck on "Loading…" (reproduced)

In `openFromUrl()` (~3777), `decodeURIComponent()` runs before the `try`. `URLSearchParams` has already
decoded the value once, so `?book=50%25off.epub` becomes `50%off.epub`, and decoding again throws. The
error escapes the start block: no book, no sample and no message. The double decoding also turns `a%2520b`
into `a b`.

**Fix:** drop the second decode, or move it inside the `try`.

### 3. The "not found" check for HTML documents only works for identical pages

For `?book=…html`, a candidate is rejected only if its text exactly matches one probe for a random missing
file, and that probe result is cached once for the whole session (`soft404()`, ~471). Many real "not found"
pages include the requested path, a time or a request ID. Such a page then opens as the document, and the
`/bookshelf/` location is never tried. The test server's soft-404 page is always the same text, so the
tests can't catch this.

**Fix:** compare after removing the requested path and normalising whitespace, keep the probe per folder,
and add a test server mode whose page includes the path. EPUB, CBZ, folders and text/Markdown are not
affected; they have structural checks.

### 4. Sleep timer can stop right after resuming

If reading is paused while the timer shows "Stopping after this passage" (the time is up but the passage
hasn't ended), `sleep.due` stays set:
- Pressing play more than a minute later hits the "a very long passage: stop now" branch of the ticker,
  and reading stops within a second.
- Pressing play sooner stops it after one passage.

**Fix:** clear `sleep.due`, or turn the timer off, when reading is paused or stopped.

### 5. `fetch-fonts.sh` fails on macOS

`sed -E "s/…/\1\t\2/"` relies on GNU sed reading `\t` as a tab. BSD/macOS sed writes a `t`. The id/spec
split then fails, the script asks Google for an empty family, and `curl -f` aborts it.

**Fix:** use `awk` or `printf`, or a literal tab via `$'\t'`.

### 6. Fetch script verification details

- **`verify()` fails open:** with neither `sha256sum` nor `shasum` it only warns and the script still
  reports "Done". macOS has `shasum`, so this mainly matters on minimal Linux images.
- **The "no pinned checksum" note uses a substring match** (`grep -qF "  $path"`), so `libs/a.js` counts
  as pinned if `libs/a.js.map` is listed. It is only a note, but anchoring it would be more accurate.
- **Flag order matters:** `--list` is only recognised as the first argument (`fetch-pocket.sh --int8
  --list` fails).
- **`fetch-fonts.sh` is trust-on-first-use by design:** a changed font file is reported and fetched
  again, but the run doesn't fail.

### 7. Smaller robustness issues

- **Kokoro's local-first fetch shim is weaker than `realFile()`:** it rejects only `text/html` replies. A
  "not found" reply with another content type would be handed to the model loader instead of falling back
  to the pinned CDN revision. The worker's blob URL is also never revoked, a tiny leak per load attempt.
- **Reading-pace state isn't reset when a new book opens** (`pace.lastTurn`, `pace.samples`). The first
  page turn may be paired with the previous book's timestamp. The bounds checks filter out most of this.
- **`zipSource`'s list of blob URLs keeps growing** as comic sections are revisited. The URLs are revoked
  but stay in the array until the book closes.
- **A book element with `id="spine-end"`** comes before the reader's own end marker, so `geom()` would
  count pages wrongly. Use an unguessable id or keep a direct reference.
- **The French Pocket TTS bundle has no `voices.bin`** at the pinned revision (upstream). `fetch-pocket.sh`
  now skips it rather than failing, but French Pocket TTS probably can't speak with built-in voices. This
  wasn't confirmed, because the 1.25 GB model couldn't be downloaded for testing. Consider hiding French
  from Pocket TTS until upstream adds the voices.

### 8. Still open from the first review

- **CSP:** see finding 1.
- **`svRef`:** restrict voice clip URLs to the voices folder.
- **Books without an ID:** key positions by the file's identity, not only the title.
- **Fallback after a bad `?book=`:** fall back to `default.epub` before the sample.
- **Voice cache key:** fingerprint only `ref_audio`, `ref_text`, `seed` and `cfg_scale`.
- **Shortcuts:** offer a setting to turn off the single-letter shortcuts.
- **Server ports** (server repo): restrict them with a firewall rule.

### 9. Test suite

The suite is useful and stable. It ran three times without a failure, blocks every other site, and covers
the main features. Gaps:
- **The hostile-book test** only checks the logging server, not `page.blocked`, and has none of finding 1's
  vectors. It also uses a fixed 1.5 s wait.
- **The soft-404 server** always returns the same page (finding 3).
- **Device voices** (Web Speech) and publisher narration (Media Overlays) have no committed tests. They
  were tested by hand earlier.
- **Real Kokoro and Pocket TTS** run only with `SLOW=1` and after their fetch scripts.

## Enhancement opportunities

Not yet built, from the earlier suggestions:
- **Reading:** footnote pop-ups, image zoom, bookmarks and highlights with notes, dictionary lookup, and
  more themes (sepia, true black).
- **Library and devices:** a bookshelf page with covers and progress, syncing positions through your
  server, and installing as an offline app (PWA).
- **Comics:** right-to-left (manga) page order.
- **Audio:** audiobook export through the server (deferred).
- **Settings:** a settings panel in the page for the options now only in `index.html` or
  `reader-config.json`.

## Suggested order

1. **Finding 1:** a CSP for the book frame, lowercasing of XHTML names, origin-based remote checks, and
   the extra test vectors.
2. **Finding 2:** a one-line fix.
3. **Findings 3 and 4:** the HTML soft-404 comparison and the sleep timer reset.
4. **Finding 5 and the `verify()` details:** macOS and minimal systems.
5. **The smaller items in 7 and 8, as convenient.**
