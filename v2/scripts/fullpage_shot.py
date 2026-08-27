#!/usr/bin/env python3
"""Full-page screenshots of a live site that do NOT lie about 100vh.

WHY THIS EXISTS, AND THE EXACT TRAP IT AVOIDS. The obvious way to capture a
whole page is to resize the viewport to the page's full height, so that every
scroll-reveal fires and one screenshot covers everything. site-forge's
fullpage-shot.py does that, and it is correct on a site with no viewport
units. On a site that HAS them it is catastrophic and the output looks
plausible, which is worse.

Measured on permtracker.app: the homepage hero is min-h-[calc(100vh-71px)].
Resizing the viewport to the page height made 100vh equal 16000px, so the hero
inflated to **15,936px around 763px of content** and the capture showed roughly
5,000px of "empty page" that no visitor will ever see. It also feeds back on
itself: the taller hero makes the page taller, which makes the next viewport
taller. The page measured 24,118px that way and 9,098px honestly.

So this keeps a REAL viewport (1440x900 by default) and SCROLLS the page to
fire every IntersectionObserver, then captures beyond the viewport. 100vh
stays 900px throughout.

Fixed-position layers (a dot grid, a canvas background, the header) paint once
at the top under captureBeyondViewport rather than tiling down the page. That
is a known and accepted difference: the page's own content is what is under
review.

    python3 scripts/fullpage_shot.py <url> [<url> ...] --out DIR [--dark]

Four mechanics that each cost a round trip to learn:

1. `--remote-allow-origins=*` must be QUOTED in zsh or the glob eats it and
   Chrome never sees the flag. The symptom is a 403 on the websocket
   handshake, which reads like auth and is not. (Not an issue here: no shell
   is involved, the flag is passed through argv.)
2. `/json/list` returns EMPTY unless you send a `Host: localhost` header.
3. websocket-client sends an Origin that Chrome rejects: `suppress_origin=True`.
4. Do NOT enable the Page domain. Its lifecycle events flood the socket and
   the naive recv loop below stalls waiting for its own reply. This script
   navigates by assigning `location.href` through Runtime instead, which needs
   no Page events at all. Enabling Page cost two hangs before that was clear.

ONE BROWSER AT A TIME. Parallel headless Chrome has taken this machine down
twice via the OOM killer, so this refuses to launch when another
--remote-debugging-port process exists, and kills its own in a finally.
"""

import argparse, base64, json, pathlib, subprocess, sys, time, urllib.request

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PORT = 9458

PREP = """(()=>{
  const s=document.createElement('style');
  s.textContent='*{transition-duration:0s!important;animation-duration:0s!important}'
   +'html{scroll-behavior:auto!important}';
  document.head.appendChild(s);
  document.querySelectorAll('img[loading=lazy]').forEach(i=>i.loading='eager');
  return document.documentElement.scrollHeight;})()"""

SETTLE = """(async()=>{
  const im=[...document.images];
  await Promise.all(im.map(i=>i.complete?0:new Promise(r=>{i.onload=i.onerror=r})));
  await Promise.all(im.map(i=>i.decode().catch(()=>0)));
  await new Promise(r=>setTimeout(r,700));
  return im.length+'/'+im.filter(i=>i.naturalWidth>0).length;})()"""


