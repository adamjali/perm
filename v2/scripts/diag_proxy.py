#!/usr/bin/env python3
"""Serve the local production build with a measurement overlay injected.

Why this exists: the date-field overflow is a WebKit-only layout result, and
nothing on this machine can reproduce it — Playwright refuses WebKit on macOS
12, there is no simulator, and macOS Safari takes a different branch of
WebKit's UA stylesheet than iOS does. So the measurement has to come from the
actual phone.

This proxies the local Next server and appends a script that walks the ancestor
chain of the first date input and prints, in large text at the top of the page,
each ancestor's display, computed width, measured width and grid template.
Whichever ancestor's measured width FIRST exceeds the card is the culprit; that
is the one decisive fact a screenshot of the bug cannot give.

    python3 diag_proxy.py 8099 3100 0.0.0.0

Then open http://<lan-ip>:8099/tools/perm-deadline-calculator on the phone.

Binds where you tell it. It serves only what the Next server returns — it is
not a directory server and cannot expose the repo.
"""
import http.server
import socketserver
import sys
import urllib.error
import urllib.request

OVERLAY = b"""<script>
(function () {
  function run() {
    var el = document.querySelector('input[type="date"]');
    if (!el) { return setTimeout(run, 300); }
    var card = el.closest('.shadow-hard') || el.closest('[class*="border-2"]');
    var cardW = card ? card.getBoundingClientRect().width : null;
    var rows = [], n = el, depth = 0;
    while (n && n !== document.body && depth < 9) {
      var cs = getComputedStyle(n), r = n.getBoundingClientRect();
      rows.push({
        t: n.tagName.toLowerCase(),
        c: (typeof n.className === 'string' ? n.className : '').slice(0, 34),
        d: cs.display,
        w: cs.width,
        rw: Math.round(r.width),
        r: Math.round(r.right),
        gt: cs.gridTemplateColumns,
        mw: cs.minWidth
      });
      n = n.parentElement; depth++;
    }
    var out = 'viewport ' + window.innerWidth + '  dpr ' + window.devicePixelRatio +
              '  card ' + (cardW === null ? '?' : Math.round(cardW)) + '\\n' +
              'UA ' + (navigator.userAgent.match(/(iPhone|Version\\/[\\d.]+|CriOS\\/[\\d.]+|Safari)/g) || []).join(' ') + '\\n\\n';
    rows.forEach(function (x, i) {
      out += i + ' ' + x.t + ' .' + x.c + '\\n' +
             '   disp=' + x.d + ' minw=' + x.mw + '\\n' +
             '   width=' + x.w + ' measured=' + x.rw + ' right=' + x.r + '\\n' +
             (x.gt && x.gt !== 'none' ? '   cols=' + x.gt + '\\n' : '');
    });
    var pre = document.createElement('pre');
    pre.textContent = out;
    pre.style.cssText = 'position:relative;z-index:99999;background:#111;color:#0f0;' +
      'font:12px/1.35 ui-monospace,Menlo,monospace;padding:10px;margin:0;' +
      'white-space:pre-wrap;word-break:break-all;border-bottom:4px solid #0f0';
    document.body.insertBefore(pre, document.body.firstChild);
  }
  if (document.readyState === 'complete') { setTimeout(run, 600); }
  else { window.addEventListener('load', function () { setTimeout(run, 600); }); }
})();
</script></body>"""


class Proxy(http.server.BaseHTTPRequestHandler):
    upstream = 3100

    def do_GET(self):  # noqa: N802
        url = f"http://127.0.0.1:{self.upstream}{self.path}"
        try:
            with urllib.request.urlopen(url, timeout=30) as r:
                body, ctype, status = r.read(), r.headers.get("Content-Type", ""), r.status
        except urllib.error.HTTPError as e:
            body, ctype, status = e.read(), e.headers.get("Content-Type", ""), e.code
        except Exception as e:  # noqa: BLE001
            body, ctype, status = str(e).encode(), "text/plain", 502
        if "text/html" in ctype and b"</body>" in body:
            body = body.replace(b"</body>", OVERLAY, 1)
        self.send_response(status)
        self.send_header("Content-Type", ctype or "text/html")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *a):  # quiet
        pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8099
    Proxy.upstream = int(sys.argv[2]) if len(sys.argv) > 2 else 3100
    host = sys.argv[3] if len(sys.argv) > 3 else "127.0.0.1"
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer((host, port), Proxy) as httpd:
        print(f"diagnostic proxy on http://{host}:{port} -> :{Proxy.upstream}", flush=True)
        httpd.serve_forever()
