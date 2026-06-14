#!/usr/bin/env python3
"""Local test harness: serve the built SPA from dist/ and reverse-proxy
/api and /media to the production backend, so the browser talks to a single
origin (no CORS needed) while exercising the real deployed backend + media.
"""
import sys, urllib.request, urllib.error
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import mimetypes

ROOT = Path(__file__).resolve().parent.parent / "dist"
BACKEND = "https://77.91.95.18.sslip.io"
PORT = 8099

class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _proxy(self, method):
        url = BACKEND + self.path
        body = None
        if "Content-Length" in self.headers:
            body = self.rfile.read(int(self.headers["Content-Length"]))
        req = urllib.request.Request(url, data=body, method=method)
        for h in ("Content-Type", "Authorization", "Range"):
            if h in self.headers:
                req.add_header(h, self.headers[h])
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                self.send_response(r.status)
                for k, v in r.headers.items():
                    if k.lower() in ("content-type", "content-length", "accept-ranges",
                                     "content-range", "cache-control"):
                        self.send_header(k, v)
                self.end_headers()
                self.wfile.write(r.read())
        except urllib.error.HTTPError as e:
            self.send_response(e.code)
            self.end_headers()
            self.wfile.write(e.read())
        except Exception as e:
            self.send_response(502)
            self.end_headers()
            self.wfile.write(str(e).encode())

    def _static(self):
        path = self.path.split("?")[0].lstrip("/")
        f = ROOT / path
        if not f.is_file():
            f = ROOT / "index.html"          # SPA fallback
        data = f.read_bytes()
        ctype = mimetypes.guess_type(str(f))[0] or "application/octet-stream"
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path.startswith(("/api", "/media")):
            self._proxy("GET")
        else:
            self._static()

    def do_POST(self):
        self._proxy("POST")

if __name__ == "__main__":
    print(f"serving {ROOT} on http://127.0.0.1:{PORT} (proxy -> {BACKEND})")
    ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