def running_debug_chromes() -> int:
    out = subprocess.run(["ps", "-eo", "command"], capture_output=True, text=True).stdout
    return sum(1 for l in out.splitlines() if "--remote-debugging-port" in l)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("urls", nargs="+")
    ap.add_argument("--out", default=".")
    ap.add_argument("--width", type=int, default=1440)
    ap.add_argument("--vh", type=int, default=900, help="REAL viewport height; 100vh resolves to this")
    ap.add_argument("--dark", action="store_true", help="emulate prefers-color-scheme: dark")
    a = ap.parse_args()

    import websocket
    # NEVER two at once: it has taken this machine down twice.
    if running_debug_chromes():
        print("a debug Chrome is already running; refusing to launch another", file=sys.stderr)
        return 2

    out = pathlib.Path(a.out); out.mkdir(parents=True, exist_ok=True)
    prof = pathlib.Path(f"/tmp/shot2prof-{int(time.time())}")
    proc = subprocess.Popen(
        [CHROME, "--headless=new", f"--remote-debugging-port={PORT}",
         "--remote-allow-origins=*", f"--user-data-dir={prof}",
         "--hide-scrollbars", "--disable-gpu",
         f"--window-size={a.width},{a.vh}", "about:blank"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        page = None
        for _ in range(30):
            time.sleep(0.5)
            try:
                req = urllib.request.Request(f"http://127.0.0.1:{PORT}/json/list",
                                             headers={"Host": "localhost"})
                tabs = json.loads(urllib.request.urlopen(req, timeout=5).read())
                page = next((t for t in tabs if t["type"] == "page"), None)
                if page: break
            except Exception:
                continue
        if not page:
            print("chrome never exposed a page target", file=sys.stderr); return 1

        ws = websocket.create_connection(
            f"ws://127.0.0.1:{PORT}/devtools/page/{page['id']}",
            timeout=90, suppress_origin=True)
        n = [0]

        def cmd(method, **params):
            n[0] += 1
            ws.send(json.dumps({"id": n[0], "method": method, "params": params}))
            while True:
                m = json.loads(ws.recv())
                if m.get("id") == n[0]:
                    if "error" in m:
                        raise SystemExit(f"{method}: {m['error']}")
                    return m.get("result", {})

        def ev(expr, await_promise=False):
            return cmd("Runtime.evaluate", expression=expr, returnByValue=True,
                       awaitPromise=await_promise)["result"].get("value")

        cmd("Page.enable"); cmd("Runtime.enable")
        for url in a.urls:
            slug = (url.rstrip("/").split("/")[-1] or "index").split("?")[0]
            if slug.endswith(".app"):
                slug = "home"
            cmd("Emulation.setDeviceMetricsOverride", width=a.width, height=a.vh,
                deviceScaleFactor=1, mobile=False)
            if a.dark:
                cmd("Emulation.setEmulatedMedia", features=[
                    {"name": "prefers-color-scheme", "value": "dark"}])
            cmd("Page.navigate", url=f"{url}{'&' if '?' in url else '?'}cb={int(time.time())}")
            time.sleep(5)
            # Probe rule one: assert we are on the subject before measuring it.
            print("   nav ok", flush=True)
            href = ev("location.href")
            assert href and href.startswith("http"), f"not on an http page: {href}"
            print("   href", href, flush=True)
            ev(PREP)
            print("   prep ok", flush=True)
            # Scroll the whole page at a REAL viewport so every useInView fires.
            steps = 0
            y = 0
            while steps < 200:
                total = int(ev("document.documentElement.scrollHeight"))
                if y >= total:
                    break
                ev(f"window.scrollTo(0,{y})")
                time.sleep(0.28)
                y += int(a.vh * 0.8)
                steps += 1
            ev("window.scrollTo(0,0)")
            time.sleep(0.6)
            print(f"   scrolled {steps} steps", flush=True)
            got = ev(SETTLE, await_promise=True)
            print("   settled", got, flush=True)
            total = int(ev("document.documentElement.scrollHeight"))
            print(f"   capturing {total}px", flush=True)
            r = cmd("Page.captureScreenshot", format="jpeg", quality=88,
                    captureBeyondViewport=True,
                    clip={"x": 0, "y": 0, "width": a.width, "height": min(total, 30000),
                          "scale": 1})
            p = out / f"{slug}{'-dark' if a.dark else ''}.jpg"
            p.write_bytes(base64.b64decode(r["data"]))
            print(f"  {p.name:30} {total:6}px  images {got}  {steps} scroll steps  "
                  f"{p.stat().st_size//1024} KB")
        ws.close()
    finally:
        proc.terminate()
        try: proc.wait(timeout=10)
        except Exception: proc.kill()
        subprocess.run(["rm", "-rf", str(prof)], check=False)
    return 0


if __name__ == "__main__":
    sys.exit(main())
