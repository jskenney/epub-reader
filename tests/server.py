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
ap.add_argument("--no-range", action="store_true", help="ignore Range headers (answer with the whole file)")
ap.add_argument("--csp-skip", default="", help="comma-separated path prefixes served without it (setups that need CDNs or remote content)")
args = ap.parse_args()

seen, breeze_log, busy = [], [], threading.Lock()
sent = {}   # bytes of each file sent (GET /__bytes, DELETE /__bytes clears)
POLICY = None
if args.csp_from:
    import re
    for line in open(args.csp_from):
        m = re.match(r'\s*add_header Content-Security-Policy "([^"]+)"', line)   # not commented out
        if m:
            POLICY = m.group(1)
            break
    assert POLICY, f"no active Content-Security-Policy in {args.csp_from}"


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      ".js": "text/javascript", ".mjs": "text/javascript", ".wasm": "application/wasm",
                      ".json": "application/json", ".woff2": "font/woff2", ".css": "text/css"}

    def __init__(self, *a, **k):
        super().__init__(*a, directory=args.root, **k)

    def log_message(self, *a):
        pass

    def end_headers(self):
        if POLICY and not any(p and self.path.startswith(p) for p in args.csp_skip.split(",")):
            self.send_header("Content-Security-Policy", POLICY)
            self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

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
        if path == "/__bytes":
            return self.json(200, sent)
        if args.log:
            if path == "/__log":
                return self.json(200, seen)
            seen.append(path)
            return self.json(404, {"detail": "logged"})
        if args.breeze:
            if path == "/__breeze":
                return self.json(200, breeze_log)
            if path == "/tts/health":
                return self.json(200, {"status": "ok"})
            if path.startswith("/tts/"):
                return self.json(404, {"detail": "Not Found"})
        file = self.translate_path(self.path)
        rng = self.headers.get("Range")
        if rng and not args.no_range and os.path.isfile(file):
            return self.send_range(file, rng)
        super().do_GET()

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
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
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
        (seen if self.path.startswith("/__log") else breeze_log).clear()
        self.json(200, {"ok": True})

    def do_POST(self):
        path = self.path.split("?")[0]
        if not (args.breeze and path == "/tts/v1/audio/speech"):
            return self.json(404, {"detail": "Not Found"})
        body = self.rfile.read(int(self.headers["Content-Length"]))
        msg = BytesParser(policy=default).parsebytes(b"Content-Type: " + self.headers["Content-Type"].encode() + b"\r\n\r\n" + body)
        f = {p.get_param("name", header="content-disposition"): p.get_payload(decode=True) for p in msg.iter_parts()}
        if not busy.acquire(blocking=False):
            return self.json(409, {"detail": "An inference request is already running."})
        try:
            text = f["text"].decode()
            entry = {"text": text, "ref_text": (f.get("ref_text") or b"").decode(), "ref_bytes": len(f.get("ref_audio") or b"")}
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
