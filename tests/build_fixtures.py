#!/usr/bin/env python3
"""Build the test site: books, documents, comics and a fake TTS voice, under tests/site/ (git-ignored).

    python3 tests/build_fixtures.py

The reader itself is linked in as tests/site/reader/index.html (with libs/, fonts/, kokoro/ and pocket/ if
they have been fetched next to it). Pure standard library: zipfile, struct, zlib.
"""
import base64
import random
import io
import json
import math
import os
import shutil
import struct
import zipfile
import zlib
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
SITE = HERE / "site"
REMOTE = "http://localhost:8792"  # the "other site" the hostile book points at (see server.py --log)
BLOCKED = "http://blocked.example"  # a site the test browser blocks: any request to it shows up in page.blocked


def png(w, h, rgb):
    """A plain one-colour PNG."""
    raw = b"".join(b"\0" + bytes(rgb) * w for _ in range(h))
    chunk = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + \
        chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")


def xhtml(title, body, head="", lang="en"):
    return f"""<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="{lang}">
<head><title>{title}</title>{head}</head><body>{body}</body></html>"""


def epub(path, title, chapters, uid="urn:uuid:test", extra=None, lang="en"):
    """chapters: [(file name, title, xhtml body, extra head)]; extra: {zip path: bytes}."""
    items = "".join(f'<item id="c{i}" href="{f}" media-type="application/xhtml+xml"/>' for i, (f, *_r) in enumerate(chapters))
    for name in (extra or {}):
        if name.startswith("OEBPS/"):
            mt = {".png": "image/png", ".css": "text/css", ".wav": "audio/wav", ".smil": "application/smil+xml"}.get(os.path.splitext(name)[1], "application/octet-stream")
            items += f'<item id="x{abs(hash(name))}" href="{name[6:]}" media-type="{mt}"/>'
    spine = "".join(f'<itemref idref="c{i}"/>' for i in range(len(chapters)))
    nav_items = "".join(f'<li><a href="{f}">{t}</a></li>' for f, t, *_r in chapters)
    opf = f"""<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0"{' unique-identifier="uid"' if uid else ''}>
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">{f'<dc:identifier id="uid">{uid}</dc:identifier>' if uid else ''}
<dc:title>{title}</dc:title><dc:creator>Test Author</dc:creator><dc:language>{lang}</dc:language></metadata>
<manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>{items}</manifest>
<spine>{spine}</spine></package>"""
    nav = xhtml("Contents", f'<nav epub:type="toc"><ol>{nav_items}</ol></nav>')
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:   # compressed, like real EPUBs (mimetype stays stored)
        z.writestr(zipfile.ZipInfo("mimetype"), "application/epub+zip")
        z.writestr("META-INF/container.xml", """<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>""")
        z.writestr("OEBPS/content.opf", opf)
        z.writestr("OEBPS/nav.xhtml", nav)
        for f, t, body, *head in chapters:
            z.writestr(f"OEBPS/{f}", xhtml(t, body, head[0] if head else "", lang))
        for name, data in (extra or {}).items():
            z.writestr(zipfile.ZipInfo(name) if data == b"" else name, data)   # empty files stored (0 bytes), as tools do


def epub_items(path, title, items, spine, files, uid, nav=None):
    """An EPUB with a hand-written manifest: items [(id, href, media-type, extra attributes)], spine [id],
    files {path under OEBPS/: bytes or text}."""
    manifest = "".join(f'<item id="{i}" href="{h}" media-type="{t}" {x}/>' for i, h, t, x in items)
    opf = f"""<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="uid">{uid}</dc:identifier>
<dc:title>{title}</dc:title><dc:language>en</dc:language></metadata>
<manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>{manifest}</manifest>
<spine>{"".join(f'<itemref idref="{i}"/>' for i in spine)}</spine></package>"""
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr(zipfile.ZipInfo("mimetype"), "application/epub+zip")
        z.writestr("META-INF/container.xml", """<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>""")
        z.writestr("OEBPS/content.opf", opf)
        links = "".join(f'<li><a href="{h}">{t}</a></li>' for h, t in (nav or [("nav.xhtml", "Contents")]))
        z.writestr("OEBPS/nav.xhtml", xhtml("Contents", f'<nav epub:type="toc"><ol>{links}</ol></nav>'))
        for name, data in files.items():
            z.writestr("OEBPS/" + name, data)


def raw_zip(path, entries, comment=b""):
    """Write a ZIP byte by byte, for archives zipfile won't make on purpose. entries: dicts with name (bytes),
    data, and optionally deflate (bool), method (override), flags, cextra / lextra (central / local extra
    fields), usize (a declared size that isn't true) and crc (a wrong checksum)."""
    out, central = bytearray(), bytearray()
    for e in entries:
        data, name = e["data"], e["name"]
        if e.get("deflate"):
            c = zlib.compressobj(9, zlib.DEFLATED, -15); comp = c.compress(data) + c.flush()
        else:
            comp = data
        comp += e.get("junk", b"")   # bytes after the compressed data (some tools leave them)
        method = e.get("method", 8 if e.get("deflate") else 0)
        crc, flags = e.get("crc", zlib.crc32(data) & 0xFFFFFFFF), e.get("flags", 0)
        usize = e.get("usize", len(data))
        lextra, cextra, offset = e.get("lextra", b""), e.get("cextra", b""), len(out)
        out += struct.pack("<IHHHHHIIIHH", 0x04034b50, 20, flags, method, 0, 0, crc, len(comp), usize, len(name), len(lextra)) + name + lextra + comp
        central += struct.pack("<IHHHHHHIIIHHHHHII", 0x02014b50, 20, 20, flags, method, 0, 0, crc, len(comp), usize,
                               len(name), len(cextra), 0, 0, 0, 0, offset) + name + cextra
    cd_offset = len(out)
    out += central + struct.pack("<IHHHHIIH", 0x06054b50, 0, 0, len(entries), len(entries), len(central), cd_offset, len(comment)) + comment
    open(path, "wb").write(bytes(out))


def zip_entries(path):
    """The entries of a zip as raw_zip dicts (deflated, except mimetype)."""
    with zipfile.ZipFile(path) as z:
        return [{"name": i.filename.encode(), "data": z.read(i), "deflate": i.filename != "mimetype"} for i in z.infolist()]


