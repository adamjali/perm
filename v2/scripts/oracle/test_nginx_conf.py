#!/usr/bin/env python3
"""Invariants of the front door, scripts/oracle/nginx/permtracker.conf.

Written Sep 29 2026 after a read of the rules found three drifts that no check
could see: the lookup and API locations sent a refusal nginx's stock page with
no Retry-After, crawler limits applied to ordinary pages only, and background
pre-loads counted against a reader's lookup limit (24 refused in an hour for
nothing: a pre-load never asks DOL). nginx also drops an inherited limit_conn
or limit_req the moment a location sets one of its own, so every cap has to be
written out in every proxied location, and this file checks each one is.

Run: python3 scripts/oracle/test_nginx_conf.py   (exit 1 on any failure)
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
CONF_PATH = HERE / "nginx" / "permtracker.conf"
ERRORS_DIR = HERE / "nginx" / "errors"

failures: list[str] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    print(f"  {'ok  ' if ok else 'FAIL'} {name}" + (f"  ({detail})" if detail and not ok else ""))
    if not ok:
        failures.append(name)


def strip_comments(text: str) -> str:
    return "\n".join(line for line in text.splitlines() if not line.lstrip().startswith("#"))


def locations(server: str) -> dict[str, str]:
    """location selector -> body (the file's locations hold no nested blocks)."""
    return {m.group(1).strip(): m.group(2) for m in re.finditer(r"location\s+([^{]+)\{([^}]*)\}", server)}


def zones_in(body: str, directive: str) -> list[str]:
    if directive == "limit_req":
        return re.findall(r"limit_req\s+zone=(\w+)", body)
    return re.findall(r"limit_conn\s+(\w+)\s+\d+", body)


def run(conf_text: str) -> None:
    conf = strip_comments(conf_text)
    server_start = conf.index("server {")
    head, server = conf[:server_start], conf[server_start:]
    locs = locations(server)

    # Every zone a location uses is declared, and every declared zone is used.
    declared_req = set(re.findall(r"limit_req_zone\s+\S+\s+zone=(\w+):", head))
    declared_conn = set(re.findall(r"limit_conn_zone\s+\S+\s+zone=(\w+):", head))
    used_req = {z for b in locs.values() for z in zones_in(b, "limit_req")}
    used_conn = {z for b in locs.values() for z in zones_in(b, "limit_conn")}
    check("every limit_req zone used is declared", used_req <= declared_req, str(used_req - declared_req))
    check("every limit_req zone declared is used", declared_req <= used_req, str(declared_req - used_req))
    check("every limit_conn zone used is declared", used_conn <= declared_conn, str(used_conn - declared_conn))
    check("every limit_conn zone declared is used", declared_conn <= used_conn, str(declared_conn - used_conn))

    proxied = {sel: b for sel, b in locs.items() if "proxy_pass" in b and not sel.startswith("@")}
    public = {sel: b for sel, b in proxied.items() if sel not in ("/_next/",)}
    check("the proxied locations were found", len(proxied) >= 5, str(sorted(proxied)))

    # The whole-app cap on every proxied location (inheritance is dropped).
    for sel, b in proxied.items():
        check(f"{sel}: whole-app in-flight cap", "pt_app" in zones_in(b, "limit_conn"))

    # People and crawlers are limited everywhere a page or API answers.
    crawler_req = {"pt_search", "pt_bot", "pt_bots"}
    crawler_conn = {"pt_search_conn", "pt_bots_conn"}
    for sel, b in public.items():
        req = set(zones_in(b, "limit_req"))
        conn = set(zones_in(b, "limit_conn"))
        check(f"{sel}: crawler rate limits", crawler_req <= req, str(crawler_req - req))
        check(f"{sel}: crawler in-flight caps", crawler_conn <= conn, str(crawler_conn - conn))
        check(f"{sel}: per-address in-flight cap", "pt_perip" in conn)
        check(f"{sel}: some per-person rate limit", bool(req & {"pt_page", "pt_api", "pt_lookup"}))

    # Case lookups carry the lookup limit, pages carry the page and pre-load
    # limits, and the API its own.
    for sel in ("= /perm-case-status", "= /embed/case-status"):
        b = locs.get(sel, "")
        check(f"{sel}: lookup limit", "pt_lookup" in zones_in(b, "limit_req"))
    for sel in ("/", "= /perm-case-status", "= /embed/case-status"):
        req = zones_in(locs.get(sel, ""), "limit_req")
        check(f"{sel}: page and pre-load limits", {"pt_page", "pt_prefetch"} <= set(req))
    check("/api/: its own limit", "pt_api" in zones_in(locs.get("/api/", ""), "limit_req"))

    # People are SLOWED before they are refused; crawlers are refused at once.
    for zone in ("pt_page", "pt_lookup", "pt_api"):
        lines = re.findall(rf"limit_req\s+zone={zone}\s+([^;]*);", server)
        check(f"{zone}: two-stage (delay=), never nodelay",
              bool(lines) and all("delay=" in x and "nodelay" not in x for x in lines), str(lines))
    for zone in ("pt_search", "pt_bot", "pt_bots", "pt_prefetch"):
        lines = re.findall(rf"limit_req\s+zone={zone}\s+([^;]*);", server)
        check(f"{zone}: refused at once (nodelay)", bool(lines) and all("nodelay" in x for x in lines), str(lines))

    # A pre-load never counts against the page or lookup limits, and does count
    # against its own; search engines are outside the shared crawler pool.
    check("pre-load exempt from page limit",
          re.search(r'map \$http_next_router_prefetch \$pt_page_key\s*\{\s*"1"\s+"";', head) is not None)
    check("pre-load has its own allowance",
          re.search(r'map \$http_next_router_prefetch \$pt_prefetch_key\s*\{\s*"1"\s+\$pt_key;\s*default\s+"";', head) is not None)
    lookup_map = re.search(r"\$pt_lookup_key\s*\{([^}]*)\}", head)
    check("pre-load exempt from lookup limit", lookup_map is not None and '"1:1"   "";' in lookup_map.group(1))
    bot_map = re.search(r"\$pt_bot_key\s*\{([^}]*)\}", head)
    check("search engines kept out of the shared crawler pool",
          bot_map is not None and bot_map.group(1).lstrip().startswith('"~^true:[a-z]+:"  "";'))

    # Files served from disk carry no limits.
    for sel in ("/_next/static/", "~ ^/(images|og|lottie|about|agency)/"):
        b = locs.get(sel, "")
        check(f"{sel}: no limits on files from disk", not zones_in(b, "limit_req") and not zones_in(b, "limit_conn"))

    # A refusal keeps its status (no "=" in error_page) and reaches a page that
    # reloads itself, with Retry-After and no-store.
    check("429 keeps its status", re.search(r"error_page 429 @pt_slow_down;", server) is not None)
    check("503 keeps its status", re.search(r"error_page 503 @pt_busy;", server) is not None)
    api = locs.get("/api/", "")
    check("/api/: refusals answer JSON", "error_page 429 @pt_slow_down_api;" in api and "error_page 503 @pt_busy_api;" in api)
    for loc, code, secs in (("@pt_slow_down_api", 429, 30), ("@pt_busy_api", 503, 15)):
        b = locs.get(loc, "")
        check(f"{loc}: JSON {code} with Retry-After {secs}", "default_type application/json;" in b
              and f"return {code} '{{" in b and f"Retry-After {secs} always" in b and 'Cache-Control "no-store" always' in b)
    check("proxy time limit covers the 300 s scorecard job", re.search(r"proxy_read_timeout\s+300s;", server) is not None)
    for loc, code, secs in (("@pt_slow_down", 429, 30), ("@pt_busy", 503, 15)):
        b = locs.get(loc, "")
        check(f"{loc}: serves {code}.html", f"try_files /{code}.html ={code};" in b)
        check(f"{loc}: Retry-After {secs}", f"Retry-After {secs} always" in b)
        check(f"{loc}: never cached", 'Cache-Control "no-store" always' in b)
        page = ERRORS_DIR / f"{code}.html"
        text = page.read_text() if page.exists() else ""
        check(f"{code}.html exists and reloads itself", 'http-equiv="refresh"' in text)
        check(f"{code}.html has no em dash", "—" not in text)


def probe() -> None:
    """The checks must fail on the drifts they exist for."""
    good = CONF_PATH.read_text()
    mutations = {
        "lookup limit counts pre-loads": good.replace('    "1:1"   "";\n', ""),
        "whole-app cap missing from /api/": re.sub(r"(location /api/ \{[^}]*?)\n\s*limit_conn pt_app 64;", r"\1", good, count=1),
        "crawler limits missing from lookups": re.sub(
            r"(location = /perm-case-status \{[^}]*?)\n\s*limit_conn pt_search_conn \d+;\n\s*limit_conn pt_bots_conn \d+;",
            r"\1", good, count=1),
        "people refused instead of slowed": good.replace("zone=pt_page burst=300 delay=150", "zone=pt_page burst=300 nodelay", 1),
        "refusal page drops its status": good.replace("error_page 429 @pt_slow_down;", "error_page 429 = @pt_slow_down;"),
    }
    global failures
    for name, text in mutations.items():
        assert text != good, f"probe {name!r} did not change the file"
        saved, failures = failures, []
        print(f"  (probe: {name})")
        run(text)
        caught = bool(failures)
        failures = saved
        check(f"probe caught: {name}", caught)


if __name__ == "__main__":
    print("front door rules:")
    run(CONF_PATH.read_text())
    print("probes (each must be caught):")
    probe()
    print(f"{len(failures)} failure(s)")
    sys.exit(1 if failures else 0)
