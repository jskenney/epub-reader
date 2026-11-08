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
import http.server
import json
import math
import struct
import threading
import time
from email.parser import BytesParser
from email.policy import default

ap = argparse.ArgumentParser()
ap.add_argument("--root", required=True)
ap.add_argument("--port", type=int, required=True)
ap.add_argument("--soft404", action="store_true")
ap.add_argument("--breeze", action="store_true")
ap.add_argument("--log", action="store_true")
ap.add_argument("--rtf", type=float, default=4.0, help="mock Breeze speed: seconds of audio per second")
args = ap.parse_args()

seen, breeze_log, busy = [], [], threading.Lock()


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      ".js": "text/javascript", ".mjs": "text/javascript", ".wasm": "application/wasm",
                      ".json": "application/json", ".woff2": "font/woff2", ".css": "text/css"}

    def __init__(self, *a, **k):
        super().__init__(*a, directory=args.root, **k)

    def log_message(self, *a):
        pass

    def end_headers(self):
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
            body = b"<!doctype html><title>Not found</title><h1>Sorry</h1><p>Nothing here.</p>"
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
        super().do_GET()

    def do_DELETE(self):
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
            breeze_log.append({"text": text, "ref_text": (f.get("ref_text") or b"").decode(), "ref_bytes": len(f.get("ref_audio") or b"")})
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
                breeze_log[-1]["aborted"] = True
        finally:
            busy.release()


http.server.ThreadingHTTPServer(("", args.port), Handler).serve_forever()
