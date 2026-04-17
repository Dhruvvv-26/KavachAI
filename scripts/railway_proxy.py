#!/usr/bin/env python3
"""
Railway Edge Proxy
------------------
This script intercepts incoming local HTTP requests and proxies them securely 
to Railway's Edge Network (Fastly) bypassing any ISP DNS timeouts.
Run this script locally to allow the Worker App (React Native) to connect to Production seamlessly!
"""

import sys
import socket
from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.request
import threading
import json

# --- DNS BYPASS MONKEY PATCH ---
_orig_getaddrinfo = socket.getaddrinfo
def _patched_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
    if host.endswith(".up.railway.app"):
        return _orig_getaddrinfo("151.101.2.15", port, family, type, proto, flags)
    return _orig_getaddrinfo(host, port, family, type, proto, flags)
socket.getaddrinfo = _patched_getaddrinfo
# -------------------------------

SERVICES = {
    8001: "worker-service-production-95dc.up.railway.app",
    8002: "policy-service-production-d88e.up.railway.app",
    8003: "trigger-engine-production.up.railway.app",
    8004: "claims-service-production-ee3e.up.railway.app",
    8005: "payment-service-production-c487.up.railway.app",
    8006: "ml-service-production-0a98.up.railway.app",
}

class ProxyHTTPRequestHandler(BaseHTTPRequestHandler):
    def do_PROXY(self, method):
        target_domain = SERVICES.get(self.server.server_port)
        if not target_domain:
            self.send_error(500, "Unknown Service Port")
            return

        url = f"https://{target_domain}{self.path}"
        headers = {k: v for k, v in self.headers.items() if k.lower() != "host"}
        headers["Host"] = target_domain
        
        data = None
        if "Content-Length" in self.headers:
            data = self.rfile.read(int(self.headers["Content-Length"]))

        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                self.send_response(response.status)
                for k, v in response.headers.items():
                    if k.lower() not in ["transfer-encoding", "connection"]:
                        self.send_header(k, v)
                self.end_headers()
                self.wfile.write(response.read())
        except urllib.error.HTTPError as e:
            self.send_response(e.code)
            for k, v in e.headers.items():
                if k.lower() not in ["transfer-encoding", "connection"]:
                    self.send_header(k, v)
            self.end_headers()
            self.wfile.write(e.read())
        except Exception as e:
            self.send_error(502, f"Bad Gateway: {str(e)}")

    def do_GET(self): self.do_PROXY("GET")
    def do_POST(self): self.do_PROXY("POST")
    def do_PUT(self): self.do_PROXY("PUT")
    def do_DELETE(self): self.do_PROXY("DELETE")
    def do_PATCH(self): self.do_PROXY("PATCH")
    def do_OPTIONS(self): self.do_PROXY("OPTIONS")

    def log_message(self, format, *args):
        # Keep logs minimal
        pass

def run_server(port):
    server = HTTPServer(('0.0.0.0', port), ProxyHTTPRequestHandler)
    print(f"✅ Proxying port {port} -> {SERVICES[port]}")
    server.serve_forever()

if __name__ == '__main__':
    print("=====================================================")
    print("🚀 KavachAI Local Proxy (DNS Bypass to Railway)")
    print("=====================================================")
    threads = []
    for port in SERVICES.keys():
        t = threading.Thread(target=run_server, args=(port,), daemon=True)
        t.start()
        threads.append(t)
    
    print("\nProxy is active! Keep this terminal open.")
    print("Update your worker-app/.env EXPO_PUBLIC_*_SERVICE to point to your local LAN IP.")
    try:
        for t in threads:
            t.join()
    except KeyboardInterrupt:
        print("\nShutting down proxy.")
