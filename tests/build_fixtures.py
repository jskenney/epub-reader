#!/usr/bin/env python3
"""Build the test site: books, documents, comics and a fake TTS voice, under tests/site/ (git-ignored).

    python3 tests/build_fixtures.py

The reader itself is linked in as tests/site/reader/index.html (with libs/, fonts/, kokoro/ and pocket/ if
they have been fetched next to it). Pure standard library: zipfile, struct, zlib.
"""
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
            mt = "image/png" if name.endswith(".png") else "text/css" if name.endswith(".css") else "application/octet-stream"
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


def raw_zip(path, entries, comment=b""):
    """Write a ZIP byte by byte, for archives zipfile won't make on purpose. entries: dicts with name (bytes),
    data, and optionally deflate (bool), method (override), flags, cextra / lextra (central / local extra
    fields) and usize (a declared size that isn't true)."""
    out, central = bytearray(), bytearray()
    for e in entries:
        data, name = e["data"], e["name"]
        if e.get("deflate"):
            c = zlib.compressobj(9, zlib.DEFLATED, -15); comp = c.compress(data) + c.flush()
        else:
            comp = data
        method = e.get("method", 8 if e.get("deflate") else 0)
        crc, flags = zlib.crc32(data) & 0xFFFFFFFF, e.get("flags", 0)
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
                        ("folder-badlib", {"ALLOW_CDN": False, "LIB_FILES": "/badlibs/"})):
        (SITE / folder).mkdir()
        os.symlink(REPO / "index.html", SITE / folder / "index.html")
        (SITE / folder / "reader-config.json").write_text(json.dumps(cfg))
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
            e["cextra"] = struct.pack("<HH", 0x7075, 200) + b"\x01" + b"x" * 8
        if e["name"] == b"OEBPS/c2.xhtml":
            e["flags"] = 0x800
            e["cextra"] = struct.pack("<HHBI", 0x7075, 5 + 9, 1, zlib.crc32(e["name"]) & 0xFFFFFFFF) + b"OEBPS/zzz"
    raw_zip(books / "bad-upath.epub", entries)
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
<p id="str-url">A url( inside a CSS string stays text.</p>
<p class="lc">Line continuation inside an address.</p><p class="cm">Quote in a comment.</p><p class="cm2">Comment in url(.</p>
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
@import "{REMOTE}/line-continued\\
.css"; @\\69mport "{BLOCKED}/escaped-at-import.css";
.lc {{ background: url("{REMOTE}/line-continued\\
.png") }}
.cm {{ background-image: image-set(/*"*/"{REMOTE}/comment-quote.png" 1x) }}
.cm2 {{ background: url(/*x*/"{REMOTE}/comment-before.png") }}
.x {{ background: url({REMOTE}/style-bg.png); border: 30px solid; border-image: URL({BLOCKED}/upper-url.png) 30 }}
.x::after {{ content: "x"; background: url(\\68ttp://blocked.example/escaped.png) }}
@font-face {{ font-family: Remote; src: url("{REMOTE}/font.woff2") }}
#str-url::before {{ content: "see url(missing-in-string.png) " }}
.many-escapes {{ content: "\\aaaaaa\\aaaaaa\\aaaaaa\\aaaaaa\\aaaaaa\\aaaaaa\\aaaaaa\\aaaaaa\\aaaaaa\\aaaaaa\\aaaaaa\\aaaaaa\\aaaaaa\\aaaaaa\\aaaaaa\\aaaaaa\\aaaaaa\\aaaaaa\\aaaaaa\\aaaaaa\\aaaaaa\\aaaaaa\\aaaaaa\\aaaaaa\\aaaaaa\\aaaaaa\\aaaaaa\\aaaaaa\\aaaaaa\\aaaaaa" }}</style>"""
    epub(books / "hostile.epub", "Hostile Book", [("c1.xhtml", "Hostile", hostile, style),
                                                  ("c2.xhtml", "Target", "<h1>Target chapter</h1><p>Arrived.</p>")],
         uid="urn:hostile", extra={"OEBPS/pic.png": pic})
    # An HTML page (parsed as HTML, so attributes can be unquoted) with document controls the pre-parse
    # stripping must catch (REVIEW.md L-24, T-9).
    (books / "controls.html").write_text(f"""<!doctype html><html><head><title>Controls</title>
<base href={REMOTE}/unquoted'base/>
<meta content="1;url={REMOTE}/refresh?a>b" http-equiv=refresh>
<META HTTP-EQUIV="refresh" CONTENT="1;url={REMOTE}/upper">
<meta name="http-equiv" content="kept">
</head><body><h1>Controls</h1><base-card>Custom element kept.</base-card><p>Don't stop here.</p></body></html>""")
    with zipfile.ZipFile(books / "hostile.epub") as z:   # also as an extracted folder: its files come from the site
        z.extractall(books / "hostile-dir")

    # Documents.
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

    # A server voice for the mock Breeze API.
    wav(SITE / "tts-voices" / "narrator.wav", 2.0)
    (SITE / "tts-voices" / "voices.json").write_text(json.dumps({"voices": [
        {"id": "narrator", "name": "Test narrator", "ref_audio": "narrator.wav", "ref_text": "A test clip.", "seed": 42, "cfg_scale": 1.0},
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
