#!/usr/bin/env python3
"""Test web server for the reader.

    python3 tests/server.py --root tests/site --port 8790 [--soft404] [--breeze] [--log]

--soft404  answer missing files with a 200 HTML "not found" page, as some sites do
--breeze   a mock of the Breeze TTS 2 API at /tts/ (multipart requests, 409 while busy, streamed 16-bit PCM
           with X-Sample-Rate), logging each request; GET /__breeze returns the log, DELETE clears it
--log      record every request path; GET /__log returns them, DELETE /__log clears (the "other site" a
           hostile book tries to reach)
"""
import argparse
import html
import http.server
import json
import math
import os
import urllib.parse
import re
import struct
import threading
import time
import uuid
from email.parser import BytesParser
from email.policy import default

ap = argparse.ArgumentParser()
ap.add_argument("--root", required=True)
ap.add_argument("--port", type=int, required=True)
ap.add_argument("--soft404", action="store_true")
ap.add_argument("--breeze", action="store_true")
ap.add_argument("--log", action="store_true")
ap.add_argument("--rtf", type=float, default=4.0, help="mock Breeze speed: seconds of audio per second")
ap.add_argument("--csp-from", help="send the Content-Security-Policy from this nginx example (its first active add_header)")
ap.add_argument("--csp-variant", choices=["self", "cdn"], default="self",
                help="cdn: the commented-out policy for a reader that uses CDNs, instead of the active one")
ap.add_argument("--no-range", action="store_true", help="ignore Range headers (answer with the whole file)")
ap.add_argument("--csp-skip", default="", help="comma-separated path prefixes served without it (setups that need CDNs or remote content)")
args = ap.parse_args()
READER_PAGE_PATH = os.path.realpath(os.path.join(args.root, "reader", "index.html"))

seen, breeze_log, busy = [], [], threading.Lock()
stall_next = []   # Breeze requests to stall, oldest first: "headers" (headers, then nothing) or "mid" (some audio, then nothing)
api_log = []   # reading progress posted to /api-log/... (GET /__api lists, DELETE /__api clears: E-22)
sent = {}   # bytes of each file sent (GET /__bytes, DELETE /__bytes clears)
ranges_on = [True]   # GET /__ranges?on=0 makes the server stop answering range requests (and ?on=1 again)
head_on = [True]     # GET /__head?on=0 makes HEAD requests answer 405 (and ?on=1 again)
head_delay = {}      # GET /__head?delay=2&path=x.wav makes HEAD requests for paths ending in x.wav wait 2 s (?delay=0 clears)


def validators(file, path=""):
    """A strong ETag and Last-Modified for a file, as nginx sends (for If-Range). Files under a folder named
    weak-etag get a weak ETag (as with on-the-fly compression), and under no-validators neither header."""
    if "/no-validators/" in path:
        return None, None
    st = os.stat(file)
    tag = f'"{st.st_mtime_ns:x}-{st.st_size:x}"'
    return ("W/" + tag if "/weak-etag/" in path else tag), time.strftime("%a, %d %b %Y %H:%M:%S GMT", time.gmtime(st.st_mtime))
POLICY = None
if args.csp_from:
    import re
    pattern = r'\s*add_header Content-Security-Policy "([^"]+)"' if args.csp_variant == "self" else r'\s*#\s*add_header Content-Security-Policy "([^"]+)"'
    for line in open(args.csp_from):
        m = re.match(pattern, line)   # self: the active one; cdn: the commented-out CDN version
        if m:
            POLICY = m.group(1)
            break
    assert POLICY, f"no {args.csp_variant} Content-Security-Policy in {args.csp_from}"