def paragraphs(prefix, n, words=60):
    sentence = "The keeper walked the long path along the cliffs and counted the boats below. "
    return "".join(f"<p>{prefix} paragraph {i + 1}. " + sentence * (words // 14) + "</p>" for i in range(n))


def wav(path, seconds=1.0, rate=24000):
    n = int(seconds * rate)
    pcm = b"".join(struct.pack("<h", int(3000 * math.sin(i * 0.05))) for i in range(n))
    with open(path, "wb") as f:
        f.write(b"RIFF" + struct.pack("<I", 36 + len(pcm)) + b"WAVEfmt " + struct.pack("<IHHIIHH", 16, 1, 1, rate, rate * 2, 2, 16)
                + b"data" + struct.pack("<I", len(pcm)) + pcm)


def main():
    if SITE.exists():
        shutil.rmtree(SITE)
    reader = SITE / "reader"
    books = reader / "books"
    shelf = SITE / "bookshelf" / "books"
    for d in (books, shelf, SITE / "tts-voices", SITE / "folder-a", SITE / "folder-b"):
        d.mkdir(parents=True)
    # The reader under test, and anything fetched next to it.
    os.symlink(REPO / "index.html", reader / "index.html")
    for name in ("libs", "fonts", "kokoro", "pocket"):
        if (REPO / name).is_dir():
            os.symlink(REPO / name, reader / name)
    # Linked copies in two folders, each with its own default book and config (per-folder settings).
    # folder-a and folder-b share the reader's libraries and fonts (LIB_FILES); folder-c has its own linked copies
    # and no config.
    shared = {"LIB_FILES": "/reader/", "VOICE_FILES": "/reader/"}
    (SITE / "folder-c").mkdir()
    for folder, title in (("folder-a", "Folder A Book"), ("folder-b", "Folder B Book"), ("folder-c", "Folder C Book")):
        os.symlink(REPO / "index.html", SITE / folder / "index.html")
        epub(SITE / folder / "default.epub", title, [("c1.xhtml", "One", paragraphs(title, 3))], uid=f"urn:{folder}")
    for name in ("libs", "fonts"):
        if (REPO / name).is_dir():
            os.symlink(REPO / name, SITE / "folder-c" / name)
    (SITE / "folder-a" / "reader-config.json").write_text(json.dumps(shared))
    (SITE / "folder-remote").mkdir()
    os.symlink(REPO / "index.html", SITE / "folder-remote" / "index.html")
    (SITE / "folder-remote" / "reader-config.json").write_text(json.dumps({**shared, "ALLOW_REMOTE_CONTENT": True, "ALLOW_EXTERNAL_LINKS": False}))
    # ALLOW_CDN off with nothing self-hosted where the config points, and a tampered library.
    for folder, cfg in (("folder-nocdn", {"ALLOW_CDN": False, "LIB_FILES": "/nolibs/", "VOICE_FILES": "/novoices/"}),
                        ("folder-novoice", {"ALLOW_CDN": False, "LIB_FILES": "/reader/", "VOICE_FILES": "/novoices/"}),
                        ("folder-cdn", {"LIB_FILES": "/nolibs/"}),
                        ("folder-partial", {"LIB_FILES": "/reader/", "VOICE_FILES": "/partial/"}),
                        ("folder-badlib", {"ALLOW_CDN": False, "LIB_FILES": "/badlibs/"}),
                        ("folder-keys", {"LIB_FILES": "/reader/", "VOICE_FILES": "/reader/", "shortcuts": False}),
                        ("folder-listen", {"LIB_FILES": "/reader/", "VOICE_FILES": "/reader/", "SLEEP_TIMER": True, "TIME_LEFT": True}),
                        ("folder-sepia", {"LIB_FILES": "/reader/", "theme": "sepia"}),
                        ("folder-locked", {"LIB_FILES": "/reader/", "theme": "sepia", "TIME_LEFT": True,
                                           "LOCKED": ["theme", "TIME_LEFT", "shortcuts", "ALLOW_REMOTE_CONTENT", "bogus"]}),
                        ("folder-keep", {"LIB_FILES": "/reader/", "KEEP_POSITIONS_DAYS": 30, "LOCKED": ["KEEP_POSITIONS_DAYS"]}),
                        # (T-16: settings from a config file.)
                        # (T-20, L-103) Voice files on another site: its server may not allow a Range header.
                        ("folder-remotevoice", {"LIB_FILES": "/reader/", "VOICE_FILES": "http://localhost:8792/voices/"}),
                        ("folder-cfg", {"LIB_FILES": "/reader/", "SEARCH_MAX": 2, "COMIC_PART": 10, "KEEP_POSITIONS_DAYS": 0, "BOOKSHELF": "/shelf2"}),
                        ("folder-noedit", {"LIB_FILES": "/reader/", "EDITING": False}),
                        ("folder-noget", {"LIB_FILES": "/reader/", "GET_URLS": False}),
                        ("folder-bare", {"LIB_FILES": "/reader/", "SHOW_CONTENTS": False, "SHOW_PROGRESS": False, "SHOW_TOPBAR": False}),
                        ("folder-barelock", {"LIB_FILES": "/reader/", "SHOW_TOPBAR": False, "LOCKED": ["SHOW_TOPBAR"]}),
                        ("folder-alttts", {"LIB_FILES": "/reader/", "TTS_SERVER": {"api": "/alt-tts/", "voices": "/alt-voices/"},
                                           "SPAN_MAX": {"server": 60}, "SAVED_AUDIO_MB": 0})):
        (SITE / folder).mkdir()
        os.symlink(REPO / "index.html", SITE / folder / "index.html")
        (SITE / folder / "reader-config.json").write_text(json.dumps(cfg))
    # More reading fonts (ADDITIONAL_FONTS): from Google (one a built-in font already, one not a family name), and one
    # self-hosted as fetch-fonts.sh would (fonts/g-test-face.css, with a real WOFF2 file copied in).
    (SITE / "folder-fonts").mkdir()
    os.symlink(REPO / "index.html", SITE / "folder-fonts" / "index.html")
    (SITE / "folder-fonts" / "reader-config.json").write_text(json.dumps({"LIB_FILES": "/reader/", "ADDITIONAL_FONTS": ["Merriweather", "Lexend", "bad<name>", "Noto Serif:ital,wght@0,400;1,400"]}))
    fl = SITE / "fontlib"
    (fl / "fonts" / "files").mkdir(parents=True)
    if (REPO / "libs").is_dir():
        os.symlink(REPO / "libs", fl / "libs")
    (fl / "fonts" / "ui.css").write_text("/* interface fonts: none here */\n")
    woff = next((REPO / "fonts" / "files").rglob("*.woff2"), None) if (REPO / "fonts" / "files").is_dir() else None
    if woff: shutil.copy(woff, fl / "fonts" / "files" / "t.woff2")
    (fl / "fonts" / "g-test-face.css").write_text('@font-face{font-family:"Test Face";src:url(files/t.woff2) format("woff2")}\n')
    (SITE / "folder-fonts-local").mkdir()
    os.symlink(REPO / "index.html", SITE / "folder-fonts-local" / "index.html")
    (SITE / "folder-fonts-local" / "reader-config.json").write_text(json.dumps({"LIB_FILES": "/fontlib/", "ADDITIONAL_FONTS": "Test Face"}))
    # The site's own top bar: the contents button's word, and a logo with or without a link (a wide picture, and a
    # tall one; a link that isn't a web address is refused).
    for folder, cfg in (("folder-brand", {"LIB_FILES": "/reader/", "CONTENTS_TITLE": "", "NAVBAR_ICON": "logo.png", "NAVBAR_LINK": "/reader/books/notes.md"}),
                        ("folder-brand2", {"LIB_FILES": "/reader/", "CONTENTS_TITLE": "Chapters ✦", "NAVBAR_ICON": "tall.svg", "NAVBAR_LINK": "javascript:alert(1)"})):
        (SITE / folder).mkdir()
        os.symlink(REPO / "index.html", SITE / folder / "index.html")
        (SITE / folder / "reader-config.json").write_text(json.dumps(cfg))
    # A top bar with none of its buttons (SHOW_READ_ALOUD and the rest): all of them are in Settings' Text settings.
    (SITE / "folder-notools").mkdir()
    os.symlink(REPO / "index.html", SITE / "folder-notools" / "index.html")
    (SITE / "folder-notools" / "reader-config.json").write_text(json.dumps({"LIB_FILES": "/reader/", **{k: False for k in (
        "SHOW_READ_ALOUD", "SHOW_FONT_MENU", "SHOW_THEME_BUTTON", "SHOW_LAYOUT_BUTTON", "SHOW_FULLSCREEN_BUTTON", "SHOW_TEXT_SIZE",
        "SHOW_LINE_SPACING", "SHOW_TEXT_WIDTH", "SHOW_OPEN_BUTTON", "SHOW_SETTINGS_BUTTON")}}))
    (SITE / "folder-brand" / "logo.png").write_bytes(png(300, 50, (30, 90, 160)))
    (SITE / "folder-brand2" / "tall.svg").write_text('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="80"><rect width="20" height="80" fill="purple"/></svg>')
    # Self-hosted Pocket TTS with every library and runtime file but only the 8-bit model files (REVIEW.md
    # M-27): the full-precision model must come from the CDN. The stand-in worker answers "init" with an error
    # that names the addresses it was given.
    (SITE / "folder-pocket-partial").mkdir()
    os.symlink(REPO / "index.html", SITE / "folder-pocket-partial" / "index.html")
    (SITE / "folder-pocket-partial" / "reader-config.json").write_text(json.dumps({"LIB_FILES": "/reader/", "VOICE_FILES": "/pocket-partial/"}))
    # The same files with the CDNs off: only the 8-bit model is here (round 20: the reader's precision setting).
    (SITE / "folder-pocket-int8").mkdir()
    os.symlink(REPO / "index.html", SITE / "folder-pocket-int8" / "index.html")
    (SITE / "folder-pocket-int8" / "reader-config.json").write_text(json.dumps({"LIB_FILES": "/reader/", "VOICE_FILES": "/pocket-partial/", "ALLOW_CDN": False}))
    pp = SITE / "pocket-partial" / "pocket"
    for f in ("lib/binary.js", "lib/tokenizer.js", "ort/ort.min.mjs", "ort/ort-wasm-simd-threaded.mjs", "ort/ort-wasm-simd-threaded.wasm"):
        (pp / f).parent.mkdir(parents=True, exist_ok=True); (pp / f).write_text("// stand-in\n")
    (pp / "lib/worker.js").write_text("self.onmessage = e => { const m = e.data; self.postMessage({ type: 'error', id: m.id, "
                                      "error: 'stand-in: model ' + m.payload.modelBaseUrl + ' ort ' + m.payload.ortBaseUrl }); };\n")
    model = pp / "model" / "english_2026-04"
    model.mkdir(parents=True)
    (model / "bundle.json").write_text('{"bundle_name": "english_2026-04"}')
    for f in ("tokenizer.model", "voices.bin", "text_conditioner_int8.onnx", "flow_lm_main_int8.onnx", "flow_lm_flow_int8.onnx", "mimi_decoder_int8.onnx"):
        (model / f).write_bytes(b"stand-in")
    # (T-20, L-165) A Pocket TTS stand-in that starts, then crashes when asked to speak; every file self-hosted.
    (SITE / "folder-pocket-crash").mkdir()
    os.symlink(REPO / "index.html", SITE / "folder-pocket-crash" / "index.html")
    (SITE / "folder-pocket-crash" / "reader-config.json").write_text(json.dumps({"LIB_FILES": "/reader/", "VOICE_FILES": "/pocket-crash/", "ALLOW_CDN": False}))
    pc = SITE / "pocket-crash" / "pocket"
    for f in ("lib/binary.js", "lib/tokenizer.js", "ort/ort.min.mjs", "ort/ort-wasm-simd-threaded.mjs", "ort/ort-wasm-simd-threaded.wasm"):
        (pc / f).parent.mkdir(parents=True, exist_ok=True); (pc / f).write_text("// stand-in\n")
    (pc / "lib/worker.js").write_text(
        "self.onmessage = e => { const m = e.data;\n"
        "  if (m.type === 'init') { self.postMessage({ type: 'ready', bundle: { predefinedVoices: ['alba'], sampleRate: 24000 } }); self.postMessage({ type: 'result', id: m.id, result: {} }); }\n"
        "  else if (m.type === 'generate') setTimeout(() => { throw new Error('stand-in crash'); });\n"
        "  else if (m.type === 'loadBuiltinVoice') self.postMessage({ type: 'result', id: m.id, result: { ref: 1 } });\n"
        "  else self.postMessage({ type: 'result', id: m.id, result: {} }); };\n")
    cm = pc / "model" / "english_2026-04"
    cm.mkdir(parents=True)
    (cm / "bundle.json").write_text('{"bundle_name": "english_2026-04"}')
    for f in ("tokenizer.model", "voices.bin", "text_conditioner.onnx", "flow_lm_main.onnx", "flow_lm_flow.onnx", "mimi_decoder.onnx"):
        (cm / f).write_bytes(b"stand-in")
    # An empty default book name, which would be the reader's own page (REVIEW.md L-83).
    (SITE / "folder-emptydefault").mkdir()
    os.symlink(REPO / "index.html", SITE / "folder-emptydefault" / "index.html")
    (SITE / "folder-emptydefault" / "reader-config.json").write_text(json.dumps({"LIB_FILES": "/reader/", "DEFAULT_BOOK": ""}))
    # A folder whose default list is set in its config, ending in a text file (DEFAULT_BOOK as a list).
    (SITE / "folder-list").mkdir()
    os.symlink(REPO / "index.html", SITE / "folder-list" / "index.html")
    (SITE / "folder-list" / "reader-config.json").write_text(json.dumps({"LIB_FILES": "/reader/", "DEFAULT_BOOK": ["missing.epub", "missing.md", "story.txt"]}))
    (SITE / "folder-list" / "story.txt").write_text("A Listed Story\n\nOpened as the third default in the list.\n")
    # Numbers out of range in a config (REVIEW.md L-55): 1e999 is Infinity to JSON.parse.
    (SITE / "folder-nums").mkdir()
    os.symlink(REPO / "index.html", SITE / "folder-nums" / "index.html")
    (SITE / "folder-nums" / "reader-config.json").write_text('{"LIB_FILES": "/reader/", "LOOKAHEAD_SEC": 1e999, "fontSize": 250, "lineSpacing": 3}')
    # Kokoro's library and runtime self-hosted, but not its model: the model must come from the pinned revision.
    if (REPO / "kokoro" / "kokoro.web.js").exists():
        (SITE / "partial" / "kokoro").mkdir(parents=True)
        for name in ("kokoro.web.js", "ort"):
            os.symlink(REPO / "kokoro" / name, SITE / "partial" / "kokoro" / name)
    (SITE / "badlibs" / "libs").mkdir(parents=True)
    (SITE / "badlibs" / "libs" / "jszip.min.js").write_text("window.JSZip = { tampered: true };")
    (SITE / "folder-b" / "reader-config.json").write_text(json.dumps({**shared,
        "theme": "dark", "layout": "one", "ALLOW_EXTERNAL_LINKS": False, "LOOKAHEAD_SEC": 30, "unknownSetting": 1}))

    # A long three-chapter book (search, time left, read-aloud across chapters).
    epub(books / "long.epub", "The Long Book", [
        ("c1.xhtml", "Chapter One", "<h1>Chapter One</h1>" + paragraphs("First", 12) + "<p>The lighthouse café opened at dawn.</p>"),
        ("c2.xhtml", "Chapter Two", "<h1>Chapter Two</h1>" + paragraphs("Second", 12) + "<p>He said, “I don’t think so.”</p>"),
        ("c3.xhtml", "Chapter Three", "<h1>Chapter Three</h1>" + paragraphs("Third", 4)),
    ], uid="urn:long")
    # A print-only style block, which mustn't apply on screen (REVIEW.md M-24).
    epub(books / "print-style.epub", "Print Style", [("c1.xhtml", "One", "<h1>One</h1><p>Seen on screen.</p>", '<style media="print">p{display:none}</style>')], uid="urn:print-style")
    # Spine items that aren't XHTML (REVIEW.md M-25): an SVG page, a picture with an XHTML fallback in another
    # folder, and a picture with none; a chapter in UTF-16 and one in Shift_JIS (M-26).
    sjis = xhtml("Sjis", "<p>日本語の本です。</p>").replace('encoding="utf-8"', 'encoding="Shift_JIS"').encode("shift_jis")
    epub_items(books / "odd-spine.epub", "Odd Spine", [
        ("svg", "cover.svg", "image/svg+xml", ""),
        ("img", "plate.png", "image/png", 'fallback="fb"'),
        ("fb", "pages/plate.xhtml", "application/xhtml+xml", ""),
        ("pic", "bare.png", "image/png", ""),
        ("u16", "u16.xhtml", "application/xhtml+xml", ""),
        ("sj", "sjis.xhtml", "application/xhtml+xml", ""),
        ("plate", "plate2.png", "image/png", ""),
    ], ["svg", "img", "pic", "u16", "sj"], {
        "cover.svg": '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect width="300" height="200" fill="#4a8"/><text x="20" y="100">Drawn cover words</text></svg>',
        "plate.png": png(30, 20, (200, 0, 0)), "plate2.png": png(64, 48, (0, 200, 0)), "bare.png": png(50, 40, (0, 0, 200)),
        "pages/plate.xhtml": xhtml("Plate", '<p>Fallback page.</p><p><img id="fb-img" src="../plate2.png" alt="plate"/></p>'),
        "u16.xhtml": xhtml("U16", "<p>Sixteen-bit café text.</p>").replace('encoding="utf-8"', 'encoding="UTF-16"').encode("utf-16"),
        "sjis.xhtml": sjis,
    }, "urn:odd-spine")
    # UTF-8 under stale or wrong declarations, which must stay UTF-8, and real Latin-1 that says so (M-26 review).
    utf = "<p>café – “quoted”</p>"
    epub_items(books / "stale-charset.epub", "Stale Charset", [
        ("a", "a.xhtml", "application/xhtml+xml", ""), ("b", "b.xhtml", "application/xhtml+xml", ""), ("c", "c.xhtml", "application/xhtml+xml", ""),
    ], ["a", "b", "c"], {
        "a.xhtml": ('<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><meta http-equiv="Content-Type" '
                    'content="text/html; charset=iso-8859-1"/><title>A</title></head><body>' + utf + '</body></html>').encode("utf-8"),
        "b.xhtml": ('<?xml version="1.0" encoding="iso-8859-1"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>B</title></head><body>'
                    + utf + '</body></html>').encode("utf-8"),
        "c.xhtml": ('<?xml version="1.0" encoding="iso-8859-1"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>C</title></head><body>'
                    '<p>Latin crème brûlée.</p></body></html>').encode("latin-1"),
    }, "urn:stale-charset")
    # An old Windows-1252 Markdown file that mentions a UTF-8 <meta> (not sniffed in Markdown: round 11 review).
    (books / "latin-tips.md").write_bytes('# Old\n\nWrite `<meta charset="utf-8">` in new pages. Café crème brûlée.\n'.encode("cp1252"))
    (books / "tips.md").write_text('# Tips\n\nWrite `<meta charset="windows-1252">` only if you mean it: café – “quoted”.\n', encoding="utf-8")
    # Contents entries listed out of order within one file, and one whose heading isn't there (L-119, L-118).
    epub_items(books / "toc-order.epub", "Toc Order", [("c1", "c1.xhtml", "application/xhtml+xml", ""), ("c2", "c2.xhtml", "application/xhtml+xml", "")], ["c1", "c2"], {
        "c1.xhtml": xhtml("C1", '<h2 id="a">First</h2><p>First part text.</p><h2 id="b">Second</h2><p>Second part text.</p>'),
        "c2.xhtml": xhtml("C2", '<p>Third part text.</p>'),
    }, "urn:toc-order", nav=[("c1.xhtml#b", "Second"), ("c1.xhtml#a", "First"), ("c2.xhtml#nowhere", "Third")])
    # Fonts obfuscated as EPUB allows (L-88): IDPF (SHA-1 of the identifier) and Adobe (the urn:uuid's bytes).
    import hashlib
    font = b"\x00\x01\x00\x00" + bytes((i * 7 + 3) % 256 for i in range(3000))
    def obfuscated(key, n):
        return bytes(b ^ key[i % len(key)] if i < n else b for i, b in enumerate(font))
    enc = lambda alg: f"""<?xml version="1.0"?><encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container" xmlns:enc="http://www.w3.org/2001/04/xmlenc#">
<enc:EncryptedData><enc:EncryptionMethod Algorithm="{alg}"/><enc:CipherData><enc:CipherReference URI="OEBPS/f.ttf"/></enc:CipherData></enc:EncryptedData></encryption>"""
    style = '<style>@font-face{font-family:Obf;src:url(f.ttf)} p{font-family:Obf}</style>'
    for name, uid, alg, key, n in (("obf-idpf", " urn:isbn:9780000000001 ", "http://www.idpf.org/2008/embedding", hashlib.sha1(b"urn:isbn:9780000000001").digest(), 1040),
                                   ("obf-adobe", "urn:uuid:0123abcd-4567-89ef-0123-456789abcdef", "http://ns.adobe.com/pdf/enc#RC", bytes.fromhex("0123abcd456789ef0123456789abcdef"), 1024)):
        epub(books / f"{name}.epub", name, [("c1.xhtml", "One", "<p>Obfuscated font text.</p>", style)], uid=uid,
             extra={"OEBPS/f.ttf": obfuscated(key, n), "META-INF/encryption.xml": enc(alg)})
    (books / "obf-font.bin").write_bytes(font)
    # (T-20, L-94) A folder book: text, two picture pages, text.
    epub(books / "pics-src.epub", "Pictures Folder", [("c1.xhtml", "Words", "<p>Opening words.</p>"), ("c2.xhtml", "Pic A", '<p><img src="pic.png" alt=""/></p>'),
         ("c3.xhtml", "Pic B", '<p><img src="pic.png" alt=""/></p>'), ("c4.xhtml", "More", "<p>Closing words.</p>")], uid="urn:pics-dir",
         extra={"OEBPS/pic.png": png(40, 30, (90, 160, 90))})
    with zipfile.ZipFile(books / "pics-src.epub") as z0:
        z0.extractall(books / "pics-dir")
    (books / "pics-src.epub").unlink()
    # (T-20, L-170) A folder book of three chapters, for searches while it is still being indexed.
    epub(books / "search-src.epub", "Search Folder", [("c1.xhtml", "One", "<p>Alpha words here.</p>"), ("c2.xhtml", "Two", "<p>Zebra unique words.</p>"),
         ("c3.xhtml", "Three", "<p>Gamma words here.</p>")], uid="urn:search-dir")
    with zipfile.ZipFile(books / "search-src.epub") as z0:
        z0.extractall(books / "search-dir")
    (books / "search-src.epub").unlink()
    # (T-20) The IDPF one unpacked as a folder book, whose font is fetched from the server.
    with zipfile.ZipFile(books / "obf-idpf.epub") as z0:
        z0.extractall(books / "obf-dir")
    # (T-20, L-137) The same, but encryption.xml names the font in another case than the file: found by its folded name.
    epub(books / "obf-case.epub", "obf-case", [("c1.xhtml", "One", "<p>Obfuscated font text.</p>", style)], uid=" urn:isbn:9780000000001 ",
         extra={"OEBPS/f.ttf": obfuscated(hashlib.sha1(b"urn:isbn:9780000000001").digest(), 1040),
                "META-INF/encryption.xml": enc("http://www.idpf.org/2008/embedding").replace("OEBPS/f.ttf", "OEBPS/F.TTF")})
    # (T-20, L-153) A part of the book that isn't a page or a picture (a PDF): a note, not searched or read aloud.
    # (L-172: and one with no media type, known by its name.)
    epub_items(books / "nonpage.epub", "Non Page", [("c1", "c1.xhtml", "application/xhtml+xml", ""), ("pdf", "doc.pdf", "application/pdf", ""),
        ("snd", "track.mp3", "", ""), ("c2", "c2.xhtml", "application/xhtml+xml", "")], ["c1", "pdf", "snd", "c2"],
        {"c1.xhtml": xhtml("One", "<p>First words here.</p>"), "doc.pdf": b"%PDF-1.4 not really", "track.mp3": b"ID3 not really",
         "c2.xhtml": xhtml("Two", "<p>Last words here.</p>")}, "urn:nonpage")
    # Round 13 review: markup that only appears on reading back (mutation) carrying styles, srcset and a relative
    # src; var() inside image-set(); XHTML files named .html; namespaces in the importing sheet and in strings;
    # a damaged picture.
    mx = ('&lt;/style&gt;&lt;form&gt;&lt;math&gt;&lt;mtext&gt;&lt;/form&gt;&lt;form&gt;&lt;mglyph&gt;&lt;xmp&gt;&lt;/math&gt;'
          '&lt;style&gt;body{background:url(' + REMOTE + '/mx-css.png)}&lt;/style&gt;'
          '&lt;img srcset="' + REMOTE + '/mx-srcset.png 1x" src="mx-local.png"&gt;&lt;p style="background:url(' + REMOTE + '/mx-attr.png)"&gt;MXP&lt;/p&gt;&lt;/xmp&gt;')
    epub_items(books / "mutation-css.epub", "Mutation CSS", [("c1", "c1.xhtml", "application/xhtml+xml", "")], ["c1"],
               {"c1.xhtml": xhtml("One", "<p>Hello</p><style>" + mx + "</style><p>after</p>")}, "urn:mutation-css")
    varcss = (':root{--x:"' + REMOTE + '/var-a.png"; --y:"' + REMOTE + '/var-b.png"; --rel:"var-rel.png"}'
              ' #a{background-image:image-set(var(--x) 1x)} #b{background-image:-webkit-image-set(var(--y) 1x)} #c{background-image:image-set(var(--rel) 1x)}')
    epub_items(books / "var-image.epub", "Var Image", [("c1", "c1.xhtml", "application/xhtml+xml", "")], ["c1"],
               {"c1.xhtml": xhtml("One", '<p id="a">A</p><p id="b">B</p><p id="c">C</p>', "<style>" + varcss + "</style>")}, "urn:var-image")
    epub_items(books / "xhtml-named-html.epub", "Xhtml Named Html", [("c1", "c1.html", "application/xhtml+xml", "")], ["c1"],
               {"c1.html": xhtml("One", '<p>Before <a id="pg5"/>after the anchor.</p><div class="sep"/><p id="last">Last paragraph.</p>', "<style>.sep{display:none}</style>")}, "urn:xhtml-named-html")
    epub_items(books / "ns-sheet.epub", "Ns Sheet", [("c1", "c1.xhtml", "application/xhtml+xml", ""), ("s", "style.css", "text/css", ""), ("a", "a.css", "text/css", "")], ["c1"], {
        "c1.xhtml": xhtml("One", '<p id="n1" epub:type="x">namespaced</p><p id="q">q</p>', '<link rel="stylesheet" href="style.css"/>'),
        "style.css": '@import "a.css";\n@namespace epub "http://www.idpf.org/2007/ops";\np[epub|type~="x"]{color:rgb(255, 0, 0)}\n',
        "a.css": 'h1{color:blue}\n#q::after{content:"@namespace zz;"}\n'}, "urn:ns-sheet")
    # A picture with a wrong checksum (round 13 review: the page shows, without it), and a book whose first
    # chapter can't be inflated (opened after another book: that book's page mustn't stay).
    def damage(path, name, how):
        b = bytearray(path.read_bytes())
        with zipfile.ZipFile(path) as z: info = z.getinfo(name)
        if how == "crc":
            struct.pack_into("<I", b, info.header_offset + 14, info.CRC ^ 1)
            i = 0
            while (i := b.find(b"PK\x01\x02", i)) >= 0:
                n = struct.unpack_from("<H", b, i + 28)[0]
                if b[i + 46:i + 46 + n] == name.encode(): struct.pack_into("<I", b, i + 16, info.CRC ^ 1)
                i += 4
        else:   # garble the deflated data
            n, x = struct.unpack_from("<HH", b, info.header_offset + 26)
            at = info.header_offset + 30 + n + x
            for k in range(at, at + min(8, info.compress_size)): b[k] = 0xFF
        path.write_bytes(bytes(b))
    epub(books / "bad-picture.epub", "Bad Picture", [("c1.xhtml", "One", '<p>The text of chapter one.</p><p><img src="pic.png" alt="p"/></p>')],
         uid="urn:bad-picture", extra={"OEBPS/pic.png": png(20, 20, (200, 0, 0))})
    damage(books / "bad-picture.epub", "OEBPS/pic.png", "crc")
    epub(books / "bad-first.epub", "Bad First", [("c1.xhtml", "One", paragraphs("Broken", 3)), ("c2.xhtml", "Two", "<p>Second chapter.</p>")], uid="urn:bad-first")
    damage(books / "bad-first.epub", "OEBPS/c1.xhtml", "deflate")
    # Text, two picture pages, then text again (T-20): reading passes the pictures and goes on to the text.
    epub(books / "text-pictures-text.epub", "Text Pictures Text", [("c1.xhtml", "Words", "<p>Opening words.</p>")]
         + [(f"p{i}.xhtml", f"Plate {i}", f'<p><img src="p{i}.png" alt=""/></p>') for i in (2, 3)]
         + [("c4.xhtml", "More", "<p>Closing words after the plates.</p>")],
         uid="urn:text-pictures-text", extra={f"OEBPS/p{i}.png": png(40, 30, (90, 60 * i, 120)) for i in (2, 3)})
    # MathML with links on it, which Firefox would follow (L-138).
    epub(books / "math-links.epub", "Math Links", [("c1.xhtml", "One", '<p>Formula: <math xmlns="http://www.w3.org/1998/Math/MathML" id="m" href="https://example.org/"><mi id="mi" href="#x">x</mi></math></p>')], uid="urn:math-links")
    # Many short paragraphs (round 13 review): passages quick enough to see a pause stop them.
    epub(books / "short-lines.epub", "Short Lines", [("c1.xhtml", "Lines", "".join(f"<p>Line {i} is short.</p>" for i in range(1, 61)))], uid="urn:short-lines")
    # Files in other encodings (M-26): Shift_JIS HTML that says so, UTF-16 text with a mark.
    (books / "sjis.html").write_bytes('<html><head><meta charset="shift_jis"><title>本</title></head><body><p>日本語の本です。</p></body></html>'.encode("shift_jis"))
    (books / "u16.txt").write_bytes("Sixteen-bit plain text, café.\n".encode("utf-16"))
    # Three short chapters as an extracted folder (round 11 review): a chapter that fails to load once while
    # it is looked at ahead must still be read.
    epub(books / "abc.epub", "ABC", [(f"c{i}.xhtml", n, f"<p>{n} words here.</p>") for i, n in ((1, "Alpha"), (2, "Bravo"), (3, "Charlie"))], uid="urn:abc")
    with zipfile.ZipFile(books / "abc.epub") as z:
        z.extractall(books / "abc")
    # The same with chapter 2 missing from the folder (round 11 review): reading stops there, on chapter 1.
    with zipfile.ZipFile(books / "abc.epub") as z:
        z.extractall(books / "abc-missing")
    (books / "abc-missing" / "OEBPS" / "c2.xhtml").unlink()
    # Text, then only pictures to the end (REVIEW.md M-23): reading past the text mustn't turn to the last page.
    epub(books / "text-then-pictures.epub", "Text Then Pictures", [("c1.xhtml", "Words", "<h1>Words</h1><p>Only a few words here.</p>")]
         + [(f"p{i}.xhtml", f"Plate {i}", f'<p><img src="p{i}.png" alt=""/></p>') for i in (2, 3)],
         uid="urn:text-then-pictures", extra={f"OEBPS/p{i}.png": png(40, 30, (90, 60 * i, 120)) for i in (2, 3)})
    epub(books / "french.epub", "Le Livre", [("c1.xhtml", "Un", "<h1>Un</h1><p>Il était une fois.</p>")], uid="urn:french", lang="fr")
    # A large book: about 5 MB, mostly a file it never shows, and a picture in chapter 3 (REVIEW.md L-16).
    epub(books / "big.epub", "The Big Book", [
        ("c1.xhtml", "Big One", "<h1>Big One</h1>" + paragraphs("Big", 3)),
        ("c2.xhtml", "Big Two", "<h1>Big Two</h1>" + paragraphs("Big", 3)),
        ("c3.xhtml", "Big Three", '<h1>Big Three</h1><p><img id="big-pic" src="pic.png" alt="pic"/></p>'),
    ], uid="urn:big", extra={"OEBPS/pic.png": png(80, 60, (40, 120, 200)), "OEBPS/unused.bin": os.urandom(5_000_000)})
    # A book with an empty stylesheet (a zero-length file in the archive) (REVIEW.md H-3).
    epub(books / "empty-file.epub", "Empty File", [("c1.xhtml", "One", "<h1>One</h1><p>Text.</p>", '<link rel="stylesheet" href="empty.css"/><link rel="stylesheet" href="empty-deflated.css"/>')],
         uid="urn:empty-file", extra={"OEBPS/empty.css": b""})
    # ... and one marked deflated with no data at all (some archivers write empty files so).
    entries = [{**e, "deflate": e["deflate"] and e["name"] != b"OEBPS/empty.css"} for e in zip_entries(books / "empty-file.epub")]
    raw_zip(books / "empty-file.epub", entries + [{"name": b"OEBPS/empty-deflated.css", "data": b"", "method": 8}])
    # Unusual archives for the in-place reader (REVIEW.md T-6, M-7 to M-9, L-22, L-23).
    base = [("c1.xhtml", "First", "<h1>First</h1>" + paragraphs("Odd", 2)), ("c2.xhtml", "Second", "<h1>Second</h1><p>Second chapter.</p>")]
    epub(books / "dirs.epub", "Directory Entries", base, uid="urn:dirs")
    with zipfile.ZipFile(books / "dirs.epub", "a") as z:
        for d in ("OEBPS/", "OEBPS/images/", "META-INF/"):
            z.writestr(zipfile.ZipInfo(d), b"")
    epub(books / "comment.epub", "Archive Comment", base, uid="urn:comment")
    with zipfile.ZipFile(books / "comment.epub", "a") as z:
        z.comment = b"notes: PK\x05\x06 is not the end record " + b"x" * 40
    epub(books / "local-extra.epub", "Local Extra", base + [("c3.xhtml", "Third", '<h1>Third</h1><p><img id="le-pic" src="pic.png" alt="p"/></p>')],
         uid="urn:local-extra", extra={"OEBPS/pic.png": png(30, 20, (10, 200, 10))})
    entries = zip_entries(books / "local-extra.epub")
    for e in entries:   # a local header extra field much longer than the central one: the data needs a second read
        if e["name"] == b"OEBPS/pic.png":
            e["lextra"] = struct.pack("<HH", 0xCAFE, 300) + b"\0" * 300
    raw_zip(books / "local-extra.epub", entries)
    epub(books / "bomb.epub", "Bomb", base, uid="urn:bomb")
    entries = zip_entries(books / "bomb.epub")
    for e in entries:   # chapter 2 inflates to far more than it declares
        if e["name"] == b"OEBPS/c2.xhtml":
            e["data"] = e["data"].replace(b"Second chapter.", b"Second chapter. " + b"A" * 200000)
            e["usize"] = 1000
    raw_zip(books / "bomb.epub", entries)
    epub(books / "method99.epub", "Odd Method", base, uid="urn:method99")
    entries = zip_entries(books / "method99.epub") + [{"name": b"OEBPS/unused.bin", "data": b"xyz", "method": 99}]
    raw_zip(books / "method99.epub", entries)
    # A chapter whose stored name isn't UTF-8 (old archivers), with the real name in a Unicode Path field.
    uni = "ch\u00e4pter.xhtml"
    epub(books / "unicode-path.epub", "Unicode Path", [(uni, "Chapter", "<h1>Umlaut chapter</h1><p>Found by its Unicode name.</p>")], uid="urn:unicode-path")
    entries = zip_entries(books / "unicode-path.epub")
    for e in entries:
        if e["name"] == ("OEBPS/" + uni).encode():
            cp = ("OEBPS/" + uni).encode("cp437")
            e["cextra"] = struct.pack("<HHBI", 0x7075, 5 + len(e["name"]), 1, zlib.crc32(cp) & 0xFFFFFFFF) + e["name"]
            e["name"] = cp
    raw_zip(books / "unicode-path.epub", entries)
    # ZIP64 structures (as in archives with very many files): read by JSZip, not in place.
    limits = zipfile.ZIP_FILECOUNT_LIMIT
    zipfile.ZIP_FILECOUNT_LIMIT = 2
    try:
        epub(books / "zip64.epub", "Zip64 Book", base, uid="urn:zip64")
    finally:
        zipfile.ZIP_FILECOUNT_LIMIT = limits
    data = bytearray((books / "zip64.epub").read_bytes())
    end = data.rfind(b"PK\x05\x06")
    data[end + 8:end + 12] = b"\xff\xff\xff\xff"   # the counts say "see the ZIP64 record", as in real ZIP64 archives
    (books / "zip64.epub").write_bytes(bytes(data))
    # Two books of exactly the same size, stored, differing only in their chapter text (a same-size
    # replacement, REVIEW.md L-26; chapters over the 256 KB cache limit, so they are read again), for folders whose server sends a weak ETag or no validators.
    for d in ("weak-etag", "no-validators"):
        (books / d).mkdir()
    for name, letter in (("same-a", "A"), ("same-b", "B")):
        epub(books / f"{name}.epub", "Same Size", [(f"c{i}.xhtml", f"Part {i}", f"<h1>Part {i}</h1><p>{letter * 300000}</p>") for i in range(1, 4)], uid="urn:same-size")
        raw_zip(books / f"{name}.epub", [{**e, "deflate": False} for e in zip_entries(books / f"{name}.epub")])
    assert (books / "same-a.epub").stat().st_size == (books / "same-b.epub").stat().st_size
    # Padding after the end record (some tools add it): still read in place (L-27).
    epub(books / "trailing.epub", "Trailing Bytes", base, uid="urn:trailing")
    with open(books / "trailing.epub", "ab") as f:
        f.write(b"\0" * 100)
    # A Unicode Path field longer than its extra data, and one on a name already marked UTF-8 (L-27): both ignored.
    epub(books / "bad-upath.epub", "Bad Unicode Path", base, uid="urn:bad-upath")
    entries = zip_entries(books / "bad-upath.epub")
    for e in entries:
        if e["name"] == b"OEBPS/c1.xhtml":
            # (with the name's real CRC, so only the size check rejects it)
            e["cextra"] = struct.pack("<HHBI", 0x7075, 200, 1, zlib.crc32(e["name"]) & 0xFFFFFFFF) + b"OEBPS/zz"
        if e["name"] == b"OEBPS/c2.xhtml":
            e["flags"] = 0x800
            e["cextra"] = struct.pack("<HHBI", 0x7075, 5 + 9, 1, zlib.crc32(e["name"]) & 0xFFFFFFFF) + b"OEBPS/zzz"
    raw_zip(books / "bad-upath.epub", entries)
    # Two stray bytes after one chapter's compressed data (REVIEW.md L-42): read, as JSZip and zip tools do.
    epub(books / "junk.epub", "Junk Bytes", base, uid="urn:junk")
    entries = zip_entries(books / "junk.epub")
    for e in entries:
        if e["name"] == b"OEBPS/c2.xhtml":
            e["junk"] = b"\0\0"
    raw_zip(books / "junk.epub", entries)
    # A package path written with a leading slash (L-44).
    with zipfile.ZipFile(books / "dirs.epub") as zin, zipfile.ZipFile(books / "slash.epub", "w", zipfile.ZIP_DEFLATED) as zout:
        for i in zin.infolist():
            d = zin.read(i)
            if i.filename == "META-INF/container.xml":
                d = d.replace(b'full-path="OEBPS/content.opf"', b'full-path="/OEBPS/content.opf"')
            if i.filename == "OEBPS/content.opf":
                d = d.replace(b"Directory Entries", b"Leading Slash")
            zout.writestr(i, d)
    # Links and file names that differ from the manifest in case and Unicode form (L-48): a link to C2.XHTML for
    # c2.xhtml, and a chapter stored under its NFD name (as macOS archivers write it) while the manifest is NFC.
    import unicodedata
    uname = "kapitel-\u00e4.xhtml"
    epub(books / "case.epub", "Case And Form", [("c1.xhtml", "One", '<h1>One</h1><p><a id="to-c2" href="C2.XHTML">to two</a></p>'),
         ("c2.xhtml", "Two", "<h1>Two</h1><p>Second.</p>"), (uname, "Three", "<h1>Three</h1><p>Umlaut file.</p>")], uid="urn:case")
    entries = zip_entries(books / "case.epub")
    for e in entries:
        if e["name"] == ("OEBPS/" + uname).encode():
            e["name"] = unicodedata.normalize("NFD", "OEBPS/" + uname).encode(); e["flags"] = 0x800
    raw_zip(books / "case.epub", entries)
    # A chapter with a wrong checksum, as some archivers write (L-30): read from an upload, refused over HTTP.
    epub(books / "bad-crc.epub", "Bad Checksum", base, uid="urn:bad-crc")
    entries = zip_entries(books / "bad-crc.epub")
    for e in entries:
        if e["name"] == b"OEBPS/c2.xhtml":
            e["crc"] = 0x12345678
    raw_zip(books / "bad-crc.epub", entries)
    # A chapter that says it is 600 MB (L-27): refused with a clear message rather than decompressed.
    epub(books / "huge-entry.epub", "Huge Entry", base, uid="urn:huge-entry")
    entries = zip_entries(books / "huge-entry.epub")
    for e in entries:
        if e["name"] == b"OEBPS/c2.xhtml":
            e["usize"] = 600 << 20
    raw_zip(books / "huge-entry.epub", entries)
    (books / "star-total").mkdir()
    shutil.copy(books / "long.epub", books / "star-total" / "long.epub")
    # Two different books with the same title and no identifier (REVIEW.md L-13).
    for name, n in (("twin-a", 3), ("twin-b", 2)):
        epub(books / f"{name}.epub", "Twin Title", [(f"c{i}.xhtml", f"{name} {i}", f"<h1>{name} part {i}</h1>" + paragraphs(name, 2)) for i in range(1, n + 1)], uid=None)
    # A book using the reader's own ids (REVIEW.md L-11): page counting must still find the real end.
    epub(books / "reader-ids.epub", "Reader Ids", [("c1.xhtml", "One", '<p id="spine-end">Starts here. <a id="to-end" href="#spine-flow">to the end</a></p>'
         + paragraphs("Ids", 30) + '<p id="spine-flow">The end.</p>')], uid="urn:reader-ids")
    # Twin C: twin A's title and file names, different text (REVIEW.md M-10): a different book.
    epub(books / "twin-c.epub", "Twin Title", [(f"c{i}.xhtml", f"twin-c {i}", f"<h1>twin-c part {i}</h1>" + paragraphs("twin-c", 2)) for i in range(1, 4)], uid=None)
    # Twin A after a metadata edit (new author, a date, a cover), and after being given an identifier (M-10).
    def edited(src, dst, change, extra=None):
        with zipfile.ZipFile(src) as zin, zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as zout:
            for i in zin.infolist():
                data = zin.read(i)
                if i.filename == "OEBPS/content.opf":
                    data = change(data.decode()).encode()
                zout.writestr(i, data)
            for k, v in (extra or {}).items():
                zout.writestr(k, v)
    edited(books / "twin-a.epub", books / "twin-a-edited.epub",
           lambda o: o.replace("<dc:creator>Test Author</dc:creator>", "<dc:creator>Another Author</dc:creator><dc:date>2020-01-01</dc:date>")
                      .replace("</manifest>", '<item id="cover" href="cover.png" media-type="image/png" properties="cover-image"/></manifest>'),
           {"OEBPS/cover.png": png(30, 40, (10, 90, 160))})
    # ... and with its last chapter edited (L-31).
    with zipfile.ZipFile(books / "twin-a.epub") as zin, zipfile.ZipFile(books / "twin-a-last.epub", "w", zipfile.ZIP_DEFLATED) as zout:
        for i in zin.infolist():
            data = zin.read(i)
            if i.filename == "OEBPS/c3.xhtml":
                data = data.replace(b"twin-a part 3", b"twin-a part 3 (revised)")
            zout.writestr(i, data)
    # Mutation: markup in an XHTML <style> that reads back differently once serialized, bringing back a shadow
    # root with a link to another site (round 8 review). Must be cleaned (or refused), never shown.
    mx = ('&lt;/style&gt;&lt;form&gt;&lt;math&gt;&lt;mtext&gt;&lt;/form&gt;&lt;form&gt;&lt;mglyph&gt;&lt;style&gt;&lt;/math&gt;&lt;div id="mx-host"&gt;'
          '&lt;template shadowrootmode="open"&gt;&lt;a id="mx-link" href="https://example.com/mx" target="_blank"&gt;MX&lt;/a&gt;&lt;/template&gt;&lt;/div&gt;')
    epub(books / "mutation.epub", "Mutation", [("c1.xhtml", "One", "<p>Hello mx</p><style>" + mx + "</style><p>after</p>")], uid="urn:mutation")
    # A comic whose entry names use backslashes (older Windows tools), and an EPUB whose entry names start with
    # "/" (round 8 review: both opened before the path changes and must still).
    raw_zip(books / "backslash.cbz", [{"name": f"Vol1\\{i:03d}.png".encode(), "data": png(60, 90, (40 * i, 80, 120))} for i in (1, 2)])
    raw_zip(books / "abs-names.epub", [{**e, "name": e["name"] if e["name"] == b"mimetype" else b"/" + e["name"]} for e in zip_entries(books / "slash.epub")])
    # A 1 MB font named in 300 styles and 300 style attributes (round 8 review): the page stays small.
    epub(books / "font-bomb.epub", "Font Bomb", [("c1.xhtml", "One", "<h1>Fonts</h1>" + '<style>@font-face{font-family:F;src:url(f.ttf)}</style>' * 300
         + '<b style="background:url(f.ttf)">x</b>' * 300 + "<p style='font-family:F'>Text.</p>")], uid="urn:font-bomb",
         extra={"OEBPS/f.ttf": os.urandom(1 << 20)})
    # Six chapters, each with its own picture (REVIEW.md M-16): pictures of far chapters are released.
    epub(books / "pictures.epub", "Pictures", [(f"c{i}.xhtml", f"Pictures {i}", f'<h1>Picture {i}</h1><p><img class="pic" src="p{i}.png" alt="p{i}"/></p>') for i in range(1, 7)],
         uid="urn:pictures", extra={f"OEBPS/p{i}.png": png(40 + i, 30, (30 * i, 90, 120)) for i in range(1, 7)})
    # An extracted book in a folder whose name has ";" and "," (REVIEW.md L-81): its pictures must still load.
    with zipfile.ZipFile(books / "pictures.epub") as z:
        z.extractall(books / "semi;colon,comma")
    # A stylesheet that imports itself 30 times, linked 50 times (REVIEW.md H-6): must open quickly.
    epub(books / "css-fanout.epub", "CSS Fanout", [("c1.xhtml", "One", "<h1>Fanout</h1><p class='f'>Text.</p>",
         '<link rel="stylesheet" href="self.css"/>' * 50)], uid="urn:css-fanout",
         extra={"OEBPS/self.css": ('@import "self.css";\n' * 30 + "/*" + "x" * 1000 + "*/ .f{color:rgb(1, 2, 3)}").encode()})
    # Two different books with the same title, file names and cover page, and no identifier (round 5 review).
    for name in ("cover-x", "cover-y"):
        epub(books / f"{name}.epub", "Covered", [("cover.xhtml", "Cover", '<p><img src="pic.png" alt="cover"/></p>')]
             + [(f"c{i}.xhtml", f"{name} {i}", f"<h1>{name} part {i}</h1>" + paragraphs(name, 4)) for i in (1, 2)],
             uid=None, extra={"OEBPS/pic.png": png(30, 40, (90, 90, 90))})
    # Narrated books (Media Overlays, REVIEW.md T-3): three paragraphs, each a clip of one recording, then a
    # second chapter without narration. B has the same audio path with a longer recording (REVIEW.md M-17).
    def narrated(dst, title, uid, clip, after="<h1>After</h1><p>Not narrated.</p>", extra_files=None):
        wav(books / "narration.wav", 3 * clip)
        narr = [("c1.xhtml", "Narrated", '<h1>Narrated</h1><p id="n1">First narrated paragraph.</p><p id="n2">Second narrated paragraph.</p>'
                 '<p id="n3">Third narrated paragraph.</p><p id="unnarrated">Not narrated, after the last clip.</p>'), ("c2.xhtml", "After", after)]
        smil = ('<?xml version="1.0" encoding="utf-8"?><smil xmlns="http://www.w3.org/ns/SMIL" version="3.0"><body><seq>'
                + "".join(f'<par id="p{i}"><text src="c1.xhtml#n{i}"/><audio src="narration.wav" clipBegin="{(i - 1) * clip:.1f}s" clipEnd="{i * clip:.1f}s"/></par>' for i in (1, 2, 3))
                + '</seq></body></smil>')
        epub(books / "narrated-src.epub", title, narr, uid=uid,
             extra={"OEBPS/c1.smil": smil.encode(), "OEBPS/narration.wav": (books / "narration.wav").read_bytes(), **(extra_files or {})})
        edited(books / "narrated-src.epub", books / dst,
               lambda o: o.replace('<item id="c0" href="c1.xhtml"', '<item id="c0" media-overlay="mo1" href="c1.xhtml"')
                          .replace("</manifest>", '<item id="mo1" href="c1.smil" media-type="application/smil+xml"/></manifest>')
                          .replace("</metadata>", f'<meta property="media:duration">0:00:0{3 * clip:.1f}</meta><meta property="media:active-class">now-reading</meta></metadata>'))
        (books / "narrated-src.epub").unlink(); (books / "narration.wav").unlink()
    narrated("narrated.epub", "Narrated Book", "urn:narrated", 0.6)
    narrated("narrated-b.epub", "Narrated Book B", "urn:narrated-b", 2.0)
    # (T-20, L-93) Narration followed by a page with only a picture.
    narrated("narrated-pic.epub", "Narrated Pic", "urn:narrated-pic", 0.6, after='<p><img src="pic.png" alt=""/></p>', extra_files={"OEBPS/pic.png": png(40, 30, (90, 90, 200))})
    edited(books / "twin-a.epub", books / "twin-a-uid.epub",
           lambda o: o.replace('version="3.0">', 'version="3.0" unique-identifier="uid">')
                      .replace('<dc:title>', '<dc:identifier id="uid">urn:twin-a-given</dc:identifier><dc:title>'))
    shutil.copy(books / "long.epub", shelf / "shelf-only.epub")
    shutil.copy(books / "long.epub", books / "50%off.epub")   # a "%" in the name (REVIEW.md M-1)
    with zipfile.ZipFile(books / "long.epub") as z:
        z.extractall(shelf / "shelf-dir")

    # A book that tries to reach another site in every way a page can, plus links of every kind.
    pic = png(40, 30, (200, 60, 60))
    hostile = f"""<h1>Hostile</h1>
<p>Remote image: <img id="remote-img" src="{REMOTE}/pixel.png" alt="r"/></p>
<p>Inside the book: <img id="local-img" src="pic.png" alt="l"/> and data: <img id="data-img" alt="d" src="data:image/png;base64,{__import__('base64').b64encode(pic).decode()}"/></p>
<p style="background: url('{REMOTE}/inline-bg.png')">Inline style background.</p>
<link rel="stylesheet" href="{REMOTE}/body-link.css"/>
<audio id="aud" autoplay="autoplay" src="{REMOTE}/sound.mp3"></audio>
<video id="vid" poster="{REMOTE}/poster.png"></video>
<p><a id="ping-link" href="c2.xhtml" ping="{REMOTE}/ping">In-book link with a ping</a></p>
<p><a id="web-link" href="https://example.com/">A web link</a></p>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="120" height="60">
  <image xlink:href="{REMOTE}/svg-image.png" width="10" height="10"/>
  <a id="svg-in" xlink:href="c2.xhtml"><rect x="0" y="0" width="50" height="50" fill="green"/></a>
  <a id="svg-out" xlink:href="https://example.com/svg"><rect x="60" y="0" width="50" height="50" fill="blue"/></a>
</svg>
<img src="pic.png" usemap="#m" alt="map" width="40" height="30"/>
<map name="m"><area id="area-in" shape="rect" coords="0,0,20,30" href="c2.xhtml" alt="in"/>
<area id="area-out" shape="rect" coords="20,0,40,30" href="https://example.com/area" alt="out"/></map>
<p class="x">Styled from the head.</p><p style="font-family: Remote">Remote font.</p>
<style>@import "inject.css";</style><p id="after-style">After the body style.</p>
<p><object data="missing-object.svg" type="image/svg+xml"><param name="x" value="y"/><img id="object-fallback" src="pic.png" alt="fallback"/></object></p>
<table id="bg-table" background="pic.png"><tr><td>cell</td></tr></table>
<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><use id="sprite-use" href="pic.png#frag"/><rect id="paint" width="5" height="5" fill="url({REMOTE}/paint.svg#g) red"/></svg>
<div id="shadow-host"><template shadowrootmode="open"><a id="shadow-link" href="https://example.com/shadow">Shadow link</a></template></div>
<p id="str-url">A url( inside a CSS string stays text.</p>
<p class="ws2">After a url( with many spaces.</p><p class="lc">Line continuation inside an address.</p><p class="cm">Quote in a comment.</p><p class="cm2">Comment in url(.</p>
<p id="escapes" style="font-family: '""" + "\\4e2d\\6587" * 16 + """', serif">Many escapes in a row (REVIEW.md: this once froze the page).</p>"""
    # Ways around pattern matching (REVIEW.md H-1, H-2, L-1, L-2), each aimed at both other sites.
    for i, host in enumerate((REMOTE, BLOCKED)):
        hostile += f"""
<p><img class="bypass" src="{host.replace('http:', '')}/protocol-relative.png" alt="pr"/>
<img class="bypass" src="ht&#9;{host[2:]}/tab-in-scheme.png" alt="tab"/>
<IMG class="bypass" SRC="{host}/upper-xhtml.png" alt="up"/></p>
<IFRAME id="upper-iframe-{i}" SRC="{host}/upper-iframe"></IFRAME>
<p style="background: URL({host}/inline-upper.png)">Upper-case URL(</p>
<p style="background-image: image-set('{host}/image-set.png' 1x)">image-set</p>
<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><image width="10" height="10"><set attributeName="href" to="{host}/smil.png" begin="0s"/></image></svg>
<p style="background-image: image-set(linear-gradient(red, rgb(0,0,0)) 1x, '{host}/nested-image-set.png' 2x)">nested image-set</p>
<p style="background-image: im\\61ge-set('{host}/escaped-image-set.png' 1x)">escaped image-set</p>
<p style="background-image: u\\72l({host}/escaped-url.png)">escaped url(</p>
<p style="background-image: url('\\00005c\\00005c{host[7:]}/double-escape.png')">double escape</p>
<p class="cursor-remote" style="cursor: url({host}/cursor.cur), pointer">remote cursor</p>"""
    hostile += f"""
<BASE href="{REMOTE}/base/"/>
<META http-equiv="refresh" content="1;url={REMOTE}/refresh"/>
<meta content="1;url={REMOTE}/refresh?a>b" http-equiv="refresh"/>
<h:base xmlns:h="http://www.w3.org/1999/xhtml" href="{REMOTE}/prefixed-base/"/>
<p id="cursor-missing" style="cursor: url(missing.cur), pointer">missing cursor</p>
<p><img class="bypass" src="missing-local.png" alt="missing"/></p>"""
    style = f"""<style>@import url("{REMOTE}/imported.css"); @import"{BLOCKED}/import-no-space.css";
@import u\\72l(a"b); @\\69mport "{REMOTE}/after-escaped-url.css";
@import url(a\\)"); @\\69mport "{BLOCKED}/after-escaped-paren.css";
@import "{REMOTE}/semi;colon.css";
@import "{REMOTE}/line-continued\\
.css"; @\\69mport "{BLOCKED}/escaped-at-import.css";
.lc {{ background: url("{REMOTE}/line-continued\\
.png") }}
.cm {{ background-image: image-set(/*"*/"{REMOTE}/comment-quote.png" 1x) }}
.cm2 {{ background: url(/*x*/"{REMOTE}/comment-before.png") }}
.ws {{ cursor: url(                                            a") }} .ws2 {{ background-image: image-set(/*"*/"{REMOTE}/after-spaces.png" 1x) }}
.x {{ background: url({REMOTE}/style-bg.png); border: 30px solid; border-image: URL({BLOCKED}/upper-url.png) 30 }}
.x::after {{ content: "x"; background: url(\\68ttp://blocked.example/escaped.png) }}
@font-face {{ font-family: Remote; src: url("{REMOTE}/font.woff2") }}
#str-url::before {{ content: "see url(missing-in-string.png) " }}
.many-escapes {{ content: "\\aaaaaa\\aaaaaa\\aaaaaa\\aaaaaa\\aaaaaa\\aaaaaa\\aaaaaa\\aaaaaa\\aaaaaa\\aaaaaa\\aaaaaa\\aaaaaa\\aaaaaa\\aaaaaa\\aaaaaa\\aaaaaa\\aaaaaa\\aaaaaa\\aaaaaa\\aaaaaa\\aaaaaa\\aaaaaa\\aaaaaa\\aaaaaa\\aaaaaa\\aaaaaa\\aaaaaa\\aaaaaa\\aaaaaa\\aaaaaa" }}</style><style>@import "{BLOCKED}/no-semicolon-at-end.css"</style>"""
    epub(books / "hostile.epub", "Hostile Book", [("c1.xhtml", "Hostile", hostile, style),
                                                  ("c2.xhtml", "Target", "<h1>Target chapter</h1><p>Arrived.</p>")],
         uid="urn:hostile", extra={"OEBPS/pic.png": pic,
         # (M-13) an imported sheet that tries to close the body <style> and add markup after it
         "OEBPS/inject.css": b'x{color:red}</style><a id="injected" target="_blank" href="https://example.com/inj">injected</a><style>'})
    # An HTML page (parsed as HTML, so attributes can be unquoted) with document controls the pre-parse
    # stripping must catch (REVIEW.md L-24, T-9).
    (books / "controls.html").write_text(f"""<!doctype html><html><head><title>Controls</title>
<base href={REMOTE}/unquoted'base/>
<meta content="1;url={REMOTE}/refresh?a>b" http-equiv=refresh>
<META HTTP-EQUIV="refresh" CONTENT="1;url={REMOTE}/upper">
<meta name="http-equiv" content="kept">
</head><body><h1>Controls</h1><base-card>Custom element kept.</base-card><p>Don't stop here.</p>
<p><a id="c0-link" href="&#1;{REMOTE}/c0">control character first</a> <a id="pct-frag" href="#100%">percent fragment</a></p>
<p>An unclosed tag that once froze the page follows.</p><base""" + " = a" * 40 + "\n")
    with zipfile.ZipFile(books / "hostile.epub") as z:   # also as an extracted folder: its files come from the site
        z.extractall(books / "hostile-dir")

    # Documents.
    # (E-21) A long Markdown document, for keeping the editor's text and page together, and an HTML page with
    # what the cleaning removes (kept by the editor) and a stale charset.
    (books / "long-notes.md").write_text("# Long notes\n\n" + "".join(f"## Part {k}\n\n" + "".join(f"Paragraph {j} of part {k}, with enough words to wrap across a line or two in the page.\n\n" for j in range(1, 6)) for k in range(1, 31)))
    (books / "kept.html").write_text('<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="windows-1252">\n<title>Kept</title>\n</head>\n<body>\n<h1>Kept</h1>\n<p onclick="alert(1)">Text.</p>\n<script>window.parent.__ran = true;</script>\n<form action="/x"><input name="q"></form>\n</body>\n</html>\n')
    (books / "corpus.md").write_text('# Title with *emphasis*\n\nParagraph with **strong**, *em*, ~~del~~, `code`, a [link](https://example.com "T"), and ![pic](pic.png "P").\nA second line in the same paragraph.\\\nHard break above. Characters: 2 * 3, snake_case, [brackets], a < b and c > d, a | pipe, &amp; and 1. not a list.\n\n## Lists\n\n- one\n- two\n  - nested\n- three\n\n1. first\n2. second\n\n- [ ] task open\n- [x] task done\n\n> A quote\n> with two lines\n>\n> and a second paragraph\n\n```js\nconst x = `y`;\n```\n\n    indented code\n\n---\n\n| Left | Center | Right |\n| :--- | :---: | ---: |\n| a | b | c |\n| `x` | **y** | z\\|w |\n\n<div class="raw">Raw <b>HTML</b> block</div>\n\nFinal paragraph with <span class="k">inline html</span>.\n')
    # (Round 24 review) Documents for the editor's write-back: kept elements in an SVG and a table, <body in a
    # comment and an attribute, a leading rule, a wrapper, comments, markup after </body>, a fragment, XHTML,
    # Markdown escapes, metas, a document's own data-ed-keep, a <pre> starting with blank lines.
    (books / 'svg-table.html').write_text('<!DOCTYPE html>\n<html>\n<head><title>Svg</title></head>\n<body>\n<p>Start.</p>\n<svg viewBox="0 0 10 10"><defs><style>.c{fill:red}</style></defs><rect class="c" width="5" height="5"/><circle r="2"/></svg>\n<table><tr><td>a</td></tr><script>var x=1</script><tr><td>b</td></tr></table>\n</body>\n</html>\n')
    (books / 'trap.html').write_text('<!DOCTYPE html>\n<html>\n<head><title>The &lt;body&gt; tag</title><!-- put <body class="x"> here --></head>\n<body data-x="a>b">\n<p>Start.</p>\n</body>\n</html>\n')
    (books / 'hr.md').write_text('***\n\nIntro text\n\n***\n\nBody\n')
    (books / 'wrap.md').write_text('<div align="center">\n\n# Centered\n\nStart.\n\n</div>\n')
    (books / 'comments.html').write_text('<!DOCTYPE html>\n<html>\n<head><title>C</title></head>\n<body>\n<!-- keep me -->\n<p>Start.</p>\n<div class="w"><!-- section A --><p>In.</p></div>\n</body>\n</html>\n')
    # Round 25 review (reviewer 3's cases): text with one paragraph per line (M-122); one huge paragraph and a huge
    # verse block (L-286); an SVG file used as a resource document (L-287); names that hide the page's methods (L-288).
    rnd = random.Random(1)
    words = ["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta"]
    paras = [f"Paragraph {i}. " + " ".join(rnd.choice(words) for _ in range(rnd.randint(60, 110))) + "." for i in range(400)]
    (books / "oneline-paras.txt").write_text("Chapter 1\n" + "\n".join(paras[:200]) + "\nChapter 2\n" + "\n".join(paras[200:]) + "\n")
    (books / "oneline.txt").write_text(". ".join(" ".join(rnd.choice(words) for _ in range(12)) for _ in range(9000)) + ".")
    (books / "verse.txt").write_text("\n".join(" ".join(rnd.choice(words) for _ in range(4)) for _ in range(30000)))
    ext_svg = f'''<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="100" height="100">
<style>@import url("{REMOTE}/svgdoc-import.css"); rect {{ fill: url({REMOTE}/svgdoc-cssfill.svg#g) }}</style>
<defs><filter id="f"><feImage href="{REMOTE}/svgdoc-feimage.png"/></filter>
<mask id="m"><image href="{REMOTE}/svgdoc-mask-image.png" width="100" height="100"/></mask>
<clipPath id="c"><rect width="50" height="50"/></clipPath>
<g id="a"><image href="{REMOTE}/svgdoc-use-image.png" width="10" height="10"/><image xlink:href="{REMOTE}/svgdoc-use-ximage.png" width="10" height="10"/><rect width="10" height="10" style="fill:url({REMOTE}/svgdoc-stylefill.svg#q)" onclick="x()"/><circle r="5" fill="green"/></g>
</defs><use href="#a"/><script>parent.__svg = 1</script></svg>'''
    svg_page = xhtml("SVG ext", '''<h1>SVG ext</h1>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="100" height="100"><use href="ext.svg#a"/></svg>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="100" height="100"><use xlink:href="ext.svg#a"/></svg>
<div style="width:50px;height:50px;background:red;filter:url(ext.svg#f)">f</div>
<div style="width:50px;height:50px;background:red;mask:url(ext.svg#m)">m</div>
<div style="width:50px;height:50px;background:red;clip-path:url(ext.svg#c)">c</div>
<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="50" height="50" fill="url(ext.svg#a)"/><rect width="50" height="50" filter="url(ext.svg#f)"/></svg>
<p>done</p>''')
    epub_items(books / "svgext.epub", "SVG ext", [("c1", "c1.xhtml", "application/xhtml+xml", ""), ("ext", "ext.svg", "image/svg+xml", "")], ["c1"],
               {"c1.xhtml": svg_page, "ext.svg": ext_svg}, "urn:svgext")
    with zipfile.ZipFile(books / "svgext.epub") as z:
        z.extractall(books / "svgext")
    pic = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC")
    epub_items(books / "clobber.epub", "Clobber", [("c1", "c1.xhtml", "application/xhtml+xml", ""), ("c2", "c2.xhtml", "application/xhtml+xml", ""), ("p", "pic.png", "image/png", "")], ["c1", "c2"],
               {"c1.xhtml": xhtml("Clobber", '<h1>Clobber</h1><img name="getElementById" src="pic.png" alt="g"/><img name="createRange" src="pic.png" alt="g"/><form name="fonts"></form><p id="addEventListener">Some text here for reading.</p><p id="content">Kept id.</p>'),
                "c2.xhtml": xhtml("Two", "<h1>Two</h1><p>Second.</p>"), "pic.png": pic}, "urn:clobber")
    # Round 25 review, loop 2: unwrapped text with blank lines, a stanza and a two-line heading (M-125); hard-wrapped
    # text whose paragraphs are marked by indentation (L-294); a huge paragraph without spaces (L-293); SVG files in
    # Latin-1 and with a stylesheet instruction and href animations (L-291, L-292); a folder book listing a remote
    # file and a missing one (M-124).
    longp = [f"Paragraph {i}. " + " ".join(rnd.choice(words) for _ in range(40)) + "." for i in range(30)]
    (books / "unwrapped-blank.txt").write_text("CHAPTER ONE\nThe Arrival\n\n" + "\n\n".join(longp[:10]) + "\n\nRoses are red\n  violets are blue\nsugar is sweet\n\n" + "\n\n".join(longp[10:]) + "\n")
    ind = []
    for i in range(60):
        words_ = (f"Para{i} " + " ".join(rnd.choice(words) for _ in range(rnd.randint(40, 70))) + ".").split()   # (ending a sentence, as paragraphs do)
        lines, line = [], "    "
        for w in words_:
            if len(line) + len(w) > 108: lines.append(line.rstrip()); line = ""
            line += w + " "
        lines.append(line.rstrip())
        ind.append("\n".join(lines))
    (books / "indented.txt").write_text("\n".join(ind) + "\n")
    (books / "cjk.txt").write_text("".join("これは長い段落の文です" + str(i % 10) + "。" for i in range(9000)))
    svg_l1 = '<?xml version="1.0" encoding="ISO-8859-1"?>\n<?xml-stylesheet href="' + REMOTE + '/svgpi.css" type="text/css"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><g id="a"><text y="20">Caf\u00e9</text><a href="#x"><set attributeName="href" to="' + REMOTE + '/svgset.png"/><animate attributeName="xlink:href" values="' + REMOTE + '/svganim.png"/></a></g></svg>'
    epub_items(books / "svgenc.epub", "SVG enc", [("c1", "c1.xhtml", "application/xhtml+xml", ""), ("ext", "ext.svg", "image/svg+xml", "")], ["c1"],
               {"c1.xhtml": xhtml("SVG enc", '<h1>SVG enc</h1><svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><use href="ext.svg#a"/></svg>'), "ext.svg": svg_l1.encode("latin-1")}, "urn:svgenc")
    shutil.copytree(books / "abc", books / "abc-extra")
    opf_p = books / "abc-extra" / "OEBPS" / "content.opf"
    opf_p.write_text(opf_p.read_text().replace("</manifest>", '<item id="remote" href="https://example.com/clip.mp4" media-type="video/mp4"/><item id="gone" href="gone.png" media-type="image/png"/></manifest>'))
    # Round 25 review, loop 3: text shapes the parting must keep: indented paragraphs with chapter headings set off
    # by blank lines; unwrapped text with some lines indented; unwrapped text with scene breaks and short lines.
    def wrap_lines(text, width=70, ind=""):
        out, line = [], ind
        for w in text.split():
            if len(line) + len(w) + 1 > width and line.strip(): out.append(line); line = ""
            line += (" " if line and line != ind else "") + w
        out.append(line)
        return out
    sent = lambda: " ".join(rnd.choice(words) for _ in range(rnd.randint(6, 18))).capitalize() + "."
    rows = []
    for c in ["I", "II", "III", "IV", "V"]:
        rows += ["", f"CHAPTER {c}", ""]
        for _ in range(15): rows += wrap_lines(" ".join(sent() for _ in range(5)), 70, "    ")
    (books / "indent-heads.txt").write_text("\n".join(rows) + "\n")
    (books / "unwrapped-indent.txt").write_text("\n".join(("    " if i % 10 == 3 else "") + " ".join(sent() for _ in range(1 + i % 3)) for i in range(100)) + "\n")
    rows = []
    for s in range(8):
        rows += ['"Yes," he said.' if p % 3 == 1 else " ".join(sent() for _ in range(3)) for p in range(12)] + [""]
    (books / "unwrapped-scenes.txt").write_text("\n".join(rows))
    # Round 25 review, loop 3: a picture declared text/html with a script in it (H-30); nested attr( in a book's CSS
    # (M-129); an animation setting a link's address (L-303); an archive whose files share their data (L-304).
    pic_html = png(4, 4, (200, 30, 30))
    i_end = pic_html.rindex(b"IEND") - 4
    chunk = b"tEXt" + b"c\x00<script>document.title='PWNED'</script>"
    pic_html = pic_html[:i_end] + struct.pack(">I", len(chunk) - 4) + chunk + struct.pack(">I", zlib.crc32(chunk)) + pic_html[i_end:]
    epub_items(books / "typed-pic.epub", "Typed Pic", [("c1", "c1.xhtml", "application/xhtml+xml", ""), ("p", "pic.png", "text/html", "")], ["c1"],
               {"c1.xhtml": xhtml("Typed Pic", '<h1>Typed Pic</h1><p><img src="pic.png" alt="a picture"/></p>'), "pic.png": pic_html}, "urn:typed-pic")
    nested = "attr(x " * 12000
    epub_items(books / "attr-nest.epub", "Attr Nest", [("c1", "c1.xhtml", "application/xhtml+xml", "")], ["c1"],
               {"c1.xhtml": xhtml("Attr Nest", "<h1>Attr Nest</h1><p>Still here.</p>", f"<style>h1 {{ color: {nested}{')' * 12000} }}</style><style>p {{ color: {nested} }}</style>")}, "urn:attr-nest")
    epub_items(books / "set-href.epub", "Set Href", [("c1", "c1.xhtml", "application/xhtml+xml", "")], ["c1"],
               {"c1.xhtml": xhtml("Set Href", f'<h1>Set Href</h1><svg xmlns="http://www.w3.org/2000/svg" width="200" height="40"><a target="_blank"><set attributeName="href" to="{REMOTE}/sneaky"/><text y="20">Click</text></a></svg>')}, "urn:set-href")
    with zipfile.ZipFile(books / "overlap.epub", "w") as z:
        z.writestr(zipfile.ZipInfo("mimetype"), "application/epub+zip")
        z.writestr("META-INF/container.xml", '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="a.opf" media-type="application/oebps-package+xml"/></rootfiles></container>')
        z.writestr("a.opf", "x" * 100)
        z.writestr("b.opf", "y" * 100)
    data = bytearray((books / "overlap.epub").read_bytes())
    cd = data.rindex(b"PK\x01\x02b.opf"[:4] + b"")  # (the last central entry: b.opf)
    data[cd + 42:cd + 46] = data[data.rindex(b"PK\x01\x02", 0, cd) + 42:data.rindex(b"PK\x01\x02", 0, cd) + 46]   # (points at a.opf's data)
    (books / "overlap.epub").write_bytes(bytes(data))
    # Round 25 review, loop 4: the text shapes the reviewer wrote (tests/text-shapes/); an XHTML page typed as SVG
    # (H-31) and an SVG typed with a parameter (L-317); a book whose identifier names a document's position key
    # (L-311); files the nginx example sandboxes (M-131).
    for f in (REPO / "tests" / "text-shapes").glob("*.txt"):
        shutil.copy(f, books / f.name)
    fake_svg = '<html xmlns="http://www.w3.org/1999/xhtml"><body><form action="javascript:parent.document.title=\'PWNED\'"><button>Go</button></form></body></html>'
    real_svg = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="green"/></svg>'
    epub_items(books / "svg-typed.epub", "SVG Typed", [("c1", "c1.xhtml", "application/xhtml+xml", ""), ("fake", "fake.svg", "image/svg+xml", ""), ("real", "real.svg", "image/svg+xml; charset=utf-8", "")], ["c1"],
               {"c1.xhtml": xhtml("SVG Typed", '<h1>SVG Typed</h1><p><img id="fake" src="fake.svg" alt="fake"/><img id="real" src="real.svg" alt="real"/></p>'), "fake.svg": fake_svg, "real.svg": real_svg}, "urn:svg-typed")
    epub(books / "uid-clash.epub", "Uid Clash", [("c1.xhtml", "One", "<h1>One</h1>" + paragraphs("Clash", 12)), ("c2.xhtml", "Two", "<h1>Two</h1><p>Two.</p>")], uid="url:/reader/books/notes.md")
    (books / "sandboxed").mkdir()
    for name in ("index.html", "page.shtml", "feed.rss", "pic.svgz", "style.xsl"):
        (books / "sandboxed" / name).write_text("<p>x</p>")
    # Round 25 review, loop 5: a folder book with an SVG and an HTML file typed as pictures (M-135); a long front-matter
    # line (M-136); an HTML fragment opening with many comments (L-321); a long code span (L-322); many unclosed
    # <meta (L-323); an archive where one file's data holds another file (T-49, for the whole-file reader).
    epub_items(books / "pic-typed.epub", "Pic Typed", [("c1", "c1.xhtml", "application/xhtml+xml", ""), ("s", "pic.svg", "image/png", ""), ("h", "pic.html", "image/png", "")], ["c1"],
               {"c1.xhtml": xhtml("Pic Typed", '<h1>Pic Typed</h1><p><img id="s" src="pic.svg" alt="s"/><img id="h" src="pic.html" alt="h"/></p>'),
                "pic.svg": '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><script>parent.document.title="PWNED"</script><rect width="20" height="20" fill="blue"/></svg>',
                "pic.html": "<script>document.title=\'PWNED\'</script>"}, "urn:pic-typed")
    with zipfile.ZipFile(books / "pic-typed.epub") as z:
        z.extractall(books / "pic-typed")
    (books / "frontmatter-long.md").write_text("---\ntitle: x" + " " * 300000 + "y\n---\n\nStart.\n")
    (books / "many-comments.html").write_text("<!---->" * 30 + "<p>Start.</p>")
    (books / "long-code.md").write_text("Start.\n\n`" + "a " * 60000 + "b`\n")
    (books / "many-meta.html").write_text("<p>Start.</p>" + "<meta " * 30000)
    def local(name, data):
        return struct.pack("<IHHHHHIIIHH", 0x04034b50, 20, 0, 0, 0, 0, zlib.crc32(data), len(data), len(data), len(name), 0) + name + data
    def central(name, data, off):
        return struct.pack("<IHHHHHHIIIHHHHHII", 0x02014b50, 20, 20, 0, 0, 0, 0, zlib.crc32(data), len(data), len(data), len(name), 0, 0, 0, 0, 0, off) + name
    inner = local(b"b.txt", b"hello")
    outer = local(b"a.txt", inner)
    cd = central(b"a.txt", inner, 0) + central(b"b.txt", b"hello", 30 + 5)
    (books / "nested.zip.epub").write_bytes(outer + cd + struct.pack("<IHHHHIIH", 0x06054b50, 0, 0, 2, 2, len(cd), len(outer), 0))
    # Round 25 review, loop 5's review: right-to-left text (dir on the html element, and direction in a stylesheet),
    # long enough for several pages; vertical text.
    ar = " ".join(["هذا نص عربي طويل للاختبار في القارئ"] * 12)
    for name, html_dir, css in (("rtl-text", ' dir="rtl"', ""), ("rtl-css", "", "<style>body{direction:rtl}</style>")):
        chap = f'<?xml version="1.0" encoding="utf-8"?>\n<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="ar"{html_dir}><head><title>t</title>{css}</head><body><h1>فصل</h1>' + "".join(f"<p id=\'p{i}\'>{i}. {ar}</p>" for i in range(60)) + "</body></html>"
        epub_items(books / f"{name}.epub", name, [("c1", "c1.xhtml", "application/xhtml+xml", ""), ("c2", "c2.xhtml", "application/xhtml+xml", "")], ["c1", "c2"],
                   {"c1.xhtml": chap, "c2.xhtml": xhtml("Two", "<h1>Two</h1><p>Second.</p>")}, f"urn:{name}")
    vert = "".join(f"<p>{i}。これは縦書きの文章です。" + "文章" * 40 + "</p>" for i in range(40))
    epub_items(books / "vertical.epub", "Vertical", [("c1", "c1.xhtml", "application/xhtml+xml", "")], ["c1"],
               {"c1.xhtml": xhtml("Vertical", f"<h1>縦</h1>{vert}", "<style>html{writing-mode:vertical-rl}</style>", "ja")}, "urn:vertical")
    # Round 25 review, loop 6: documents linking to each other (M-141); a link far down a chapter (M-142); unclosed
    # "<" in a leading chapter (M-143); unclosed comments after a document's body (L-336); an unlisted XML type
    # (L-338); a picture typed with spaces and capitals (L-339).
    (books / "linkdoc").mkdir()
    (books / "linkdoc" / "a.html").write_text('<!DOCTYPE html><html><head><title>Doc A</title></head><body><h1>Doc A</h1><p><a id="tob" href="b.html#sec">to B</a> <a id="tomd" href="c.md">to C</a></p></body></html>')
    (books / "linkdoc" / "b.html").write_text('<!DOCTYPE html><html><head><title>Doc B</title></head><body><h1>Doc B</h1>' + "".join(f"<p>Filler {i}.</p>" for i in range(80)) + '<h2 id="sec">Section</h2><p>Here.</p></body></html>')
    (books / "linkdoc" / "c.md").write_text("# Doc C\n\nMarkdown.\n")
    # Links that look like the document's own but resolve to "//another.host/…" (round 26 review, H-34).
    (books / "linkdoc" / "d.html").write_text('<!DOCTYPE html><html><head><title>Doc D</title></head><body><h1>Doc D</h1><p>'
        '<a id="x1" href=".///evil.example/spoof.html">one</a> <a id="x2" href=".\\\\evil.example/spoof.md">two</a> '
        '<a id="x3" href="a/..///evil.example/x.txt">three</a> <a id="x4" href=".///evil.example:8443/p.html">four</a></p></body></html>')
    epub(books / "far-link.epub", "Far Link", [("c1.xhtml", "One", "<h1>One</h1>" + paragraphs("Far", 30) + '<p><a id="far" href="c2.xhtml">far link</a></p>'), ("c2.xhtml", "Two", "<h1>Two</h1><p>Two.</p>")], uid="urn:far-link")
    epub_items(books / "lt-bomb.epub", "Lt Bomb", [("c1", "c1.xhtml", "application/xhtml+xml", ""), ("c2", "c2.xhtml", "application/xhtml+xml", "")], ["c1", "c2"],
               {"c1.xhtml": "<html><body><p>x</p><p>" + "< " * 600000, "c2.xhtml": xhtml("Two", "<h1>Two</h1><p>Two.</p>")}, "urn:lt-bomb")
    (books / "comment-bomb.html").write_text("<!DOCTYPE html><html><body><p>Start.</p></body>" + "<!--<" * 60000 + "</html>")
    (books / "sandboxed" / "page.xpdl").write_text("<p>x</p>")
    epub_items(books / "odd-type.epub", "Odd Type", [("c1", "c1.xhtml", "application/xhtml+xml", ""), ("p", "pic.png", "IMAGE/PNG ", "")], ["c1"],
               {"c1.xhtml": xhtml("Odd Type", '<h1>Odd</h1><p><img src="pic.png" alt="p"/></p>'), "pic.png": png(4, 4, (10, 200, 10))}, "urn:odd-type")
    # Round 25 review: link text with "]" (M-117); a CRLF file (M-118); a fragment whose script names <body> (L-283).
    (books / 'bracket.md').write_text('Start.\n\nSee [a\\]b](http://x.com) now and ![c\\]d](p.png).\n')
    (books / 'crlf.md').write_bytes(b'# CRLF\r\n\r\nStart.\r\n\r\nSecond line.\r\n')
    (books / 'frag-script.html').write_text('<h1>T</h1><p>Start.</p><script>var s="<body>";</script><p>y</p>')
    (books / 'comments.md').write_text('<!-- comment -->\n\nStart.\n\npara <!-- inline --> more\n\n- a\n- b\n\n<!-- end list -->\n\n- c\n')
    (books / 'after.html').write_text('<!DOCTYPE html>\n<html>\n<head><title>A</title></head>\n<body>\n<p>Start.</p>\n</body>\n<script>track()</script>\n</html>\n')
    (books / 'frag.html').write_text('<!-- note -->\n<style>p{color:red}</style>\n<p>Start.</p>\n')
    (books / 'doc.xhtml').write_text('<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml">\n<head><title>X</title></head>\n<body>\n<p>Start.<br/>Line.</p>\n<div id="anchor"/>\n<p>after</p>\n</body>\n</html>\n')
    (books / 'corpus2.md').write_text('Hey\\![link](http://a.com)\n\n## Item \\#\n\n\\---\n\nline one\\\n\\---\n\n<sup>2\\*3\\*4</sup>\n\n<em>a</em><em>b</em> and a<em>"b"</em>c\n\n- a\n- b\n\n\n* c\n* d\n\n0. zero\n1. one\n\n| h |\n| --- |\n| x<br>y |\n\nx&nbsp;y\n\nStart.\n')
    (books / 'meta.html').write_text('<!DOCTYPE html>\n<html>\n<head>\n<!-- <meta charset="iso-8859-2"> -->\n<meta name="description" content="How to set charset=latin1 in Apache" data-charset="x">\n<meta charset="windows-1252">\n<title>M</title>\n</head>\n<body>\n<p>Start.</p>\n</body>\n</html>\n')
    (books / 'keepattr.html').write_text('<!DOCTYPE html>\n<html>\n<head><title>K</title></head>\n<body>\n<p data-ed-keep="0">Important text</p>\n<script>s()</script>\n<p>Start.</p>\n<pre>\n\nfirst</pre>\n</body>\n</html>\n')
    # (Round 24 review, loop 2) More write-back cases.
    (books / 'wrapscript.html').write_text('<!DOCTYPE html>\n<html>\n<head><title>W</title></head>\n<body>\n<div class="wrap">\n<p>Start.</p>\n<p>Two</p>\n</div>\n<script>console.log(1)</script>\n</body>\n</html>\n')
    (books / 'wrapscript.md').write_text('<div class="x">\n\nStart. text\n\n</div>\n\n<!-- keep me -->\n\n<script>a()</script>\n')
    (books / 'minimal.html').write_text('<!DOCTYPE html>\n<meta charset="utf-8">\n<title>T</title>\n<p>Start.</p>\n')
    (books / 'dotted.html').write_text('<!DOCTYPE html>\n<html>\n<head><title>İİİİİİİİİİİİİİİİİİİİİİİİİİİİİİİİİİİİİİİİ</title>\n<meta name=d content=Bob\'s>\n</head>\n<body>\n<p>Start.</p>\n<script>document.write(\'<meta charset="iso-8859-1">\')</script>\n</body>\n</html>\n')
    (books / 'after2.html').write_text('<!DOCTYPE html>\n<html>\n<head><title>A</title></head>\n<body>\n<p>Start.</p>\n</body>\n<!-- generated by tool -->\n<script>track()</script>\n</html>\n<!-- trailing -->\n')
    (books / 'ns.xhtml').write_text('<?xml version="1.0" encoding="utf-8"?>\n<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">\n<head><title>N</title></head>\n<body>\n<section epub:type="chapter"><p>Start.</p></section>\n<script type="text/javascript">var a = 1;</script>\n</body>\n</html>\n')
    (books / 'plainish.md').write_text('Some snake_case_names, a > b, 5 < 6, a|b, 2 * 3 and un*believ*able.\n\n*-*\n\nStart.\n')
    (books / 'noscript.html').write_text('<!DOCTYPE html>\n<html>\n<head><title>N</title>\n<noscript><body class="nojs"></noscript>\n</head>\n<body>\n<p>Start.</p>\n</body>\n</html>\n')
    (books / 'backslash.md').write_text('Path C:\\\\*x* here and D:\\\\[link](u.md) and E:\\\\`code`.\n\nStart.\n')
    (books / 'frag2.html').write_text('<!-- c -->\n<!DOCTYPE html>\n<p>Start.</p>\n')
    (books / 'animwrap.html').write_text('<!DOCTYPE html>\n<html>\n<head><title>A</title></head>\n<body>\n<div class="w"><p>Start.</p><p>b</p></div>\n<animate attributeName="x"></animate>\n</body>\n</html>\n')
    (books / 'meta2.html').write_text('<!DOCTYPE html>\n<html>\n<head>\n<meta charset="windows-1252">\n<title>M</title>\n</head>\n<body>\n<p>Start.</p>\n<script>var s = "</script" + "><meta charset=iso-8859-1>";</script>\n</body>\n</html>\n')
    (books / "ids.html").write_text('<!DOCTYPE html>\n<html>\n<head><title>I</title></head>\n<body>\n<h2 id="hh" class="big">Heading</h2>\n<p>Start.</p>\n</body>\n</html>\n')
    (SITE / "nocors").mkdir(exist_ok=True)
    (SITE / "nocors" / "doc.md").write_text("# Not shared\n\nThis site doesn't let other sites read it.\n")
    # (Round 24 review, loop 5) EPUBs for chapter editing: a Calibre-style wrapper, a UTF-16 package, Latin-1 files,
    # an XHTML chapter named .html without a declaration, an encrypted (DRM) chapter, a refined dcterms:modified.
    def raw_epub(name, files, opf="OEBPS/content.opf"):
        with zipfile.ZipFile(books / name, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr(zipfile.ZipInfo("mimetype"), "application/epub+zip")
            z.writestr("META-INF/container.xml", f'<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="{opf}" media-type="application/oebps-package+xml"/></rootfiles></container>')
            for n, d in files.items(): z.writestr(n, d)
    def opf3(title, items, extra_meta="", enc="utf-8"):
        man = "".join(f'<item id="i{k}" href="{h}" media-type="{t}"/>' for k, (h, t) in enumerate(items))
        spine = "".join(f'<itemref idref="i{k}"/>' for k, (h, t) in enumerate(items) if "html" in t)
        return (f'<?xml version="1.0" encoding="{enc}"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="u"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/">'
                f'<dc:identifier id="u">urn:{title}</dc:identifier><dc:title>{title}</dc:title><dc:language>en</dc:language>{extra_meta}</metadata><manifest>{man}</manifest><spine>{spine}</spine></package>')
    chap = lambda body, decl='<?xml version="1.0" encoding="utf-8"?>': f'{decl}<html xmlns="http://www.w3.org/1999/xhtml"><head><title>C</title></head><body>{body}</body></html>'
    # (Round 24 review, loop 6) A package written with an opf: prefix, and one named in another case in container.xml.
    raw_epub("rq-prefix.epub", {"OEBPS/content.opf": '<?xml version="1.0" encoding="utf-8"?><opf:package xmlns:opf="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="u"><opf:metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="u">urn:prefix</dc:identifier><dc:title>Prefixed</dc:title><dc:language>en</dc:language><opf:meta property="dcterms:modified">2000-01-01T00:00:00Z</opf:meta></opf:metadata><opf:manifest><opf:item id="i0" href="c1.xhtml" media-type="application/xhtml+xml"/></opf:manifest><opf:spine><opf:itemref idref="i0"/></opf:spine></opf:package>',
             "OEBPS/c1.xhtml": chap('<h1>Chapter 1</h1><p>Prefixed text.</p>')})
    raw_epub("rq-case.epub", {"OEBPS/content.opf": opf3("Cased", [("c1.xhtml", "application/xhtml+xml")], '<meta property="dcterms:modified">2000-01-01T00:00:00Z</meta>'),
             "OEBPS/c1.xhtml": chap('<h1>Chapter 1</h1><p>Cased text.</p>')}, opf="OEBPS/Content.OPF")
    raw_epub("rv-wrap.epub", {"OEBPS/content.opf": opf3("Wrapped", [("c1.xhtml", "application/xhtml+xml")]),
             "OEBPS/c1.xhtml": chap('<div class="calibre"><h1>Chapter 1</h1><p>Wrapped text.</p></div>')})
    raw_epub("rv-u16.epub", {"OEBPS/content.opf": "﻿".encode("utf-16-le") + opf3("Sixteen", [("c1.xhtml", "application/xhtml+xml")], enc="utf-16").encode("utf-16-le"),
             "OEBPS/c1.xhtml": chap('<h1>Chapter 1</h1><p>Sixteen text.</p>')})
    raw_epub("rv-latin.epub", {"OEBPS/content.opf": opf3("Latin", [("c1.xhtml", "application/xhtml+xml")], '<dc:creator id="c">Brontë</dc:creator><meta refines="#c" property="dcterms:modified">2001-01-01T00:00:00Z</meta><meta property="dcterms:modified">2002-02-02T00:00:00Z</meta>', enc="ISO-8859-1").encode("latin-1"),
             "OEBPS/c1.xhtml": chap('<h1>Chapter 1</h1><p>Un café au lait.</p>', '<?xml version="1.0" encoding="ISO-8859-1"?>').encode("latin-1")})
    raw_epub("rv-html.epub", {"OEBPS/content.opf": opf3("Named html", [("c1.html", "application/xhtml+xml")]),
             "OEBPS/c1.html": chap('<h1>Chapter 1</h1><p>Line one<br/>line two.</p><hr/>', '')})
    raw_epub("rv-drm.epub", {"OEBPS/content.opf": opf3("Locked", [("c1.xhtml", "application/xhtml+xml")]),
             "OEBPS/c1.xhtml": chap('<h1>Chapter 1</h1><p>Pretend this is ciphertext.</p>'),
             "META-INF/encryption.xml": '<?xml version="1.0"?><encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container" xmlns:enc="http://www.w3.org/2001/04/xmlenc#"><enc:EncryptedData><enc:EncryptionMethod Algorithm="http://www.w3.org/2001/04/xmlenc#aes128-cbc"/><enc:CipherData><enc:CipherReference URI="OEBPS/c1.xhtml"/></enc:CipherData></enc:EncryptedData></encryption>'})
    # A chapter of 20 MB of markup in a book of a few tens of KB (round 26 review, H-35).
    epub(books / "huge-chapter.epub", "Huge Chapter", [("c1.xhtml", "One", "<p>Start here.</p>", ""),
         ("c2.xhtml", "Two", "<p>The same line again and again.</p>" * (20 * 1024 * 1024 // 36), "")], uid="urn:huge-chapter")
    # One long section: dozens of pages to turn, for the page-turn drift check (text width margins in fractions of a pixel).
    words = "the keeper walked along the cliffs and counted the boats below in the quiet evening by the harbour lantern".split()
    (books / "drift.md").write_text("# Drift\n\n" + "\n\n".join(f"Paragraph {i}. " + " ".join(words[(i * 7 + k) % len(words)] for k in range(60)) + "." for i in range(400)) + "\n")
    (books / "notes.md").write_text("# Notes\n\nIntro with a [link](#later).\n\n## First\n\nText.\n\n## Later\n\nThe end.\n")
    (books / "plain.txt").write_text("CHAPTER I.\n\nIt was a dark night.\n\nCHAPTER II.\n\nMorning came.\n")
    (shelf / "shelf-page.html").write_text("<!doctype html><html lang='en'><head><title>Shelf Page</title></head><body><h1>Shelf Page</h1><p>Only on the shelf.</p></body></html>")
    (books / "page.html").write_text("<!doctype html><html lang='en'><head><title>Web Page</title></head><body><h1>Web Page</h1><p>Hello.</p></body></html>")

    # Comics: 90 pages in one folder (three sections of 40) and a ComicInfo.xml.
    with zipfile.ZipFile(books / "comic.cbz", "w") as z:
        for i in range(1, 91):
            z.writestr(f"page{i}.png", png(60, 90, ((i * 40) % 255, (i * 90) % 255, (i * 20) % 255)))
        z.writestr("ComicInfo.xml", "<ComicInfo><Title>Test Comic</Title><Series>Tests</Series><Number>1</Number>"
                                    "<Writer>A. Writer</Writer><LanguageISO>en</LanguageISO></ComicInfo>")

    # A fixed-layout book (E-15): pages of 600x800 with their own styles and absolute positions, an SVG page
    # sized by its viewBox, and one page marked reflowable.
    fxl_page = lambda n, colour: xhtml(f"Page {n}", f'<div class="box" style="background:{colour}"></div><p class="cap" id="cap{n}">Fixed page {n} words</p>',
        '<meta name="viewport" content="width=600, height=800"/><style>body{margin:0;background:#fff}.box{position:absolute;left:0;top:0;width:600px;height:400px}'
        '.cap{position:absolute;left:20px;top:700px;font-size:30px;margin:0;color:#000}</style>')
    fxl_opf = """<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid" prefix="rendition: http://www.idpf.org/vocab/rendition/#">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="uid">urn:fxl</dc:identifier><dc:title>Fixed Book</dc:title>
<dc:language>en</dc:language><meta property="rendition:layout">pre-paginated</meta></metadata>
<manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
<item id="p1" href="p1.xhtml" media-type="application/xhtml+xml"/><item id="p2" href="p2.xhtml" media-type="application/xhtml+xml"/>
<item id="p3" href="p3.xhtml" media-type="application/xhtml+xml"/><item id="p4" href="p4.xhtml" media-type="application/xhtml+xml"/></manifest>
<spine><itemref idref="p1"/><itemref idref="p2"/><itemref idref="p3"/><itemref idref="p4" properties="rendition:layout-reflowable"/></spine></package>"""
    with zipfile.ZipFile(books / "fixed.epub", "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr(zipfile.ZipInfo("mimetype"), "application/epub+zip")
        z.writestr("META-INF/container.xml", """<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>""")
        z.writestr("OEBPS/content.opf", fxl_opf)
        z.writestr("OEBPS/nav.xhtml", xhtml("Contents", '<nav epub:type="toc"><ol><li><a href="p1.xhtml">One</a></li><li><a href="p3.xhtml">Three</a></li></ol></nav>'))
        z.writestr("OEBPS/p1.xhtml", fxl_page(1, "#c33"))
        z.writestr("OEBPS/p2.xhtml", fxl_page(2, "#33c"))
        z.writestr("OEBPS/p3.xhtml", xhtml("Page 3", '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300"><rect width="400" height="300" fill="#3c3"/><text x="20" y="150">Drawn page</text></svg>'))
        z.writestr("OEBPS/p4.xhtml", xhtml("Page 4", paragraphs("Reflowed", 6)))
    # (Round 22 review) A fixed page whose own CSS sizes html, pads the body, colours html, places a caption with
    # "body > p", and leaves its text uncoloured on a white body.
    fx2 = xhtml("Styled", '<p class="cap">Styled caption</p><p class="plain">Plain words</p>',
        '<meta name="viewport" content="width=600, height=800"/><style>html{width:600px;height:800px;background:#fdd}'
        'body{padding:50px;background:#fff}body > p.cap{position:absolute;top:700px;left:20px;margin:0;color:#c00}</style>')
    # (Round 22, third review) A fixed page that paints no background of its own.
    epub_items(books / "fixed-plain.epub", "Fixed Plain", [("q1", "q1.xhtml", "application/xhtml+xml", "")], ["q1"],
        {"q1.xhtml": xhtml("Plain", "<p>Unpainted page words</p>", '<meta name="viewport" content="width=600, height=800"/>')}, "urn:fixed-plain")
    with zipfile.ZipFile(books / "fixed-plain.epub") as z0:
        parts = {n: z0.read(n) for n in z0.namelist()}
    parts["OEBPS/content.opf"] = parts["OEBPS/content.opf"].replace(b"</metadata>", b'<meta property="rendition:layout">pre-paginated</meta></metadata>')
    with zipfile.ZipFile(books / "fixed-plain.epub", "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr(zipfile.ZipInfo("mimetype"), parts.pop("mimetype"))
        for n, d in parts.items(): z.writestr(n, d)
    # (Round 22, fourth review) Pages coloured on html with the body left unset, a body with bgcolor, and a body
    # whose background is none.
    vp = '<meta name="viewport" content="width=600, height=800"/>'
    epub_items(books / "fixed-colours.epub", "Fixed Colours", [(f"k{i}", f"k{i}.xhtml", "application/xhtml+xml", "") for i in (1, 2, 3)], ["k1", "k2", "k3"],
        {"k1.xhtml": xhtml("Navy", "<p>Navy page words</p>", vp + "<style>html{background:#036;color:#fff}</style>"),
         "k2.xhtml": xhtml("Bgcolor", "<p>Black page words</p>", vp).replace("<body>", '<body bgcolor="#000000" text="#ffffff">'),
         "k3.xhtml": xhtml("None", "<p>Unpainted words</p>", vp + "<style>body{background:none}</style>")}, "urn:fixed-colours")
    with zipfile.ZipFile(books / "fixed-colours.epub") as z0:
        parts = {n: z0.read(n) for n in z0.namelist()}
    parts["OEBPS/content.opf"] = parts["OEBPS/content.opf"].replace(b"</metadata>", b'<meta property="rendition:layout">pre-paginated</meta></metadata>')
    with zipfile.ZipFile(books / "fixed-colours.epub", "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr(zipfile.ZipInfo("mimetype"), parts.pop("mimetype"))
        for n, d in parts.items(): z.writestr(n, d)

    # (Round 22, fifth review) A page coloured black on its html (manga, photo books), body unset.
    epub_items(books / "fixed-black.epub", "Fixed Black", [("b1", "b1.xhtml", "application/xhtml+xml", "")], ["b1"],
        {"b1.xhtml": xhtml("Black", "<p>White on black words</p>", vp + "<style>html{background:#000;color:#fff}</style>")}, "urn:fixed-black")
    with zipfile.ZipFile(books / "fixed-black.epub") as z0:
        parts = {n: z0.read(n) for n in z0.namelist()}
    parts["OEBPS/content.opf"] = parts["OEBPS/content.opf"].replace(b"</metadata>", b'<meta property="rendition:layout">pre-paginated</meta></metadata>')
    with zipfile.ZipFile(books / "fixed-black.epub", "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr(zipfile.ZipInfo("mimetype"), parts.pop("mimetype"))
        for n, d in parts.items(): z.writestr(n, d)

    # (Round 22, final review) A page coloured by a stylesheet from another site (which arrives late), and one
    # coloured only while the window is wide (a media query).
    epub_items(books / "fixed-late.epub", "Fixed Late", [("l1", "l1.xhtml", "application/xhtml+xml", ""), ("l2", "l2.xhtml", "application/xhtml+xml", "")], ["l1", "l2"],
        {"l1.xhtml": xhtml("Late", "<p>Late sheet words</p>", vp + '<link rel="stylesheet" href="http://localhost:8792/late.css"/>'),
         "l2.xhtml": xhtml("Wide", "<p>Wide only words</p>", vp + "<style>@media (min-width:900px){html{background:#036;color:#fff}}</style>")}, "urn:fixed-late")
    with zipfile.ZipFile(books / "fixed-late.epub") as z0:
        parts = {n: z0.read(n) for n in z0.namelist()}
    parts["OEBPS/content.opf"] = parts["OEBPS/content.opf"].replace(b"</metadata>", b'<meta property="rendition:layout">pre-paginated</meta></metadata>')
    with zipfile.ZipFile(books / "fixed-late.epub", "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr(zipfile.ZipInfo("mimetype"), parts.pop("mimetype"))
        for n, d in parts.items(): z.writestr(n, d)

    # E-20: fixed-layout books with hand-written packages: right to left, EPUB 2 (a meta, or Apple's display
    # options), and a page using vw units and a fixed position.
    def fxl_book(name, uid, pages, meta="", props=None, version="3.0", ppd="", extra=None, heads=None):
        items = "".join(f'<item id="f{i}" href="f{i}.xhtml" media-type="application/xhtml+xml"/>' for i in range(len(pages)))
        refs = "".join(f'<itemref idref="f{i}"{(" properties=" + chr(34) + props[i] + chr(34)) if props and props[i] else ""}/>' for i in range(len(pages)))
        opf = (f'<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/2007/opf" version="{version}" unique-identifier="uid">'
               f'<metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="uid">{uid}</dc:identifier><dc:title>{name}</dc:title>'
               f'<dc:language>en</dc:language>{meta}</metadata><manifest>{items}<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/></manifest>'
               f'<spine toc="ncx"{(" page-progression-direction=" + chr(34) + ppd + chr(34)) if ppd else ""}>{refs}</spine></package>')
        ncx = ('<?xml version="1.0"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head/><docTitle><text>x</text></docTitle><navMap>'
               '<navPoint id="n1" playOrder="1"><navLabel><text>Start</text></navLabel><content src="f0.xhtml"/></navPoint></navMap></ncx>')
        with zipfile.ZipFile(books / f"{name}.epub", "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr(zipfile.ZipInfo("mimetype"), "application/epub+zip")
            z.writestr("META-INF/container.xml", """<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>""")
            z.writestr("OEBPS/content.opf", opf); z.writestr("OEBPS/toc.ncx", ncx)
            for i, body in enumerate(pages):
                z.writestr(f"OEBPS/f{i}.xhtml", xhtml(f"P{i + 1}", body, vp if heads is None or heads[i] is None else heads[i]))
            for n, d in (extra or {}).items(): z.writestr(n, d)
    pg = lambda n: f'<p class="n">Page {n} text</p>'
    fxl_book("fixed-rtl", "urn:fixed-rtl", [pg(1), pg(2), pg(3)], '<meta property="rendition:layout">pre-paginated</meta>', ppd="rtl")
    fxl_book("fixed-sides", "urn:fixed-sides", [pg(1), pg(2), pg(3), pg(4)], '<meta property="rendition:layout">pre-paginated</meta>',
             props=["page-spread-left", "page-spread-right", "page-spread-center", ""])
    fxl_book("fixed-epub2", "urn:fixed-epub2", [pg(1), pg(2)], '<meta name="fixed-layout" content="true"/>', version="2.0")
    fxl_book("fixed-apple", "urn:fixed-apple", [pg(1), pg(2)], "", version="2.0",
             extra={"META-INF/com.apple.ibooks.display-options.xml": '<?xml version="1.0"?><display_options><platform name="*"><option name="fixed-layout">true</option></platform></display_options>'})
    # (Round 23 review) A spread whose facing page has no size (so it can't be shown); an EPUB 3 book marked
    # reflowable that also has EPUB 2's fixed-layout meta and Apple's display options (reflowable all the same).
    fxl_book("fixed-many", "urn:fixed-many", [pg(n) for n in range(1, 7)], '<meta property="rendition:layout">pre-paginated</meta>')
    fxl_book("fixed-nosize", "urn:fixed-nosize", [pg(1), pg(2), pg(3)], '<meta property="rendition:layout">pre-paginated</meta>', heads=[None, None, ""])
    fxl_book("fixed-epub3-reflow", "urn:fixed-epub3-reflow", [pg(1), pg(2)], '<meta property="rendition:layout">reflowable</meta><meta name="fixed-layout" content="true"/>',
             extra={"META-INF/com.apple.ibooks.display-options.xml": '<?xml version="1.0"?><display_options><platform name="*"><option name="fixed-layout">true</option></platform></display_options>'})
    # (M-86) A reflowable right-to-left book, no fixed pages: turns right to left all the same.
    fxl_book("rtl-reflow", "urn:rtl-reflow", [pg(1), pg(2), pg(3)], ppd="rtl", heads=["", "", ""])
    fxl_book("fixed-units", "urn:fixed-units", ['<div id="half" style="width:50vw;height:10vh;background:#c00"></div><div id="pin" style="position:fixed;right:0;bottom:0;width:40px;height:40px;background:#00c"></div><p>Units page</p>'],
             '<meta property="rendition:layout">pre-paginated</meta>')

    # (Round 22, second review) A vertically written page (Japanese fixed-layout books), and one that clears html's background.
    fx3 = xhtml("Vertical", '<p class="v">縦書きのページ</p>', '<meta name="viewport" content="width=600, height=1600"/><style>html{writing-mode:vertical-rl}body{background:#fff}</style>')
    fx4 = xhtml("Clear", '<p>Clear html</p>', '<meta name="viewport" content="width=600, height=800"/><style>html{background:transparent}body{background:#ff0}</style>')
    epub_items(books / "fixed-styled.epub", "Fixed Styled", [("s1", "s1.xhtml", "application/xhtml+xml", ""), ("s2", "s2.xhtml", "application/xhtml+xml", ""),
        ("s3", "s3.xhtml", "application/xhtml+xml", "")], ["s1", "s2", "s3"], {"s1.xhtml": fx2, "s2.xhtml": fx3, "s3.xhtml": fx4}, "urn:fixed-styled")
    with zipfile.ZipFile(books / "fixed-styled.epub") as z0:
        parts = {n: z0.read(n) for n in z0.namelist()}
    parts["OEBPS/content.opf"] = parts["OEBPS/content.opf"].replace(b"</metadata>", b'<meta property="rendition:layout">pre-paginated</meta></metadata>')
    with zipfile.ZipFile(books / "fixed-styled.epub", "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr(zipfile.ZipInfo("mimetype"), parts.pop("mimetype"))
        for n, d in parts.items(): z.writestr(n, d)

    # Right-to-left manga (E-9): five pages, ComicInfo's Manga "YesAndRightToLeft".
    with zipfile.ZipFile(books / "manga.cbz", "w") as z:
        for i in range(1, 6):
            z.writestr(f"p{i:02}.png", png(60, 90, ((i * 50) % 255, 80, 160)))
        z.writestr("ComicInfo.xml", "<ComicInfo><Title>Test Manga</Title><Manga>YesAndRightToLeft</Manga></ComicInfo>")

    # A comic of tall pages (taller than the screen once scaled to its width in the scroll layout).
    with zipfile.ZipFile(books / "tall.cbz", "w") as z:
        for i in range(1, 7):
            z.writestr(f"page{i}.png", png(100, 750, ((i * 40) % 255, 120, 200)))

    # A second bookshelf, named by folder-cfg's BOOKSHELF (T-16), and a second voice folder (TTS_SERVER).
    (SITE / "shelf2").mkdir()
    (SITE / "shelf2" / "second-shelf.md").write_text("# Second Shelf\n\nOnly on the second shelf.\n")
    os.symlink("tts-voices", SITE / "alt-voices")

    # A server voice for the mock Breeze API.
    wav(SITE / "tts-voices" / "narrator.wav", 2.0)
    wav(SITE / "tts-voices" / "second.wav", 1.5)
    (SITE / "tts-voices" / "voices.json").write_text(json.dumps({"voices": [
        {"id": "narrator", "name": "Test narrator", "ref_audio": "narrator.wav", "ref_text": "A test clip.", "seed": 42, "cfg_scale": 1.0},
        {"id": "second", "name": "Second narrator", "ref_audio": "second.wav", "ref_text": "Another clip.", "seed": 42},
        # Clips outside the voices folder (REVIEW.md L-12): left out of the list.
        {"id": "elsewhere", "name": "Other site", "ref_audio": f"{REMOTE}/clip.wav", "ref_text": "x"},
        # ... but one with an instruction falls back to it (L-28).
        {"id": "described", "name": "Described", "ref_audio": f"{REMOTE}/clip2.wav", "ref_text": "x", "instruction": "A calm voice."},
        {"id": "up", "name": "Up a folder", "ref_audio": "../reader/books/clip.wav", "ref_text": "x"},
        {"id": "encoded", "name": "Encoded dots", "ref_audio": "%2e%2e/reader/clip.wav", "ref_text": "x"},
        {"id": "rooted", "name": "From the root", "ref_audio": "/clip.wav", "ref_text": "x"}]}))
    print(f"Built {SITE}")


if __name__ == "__main__":
    main()
