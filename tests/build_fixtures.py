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


def xhtml(title, body, head=""):
    return f"""<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="en">
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
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="uid">{uid}</dc:identifier>
<dc:title>{title}</dc:title><dc:creator>Test Author</dc:creator><dc:language>{lang}</dc:language></metadata>
<manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>{items}</manifest>
<spine>{spine}</spine></package>"""
    nav = xhtml("Contents", f'<nav epub:type="toc"><ol>{nav_items}</ol></nav>')
    with zipfile.ZipFile(path, "w") as z:
        z.writestr(zipfile.ZipInfo("mimetype"), "application/epub+zip")
        z.writestr("META-INF/container.xml", """<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>""")
        z.writestr("OEBPS/content.opf", opf)
        z.writestr("OEBPS/nav.xhtml", nav)
        for f, t, body, *head in chapters:
            z.writestr(f"OEBPS/{f}", xhtml(t, body, head[0] if head else ""))
        for name, data in (extra or {}).items():
            z.writestr(name, data)


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
<p class="x">Styled from the head.</p><p style="font-family: Remote">Remote font.</p>"""
    # Ways around pattern matching (REVIEW.md H-1, H-2, L-1, L-2), each aimed at both other sites.
    for i, host in enumerate((REMOTE, BLOCKED)):
        hostile += f"""
<p><img class="bypass" src="{host.replace('http:', '')}/protocol-relative.png" alt="pr"/>
<img class="bypass" src="ht&#9;{host[2:]}/tab-in-scheme.png" alt="tab"/>
<IMG class="bypass" SRC="{host}/upper-xhtml.png" alt="up"/></p>
<IFRAME id="upper-iframe-{i}" SRC="{host}/upper-iframe"></IFRAME>
<p style="background: URL({host}/inline-upper.png)">Upper-case URL(</p>
<p style="background-image: image-set('{host}/image-set.png' 1x)">image-set</p>
<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><image width="10" height="10"><set attributeName="href" to="{host}/smil.png" begin="0s"/></image></svg>"""
    hostile += f"""
<BASE href="{REMOTE}/base/"/>
<META http-equiv="refresh" content="1;url={REMOTE}/refresh"/>
<p><img class="bypass" src="missing-local.png" alt="missing"/></p>"""
    style = f"""<style>@import url("{REMOTE}/imported.css"); @import"{BLOCKED}/import-no-space.css";
.x {{ background: url({REMOTE}/style-bg.png); border: 30px solid; border-image: URL({BLOCKED}/upper-url.png) 30 }}
.x::after {{ content: "x"; background: url(\\68ttp://blocked.example/escaped.png) }}
@font-face {{ font-family: Remote; src: url("{REMOTE}/font.woff2") }}</style>"""
    epub(books / "hostile.epub", "Hostile Book", [("c1.xhtml", "Hostile", hostile, style),
                                                  ("c2.xhtml", "Target", "<h1>Target chapter</h1><p>Arrived.</p>")],
         uid="urn:hostile", extra={"OEBPS/pic.png": pic})
    with zipfile.ZipFile(books / "hostile.epub") as z:   # also as an extracted folder: its files come from the site
        z.extractall(books / "hostile-dir")

    # Documents.
    (books / "notes.md").write_text("# Notes\n\nIntro with a [link](#later).\n\n## First\n\nText.\n\n## Later\n\nThe end.\n")
    (books / "plain.txt").write_text("CHAPTER I.\n\nIt was a dark night.\n\nCHAPTER II.\n\nMorning came.\n")
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
        {"id": "narrator", "name": "Test narrator", "ref_audio": "narrator.wav", "ref_text": "A test clip.", "seed": 42, "cfg_scale": 1.0}]}))
    print(f"Built {SITE}")


if __name__ == "__main__":
    main()