# The types nginx.conf.example sets for the reader's files (location ~* \.ext$ { types { } default_type ...; }),
# so the tests check the documented setup rather than types of the test server's own (REVIEW.md T-16).
NGINX_TYPES = {}
_conf = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "nginx.conf.example")
if os.path.isfile(_conf):
    _text = "\n".join(l for l in open(_conf).read().split("\n") if not l.lstrip().startswith("#"))
    for m in re.finditer(r"location\s+~\*\s+\\\.\(?([a-z0-9|]+)\)?\$\s*\{\s*types\s*\{\s*\}\s*default_type\s+([^;]+);", _text, re.I):
        for ext in m.group(1).split("|"):
            NGINX_TYPES["." + ext] = m.group(2).strip()


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      ".js": "text/javascript", ".mjs": "text/javascript", ".wasm": "application/wasm",
                      ".json": "application/json", ".woff2": "font/woff2", ".css": "text/css", **NGINX_TYPES}

    def __init__(self, *a, **k):
        super().__init__(*a, directory=args.root, **k)

    def log_message(self, *a):
        pass

    def end_headers(self):
        if getattr(self, "file_validators", None) and self.file_validators[0] and not getattr(self, "validators_sent", False):
            self.send_header("ETag", self.file_validators[0])
            self.validators_sent = True
        if POLICY and not any(p and self.path.startswith(p) for p in args.csp_skip.split(",")):
            # (Book files opened on their own are sandboxed, as nginx.conf.example sends them: round 25 review, M-130.)
            # (Decoded, as nginx matches it; the reader's own page, a link to index.html, isn't: round 25 review, M-131.)
            req = urllib.parse.unquote(self.path.split("?")[0])
            book_page = re.search(r"\.(x?html?|xht|shtml|xml|xsl|xslt|svgz?|rss|atom|mml|mathml|rdf|xpdl|xul|smil|opf|ncx)$", req, re.I) and \
                not (os.path.realpath(os.path.join(args.root, req.lstrip("/"))) == READER_PAGE_PATH and
                     (req in ("/reader/index.html", "/reader/") or not req.startswith("/reader/")))
            # (Under /reader/, only the reader's own page is exempt, as the example's exact location does; a copy in
            # another folder is that folder's own block's business: round 25 review, D-24.)
            self.send_header("Content-Security-Policy", "sandbox" if book_page else POLICY)
            self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Cache-Control", "no-store")
        if not self.path.startswith("/nocors/"):   # (E-24: a site that doesn't let other sites read its files)
            self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

    def send_header(self, key, value):
        if key.lower() == "last-modified" and getattr(self, "file_validators", None) and not self.file_validators[1]:
            return   # no-validators: not even the date the base class adds
        super().send_header(key, value)

    def json(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_error(self, code, *a, **k):
        if code == 404 and args.soft404:
            # Like many real sites: the page repeats the address and adds a request id and the time.
            body = (f"<!doctype html><title>Not found</title><h1>Sorry</h1><p>Nothing at {html.escape(self.path)}.</p>"
                    f"<p>Request {uuid.uuid4().hex} at {time.strftime('%H:%M:%S')}.</p>").encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(body)
            return
        super().send_error(code, *a, **k)

    def do_GET(self):
        path = self.path.split("?")[0]
        m = re.match(r"^/redirect/(\d+)(/.*)$", path)   # (E-24 review: a path sent on to another port, another site)
        if m:
            self.send_response(302); self.send_header("Location", f"http://localhost:{m.group(1)}{m.group(2)}"); self.send_header("Content-Length", "0"); self.end_headers(); return
        if path == "/__bytes":
            return self.json(200, sent)
        if path == "/__api":
            return self.json(200, api_log)
        if path == "/__ranges":
            ranges_on[0] = "on=0" not in self.path
            return self.json(200, {"ranges": ranges_on[0]})
        if path == "/__head":
            m = re.search(r"delay=([\d.]+)", self.path)
            if m:
                p = re.search(r"path=([^&]+)", self.path)
                if float(m.group(1)) and p: head_delay[p.group(1)] = float(m.group(1))
                else: head_delay.clear()
            else:
                head_on[0] = "on=0" not in self.path
            return self.json(200, {"head": head_on[0], "delay": head_delay})
        if args.log:
            if path == "/__log":
                return self.json(200, seen)
            seen.append(path)
            return self.json(404, {"detail": "logged"})
        if args.breeze:
            if path == "/__breeze":
                m = re.search(r"stall=(headers|mid)(?:&n=(\d+))?", self.path)
                if m:
                    stall_next.extend([m.group(1)] * int(m.group(2) or 1))
                return self.json(200, breeze_log)
            if path in ("/tts/health", "/alt-tts/health"):   # (/alt-tts/: a folder whose config moves TTS_SERVER)
                return self.json(200, {"status": "ok"})
            if path.startswith("/tts/"):
                return self.json(404, {"detail": "Not Found"})
        file = self.translate_path(self.path)
        self.file_validators = validators(file, self.path) if os.path.isfile(file) else None
        self.validators_sent = False   # one handler serves every request on a kept-alive connection
        rng = self.headers.get("Range")
        if rng and not args.no_range and ranges_on[0] and os.path.isfile(file):
            if_range = self.headers.get("If-Range")
            if not if_range or (if_range in self.file_validators and not if_range.startswith("W/")):   # If-Range: a part only of the same version
                return self.send_range(file, rng)
        super().do_GET()

    def do_HEAD(self):
        time.sleep(next((d for p, d in head_delay.items() if self.path.split("?")[0].endswith(p)), 0))
        if not head_on[0]:
            self.file_validators = None
            return self.send_error(405)
        file = self.translate_path(self.path)
        self.file_validators = validators(file, self.path) if os.path.isfile(file) else None
        self.validators_sent = False
        super().do_HEAD()

    def copyfile(self, source, outputfile):   # count what is sent
        n = 0
        while chunk := source.read(65536):
            outputfile.write(chunk)
            n += len(chunk)
        key = self.path.split("?")[0]
        sent[key] = sent.get(key, 0) + n

    def send_range(self, file, rng):
        size = os.path.getsize(file)
        m = re.match(r"bytes=(\d*)-(\d*)$", rng.strip())
        if not m or (not m.group(1) and not m.group(2)):
            return self.send_error(416)
        if m.group(1):
            start, end = int(m.group(1)), min(int(m.group(2)) if m.group(2) else size - 1, size - 1)
        else:
            start, end = max(0, size - int(m.group(2))), size - 1
        if start > end:
            return self.send_error(416)
        with open(file, "rb") as f:
            f.seek(start)
            data = f.read(end - start + 1)
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(file))
        # Files under a folder named star-total answer without the total size ("bytes 0-3/*").
        self.send_header("Content-Range", f"bytes {start}-{end}/{'*' if '/star-total/' in self.path else size}")
        if self.file_validators[1]:
            self.send_header("Last-Modified", self.file_validators[1])
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Accept-Ranges", "bytes")
        self.end_headers()
        self.wfile.write(data)
        key = self.path.split("?")[0]
        sent[key] = sent.get(key, 0) + len(data)

    def do_DELETE(self):
        if self.path.startswith("/__bytes"):
            sent.clear()
            return self.json(200, {"ok": True})
        if self.path.startswith("/__api"):
            api_log.clear()
            return self.json(200, {"ok": True})
        (seen if self.path.startswith("/__log") else breeze_log).clear()
        if not self.path.startswith("/__log"):
            stall_next.clear()
        self.json(200, {"ok": True})

    def do_POST(self):
        path = self.path.split("?")[0]
        if path.startswith("/api-log/"):   # (a reading progress API that answers with JSON: E-22)
            body = self.rfile.read(int(self.headers.get("Content-Length") or 0))
            api_log.append({"path": path, "type": self.headers.get("Content-Type", ""), "body": json.loads(body or b"null")})
            return self.json(200, {"ok": True})
        if not (args.breeze and path in ("/tts/v1/audio/speech", "/alt-tts/v1/audio/speech")):
            return self.json(404, {"detail": "Not Found"})
        body = self.rfile.read(int(self.headers["Content-Length"]))
        msg = BytesParser(policy=default).parsebytes(b"Content-Type: " + self.headers["Content-Type"].encode() + b"\r\n\r\n" + body)
        f = {p.get_param("name", header="content-disposition"): p.get_payload(decode=True) for p in msg.iter_parts()}
        try:
            mode = stall_next.pop(0)   # (a stalled stream: it doesn't hold the server busy, so the reader's next request is answered)
        except IndexError:
            mode = None
        if mode:
            entry = {"text": f["text"].decode(), "stalled": mode, "path": path}
            breeze_log.append(entry)
            self.send_response(200)
            self.send_header("Content-Type", "audio/pcm")
            self.send_header("X-Sample-Rate", "24000")
            self.end_headers()
            try:
                if mode == "mid":
                    self.wfile.write(b"\0\0" * 4800); self.wfile.flush()
                time.sleep(20)   # (longer than any test waits: it must be the reader that gives up)
                self.wfile.write(b"\0\0" * 480); self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError):
                entry["aborted"] = True
            return
        if not busy.acquire(blocking=False):
            return self.json(409, {"detail": "An inference request is already running."})
        try:
            text = f["text"].decode()
            entry = {"text": text, "ref_text": (f.get("ref_text") or b"").decode(), "ref_bytes": len(f.get("ref_audio") or b""), "path": path}
            breeze_log.append(entry)
            seconds = 0.3 * len(text.split()) + 0.3
            n, step = int(24000 * seconds), 1920
            self.send_response(200)
            self.send_header("Content-Type", "audio/pcm")
            self.send_header("X-Sample-Rate", "24000")
            self.end_headers()
            try:
                for i in range(0, n, step):
                    self.wfile.write(b"".join(struct.pack("<h", int(3000 * math.sin(j * 0.05))) for j in range(i, min(n, i + step))))
                    self.wfile.flush()
                    time.sleep(0.08 / args.rtf)
            except (BrokenPipeError, ConnectionResetError):
                entry["aborted"] = True   # the reader cancelled this passage
        finally:
            busy.release()


http.server.ThreadingHTTPServer(("", args.port), Handler).serve_forever()
