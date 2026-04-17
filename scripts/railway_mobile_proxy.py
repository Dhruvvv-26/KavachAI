#!/usr/bin/env python3
"""
Railway Mobile Proxy — runs on ports 9001-9006 to avoid Docker conflicts.
iPhone → http://172.20.10.2:9001 → https://worker-service-production-95dc.up.railway.app
"""
import sys
import socket
import ssl
from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.request
import threading

# --- DNS BYPASS MONKEY PATCH ---
_orig_getaddrinfo = socket.getaddrinfo
def _patched_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
    if host.endswith(".up.railway.app"):
        return _orig_getaddrinfo("151.101.2.15", port, family, type, proto, flags)
    return _orig_getaddrinfo(host, port, family, type, proto, flags)
socket.getaddrinfo = _patched_getaddrinfo

# Proxy port → Railway domain mapping
SERVICES = {
    9001: "worker-service-production-95dc.up.railway.app",
    9002: "policy-service-production-d88e.up.railway.app",
    9003: "trigger-engine-production.up.railway.app",
    9004: "claims-service-production-ee3e.up.railway.app",
    9005: "payment-service-production-c487.up.railway.app",
    9006: "ml-service-production-0a98.up.railway.app",
}

# Create an SSL context that accepts Railway's certs
ssl_ctx = ssl.create_default_context()

class ProxyHandler(BaseHTTPRequestHandler):
    def _proxy(self, method):
        target = SERVICES.get(self.server.server_port)
        if not target:
            self.send_error(500, "Unknown port")
            return

        url = f"https://{target}{self.path}"

        # Read body if present
        body = None
        content_len = self.headers.get("Content-Length")
        if content_len:
            body = self.rfile.read(int(content_len))

        # Forward headers but fix Host
        headers = {}
        for k, v in self.headers.items():
            if k.lower() not in ("host", "connection"):
                headers[k] = v
        headers["Host"] = target

        req = urllib.request.Request(url, data=body, headers=headers, method=method)

        try:
            with urllib.request.urlopen(req, timeout=15, context=ssl_ctx) as resp:
                resp_body = resp.read()
                self.send_response(resp.status)
                # Add CORS headers for React Native
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS")
                self.send_header("Access-Control-Allow-Headers", "*")
                for k, v in resp.headers.items():
                    if k.lower() not in ("transfer-encoding", "connection", "access-control-allow-origin"):
                        self.send_header(k, v)
                self.end_headers()
                self.wfile.write(resp_body)
        except urllib.error.HTTPError as e:
            resp_body = e.read()
            self.send_response(e.code)
            self.send_header("Access-Control-Allow-Origin", "*")
            for k, v in e.headers.items():
                if k.lower() not in ("transfer-encoding", "connection"):
                    self.send_header(k, v)
            self.end_headers()
            self.wfile.write(resp_body)
        except Exception as e:
            self.send_error(502, f"Proxy error: {e}")

    def do_GET(self):     self._proxy("GET")
    def do_POST(self):    self._proxy("POST")
    def do_PUT(self):     self._proxy("PUT")
    def do_DELETE(self):  self._proxy("DELETE")
    def do_PATCH(self):   self._proxy("PATCH")
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers()

    def log_message(self, fmt, *args):
        service = SERVICES.get(self.server.server_port, "?")
        print(f"  [{self.server.server_port}→{service}] {fmt % args}")

def run_server(port):
    server = HTTPServer(('0.0.0.0', port), ProxyHandler)
    domain = SERVICES[port]
    print(f"  ✅ :{port}  →  {domain}")
    server.serve_forever()

if __name__ == '__main__':
    print("=" * 60)
    print("🚀 KavachAI Mobile Proxy (Railway via LAN)")
    print("=" * 60)
    print(f"\nYour iPhone can reach these at http://172.20.10.2:900X\n")

    threads = []
    for port in SERVICES:
        t = threading.Thread(target=run_server, args=(port,), daemon=True)
        t.start()
        threads.append(t)

    print(f"\n{'=' * 60}")
    print("Proxy running! Keep this terminal open.")
    print("=" * 60)

    try:
        for t in threads:
            t.join()
    except KeyboardInterrupt:
        print("\nProxy stopped.")
