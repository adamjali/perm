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

    # The analytics relay goes to PostHog, never to the app; internal locations
    # are only reached by nginx itself (the refresh mirror).
    relay = locs.get("^~ /ingest/", "")
    mail_sel = r"~ ^/(prefs(/.*)?|unsubscribe|(queue|case|bulletin|employer)-alert/.*|firm-claim/.*)$"
    mail = locs.get(mail_sel, "")
    proxied = {sel: b for sel, b in locs.items() if "proxy_pass" in b and not sel.startswith("@")
               and sel not in ("^~ /ingest/", mail_sel) and "internal;" not in b}
    # /mcp is checked on its own below: it keeps its own in-flight cap and no
    # crawler pools (an assistant's notification stream must not hold a render
    # slot for hours, and tool calls are not crawling).
    mcp = proxied.pop("= /mcp", "")
    public = {sel: b for sel, b in proxied.items() if sel not in ("/_next/",)}

    # The relay: PostHog's host, looked up at request time, the visitor's own
    # address forwarded, no cookies or credentials, a per-address limit, and
    # never the app's in-flight cap (it does not use the app).
    check("analytics relay exists", bool(relay))
    check("relay goes to PostHog by variable (looked up per request)",
          "proxy_pass https://$pt_posthog_host;" in relay and "resolver " in relay)
    check("relay forwards the visitor's address", "proxy_set_header X-Forwarded-For $remote_addr;" in relay)
    check("relay sends PostHog's Host", "proxy_set_header Host $pt_posthog_host;" in relay)
    check("relay strips cookies and credentials",
          'proxy_set_header Cookie "";' in relay and 'proxy_set_header Authorization "";' in relay)
    check("relay has a per-address limit", "pt_api" in zones_in(relay, "limit_req"))
    check("relay does not hold app slots", "pt_app" not in zones_in(relay, "limit_conn"))
    # The email links go to the backend, never the app, with only the headers
    # it needs (Cloudflare's own would be refused by the backend's Cloudflare),
    # never stored, never framed.
    check("email-link relay exists", bool(mail))
    check("email links go to the backend, looked up per request",
          "proxy_pass https://$pt_convex_site;" in mail and "resolver " in mail
          and "giant-dragon-464.convex.site" in mail)
    check("email links send only the headers the backend needs",
          "proxy_pass_request_headers off;" in mail and "proxy_set_header X-Forwarded-For $remote_addr;" in mail
          and "proxy_set_header Content-Type $content_type;" in mail)
    check("email-link pages are never stored", 'add_header Cache-Control "private, no-store" always;' in mail
          and "proxy_hide_header Cache-Control;" in mail)
    check("email-link pages can't be framed", "add_header X-Frame-Options DENY always;" in mail)
    check("email links have a per-address limit and hold no app slots",
          "pt_api" in zones_in(mail, "limit_req") and "pt_app" not in zones_in(mail, "limit_conn"))
    ph_map = re.search(r"map \$uri \$pt_posthog_host\s*\{([^}]*)\}", head)
    check("assets go to the assets host", ph_map is not None and "us-assets.i.posthog.com" in ph_map.group(1))

    # Lookups from everyone together hold at most a share of the app's slots.
    for sel in ("= /perm-case-status", "= /embed/case-status"):
        m = re.search(r"limit_conn\s+pt_lookup_conn\s+(\d+);", locs.get(sel, ""))
        check(f"{sel}: lookups-together cap below the whole-app cap", m is not None and int(m.group(1)) < 64)
    # The frozen Chrome 151 label that walked case numbers on Oct 6 2026 gets a
    # small allowance of lookups together, on both lookup pages.
    for sel in ("= /perm-case-status", "= /embed/case-status"):
        check(f"{sel}: the frozen label's lookups are limited together",
              "pt_stale_label" in zones_in(locs.get(sel, ""), "limit_req"))
    stale = re.search(r"\$pt_stale_label\s*\{([^}]*)\}", head)
    check("the frozen-label limit counts lookups only, under that exact label",
          stale is not None and '"~^lookups:Mozilla/5\\.0 \\(Windows NT 10\\.0; Win64; x64\\)' in stale.group(1)
          and "Chrome/151\\.0\\.0\\.0 Safari/537\\.36$\"" in stale.group(1) and 'default "";' in stale.group(1))
    lookup_all = re.search(r"\$pt_lookup_all\s*\{([^}]*)\}", head)
    check("pre-loads are not counted as lookups together",
          lookup_all is not None and '"1:1"   "";' in lookup_all.group(1))

    # Refresh calls reach both copies.
    rev = locs.get("~ ^/api/revalidate-", "")
    check("refresh calls go to the first copy and are mirrored to the second",
          "mirror /__pt_revalidate_w2;" in rev and "proxy_pass http://permtracker_w1;" in rev)
    check("the mirror target is internal and goes to the second copy",
          "internal;" in locs.get("= /__pt_revalidate_w2", "")
          and "proxy_pass http://permtracker_w2$request_uri;" in locs.get("= /__pt_revalidate_w2", ""))
    cdn = re.search(r"map \$upstream_http_cache_control \$pt_cdn_cc\s*\{([^}]*)\}", head)
    check("shareable pages may be served stale while refreshing and when the server errors",
          cdn is not None and "stale-while-revalidate=" in cdn.group(1) and "stale-if-error=" in cdn.group(1))
    ups = re.findall(r"upstream (permtracker_\w+)\s*\{([^}]*)\}", head)
    check("every app upstream closes idle connections before Node does (under 5 s)",
          len(ups) >= 3 and all(re.search(r"keepalive_timeout\s+[1-4]s;", b) for _, b in ups), str([n for n, _ in ups]))
    check("the copies' upstream files are included",
          all(f"include /etc/nginx/permtracker-active-{n}.conf;" in head for n in ("upstream", "w1", "w2")))
    check("the proxied locations were found", len(proxied) >= 5, str(sorted(proxied)))

    # The whole-app cap on every proxied location (inheritance is dropped).
    for sel, b in proxied.items():
        check(f"{sel}: whole-app in-flight cap", "pt_app" in zones_in(b, "limit_conn"))

    # People and crawlers are limited everywhere a page or API answers.
    crawler_req = {"pt_search", "pt_bot", "pt_bots", "pt_meta"}
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

    # The public API: the app's cap, its own share of it, JSON refusals.
    v1 = locs.get("~ ^/v1(/|$)", "")
    check("/v1: exists", bool(v1))
    m = re.search(r"limit_conn\s+pt_apiall\s+(\d+);", v1)
    check("/v1: API calls together hold a share of the app's slots", m is not None and int(m.group(1)) < 64)
    check("/v1: refusals answer JSON", "error_page 429 @pt_slow_down_api;" in v1 and "error_page 503 @pt_busy_api;" in v1)
    # The MCP server: its own cap, never the app's, a per-person rate, streams
    # passed through unbuffered.
    check("/mcp: exists", bool(mcp))
    check("/mcp: its own in-flight cap, not the app's",
          "pt_mcpall" in zones_in(mcp, "limit_conn") and "pt_app" not in zones_in(mcp, "limit_conn"))
    check("/mcp: per-address cap and rate", "pt_perip" in zones_in(mcp, "limit_conn") and "pt_api" in zones_in(mcp, "limit_req"))
    check("/mcp: refusals answer JSON", "error_page 429 @pt_slow_down_api;" in mcp and "error_page 503 @pt_busy_api;" in mcp)
    check("/mcp: streams unbuffered", "proxy_buffering off;" in mcp)

    # People are SLOWED before they are refused; crawlers are refused at once.
    for zone in ("pt_page", "pt_lookup", "pt_api"):
        lines = re.findall(rf"limit_req\s+zone={zone}\s+([^;]*);", server)
        check(f"{zone}: two-stage (delay=), never nodelay",
              bool(lines) and all("delay=" in x and "nodelay" not in x for x in lines), str(lines))
    meta = re.search(r"map \$pt_bot_key \$pt_meta_key\s*\{([^}]*)\}", head)
    check("Meta's crawler has its own lower allowance",
          meta is not None and '"meta-externalagent" meta;' in meta.group(1)
          and re.search(r"zone=pt_meta:\S+\s+rate=30r/m;", head) is not None)
    for zone in ("pt_search", "pt_bot", "pt_bots", "pt_meta", "pt_prefetch"):
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
    icons = r"~ ^/(favicon\.ico|icon-192\.png|icon-512\.png|icon\.svg|badge-72\.png|apple-touch-icon\.png)$"
    check("the root icons are served from disk", "root /srv/permtracker/app/live/public;" in locs.get(icons, "")
          and "max-age=86400" in locs.get(icons, ""))
    for sel in ("/_next/static/", "~ ^/(images|og|lottie|about|agency)/", icons):
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
        # The counting image: only a browser that draws the page fetches it.
        check(f"{code}.html carries the counting image", f'src="/__pt/busy-seen?k={code}"' in text)

    # People shown a refusal: nginx answers the image itself (never the app,
    # which is full when this matters), logs it to the health check's own file,
    # and keeps one address from filling that file.
    seen = locs.get("= /__pt/busy-seen", "")
    check("busy-seen: logged to its own file", "access_log /var/log/permtracker-busy/seen.log pt_busy_seen;" in seen)
    # empty_gif, never `return`: a return answers before limit_req runs.
    check("busy-seen: answered by nginx, after its limit", "empty_gif;" in seen and "return" not in seen
          and "proxy_pass" not in seen)
    check("busy-seen: one address can't fill the log", zones_in(seen, "limit_req") == ["pt_busy_seen"])

    # The watchdog's check on nginx itself (bin/permtracker-watchdog). Answered
    # by nginx with no limit, so a full app can never fail it.
    alive = locs.get("= /__pt/nginx-alive", "")
    check("nginx-alive: answered by nginx itself", "return 204;" in alive and "proxy_pass" not in alive)
    check("nginx-alive: no limit can refuse it", "limit_req" not in alive and "limit_conn" not in alive)
    fmt = re.search(r"log_format pt_busy_seen '([^']*)'", head)
    check("busy-seen: log records time, status, address, kind and browser",
          fmt is not None and all(v in fmt.group(1) for v in ("$time_iso8601", "$status", "$remote_addr", "$arg_k", "$http_user_agent")))

    # The automatic defense's log (bin/permtracker-defend reads it every
    # minute). Declared at server level, beside the main log: an access_log
    # there replaces the one nginx.conf sets, so naming only the new one would
    # stop the main log.
    server_level = server[: server.index("location")]
    check("defend: request log kept at server level",
          "access_log /var/log/permtracker-busy/defend.log pt_defend" in server_level)
    check("defend: main access log still written", "access_log /var/log/nginx/access.log;" in server_level)
    fmt = re.search(r"log_format pt_defend '([^']*)'", head)
    check("defend: log records time, status, network, crawler flag, path and browser",
          fmt is not None and fmt.group(1).startswith('$msec $status $http_x_pt_asn $http_x_pt_verified_bot "$uri" "$http_user_agent"'))


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
        "relay sends the server's address": good.replace(
            "proxy_set_header X-Forwarded-For $remote_addr;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-Host $host;\n        proxy_set_header Cookie",
            "proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-Host $host;\n        proxy_set_header Cookie", 1),
        "lookups-together cap removed": good.replace("        limit_conn pt_lookup_conn 24;\n", "", 1),
        "frozen-label limit dropped from a lookup page": good.replace(
            "        limit_req zone=pt_stale_label burst=10 nodelay;\n", "", 1),
        "frozen-label limit catches every page": good.replace('    "~^lookups:Mozilla', '    "~:Mozilla', 1),
        "API share of the app's slots removed": good.replace("        limit_conn pt_apiall 24;\n", "", 1),
        "MCP streams hold app slots": good.replace("        limit_conn pt_mcpall 48;\n", "        limit_conn pt_mcpall 48;\n        limit_conn pt_app 64;\n", 1),
        "MCP streams buffered": good.replace("        proxy_buffering off;\n        proxy_read_timeout 3600s;\n", "        proxy_read_timeout 3600s;\n", 1),
        "refresh no longer mirrored": good.replace("        mirror /__pt_revalidate_w2;\n", "", 1),
        "email links forward Cloudflare's headers": good.replace("        proxy_pass_request_headers off;\n", "", 1),
        "email-link pages stored again": good.replace('        add_header Cache-Control "private, no-store" always;\n', "", 1),
        "edge no longer serves stale on errors": good.replace(", stale-if-error=86400", "", 1),
        "upstream keeps idle connections past Node's": good.replace("    keepalive_timeout 4s;\n", "", 1),
        "Meta's allowance dropped from a page": good.replace("        limit_req zone=pt_meta burst=15 nodelay;\n", "", 1),
        "refusal views no longer logged": good.replace("        access_log /var/log/permtracker-busy/seen.log pt_busy_seen;\n", "", 1),
        "refusal-view log loses the status": good.replace("'$time_iso8601 $status $remote_addr", "'$time_iso8601 $remote_addr", 1),
        "counting image answered before its limit": good.replace("        empty_gif;\n    }", "        return 204;\n    }", 1),
        "nginx's own check sent through the app": good.replace(
            "        return 204;\n    }", "        proxy_pass http://permtracker_app;\n    }", 1),
        "nginx's own check behind the app's cap": good.replace(
            "        return 204;\n    }", "        limit_conn pt_app 64;\n        return 204;\n    }", 1),
        "main access log dropped for the defense log": good.replace("    access_log /var/log/nginx/access.log;\n", "", 1),
        "defense log loses the network": good.replace("$status $http_x_pt_asn $http_x_pt_verified_bot", "$status $http_x_pt_verified_bot", 1),
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
