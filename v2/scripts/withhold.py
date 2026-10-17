#!/usr/bin/env python3
"""Withhold a person's name from the site at their request, in one step.

    python3 scripts/withhold.py add "slug|Name as DOL prints it|Label|CASE-1,CASE-2"
    python3 scripts/withhold.py remove slug
    python3 scripts/withhold.py status            # counts only; --show prints the list locally
    python3 scripts/withhold.py purge             # run by the deploy, after the switch

`add` and `remove` (run from the owner's Mac, which reaches the server over ssh):
  1. update WITHHELD_EMPLOYERS in the server's production.env, the one source of the list
     (a backup of the file is kept beside it), and read it back the way systemd hands it over;
  2. mirror it to the GitHub secret of the same name, which the build reads;
  3. redeploy main, so every page cache starts empty and the build prerenders without the
     name; the deploy then drops Cloudflare's copies of every affected page (`purge`);
  4. check the live site and tell IndexNow (Bing and the rest) which pages changed;
  5. print what is left by hand: Google's Removals tool and the reply.
Runbook, legal notes and the reply template: docs/PRIVACY_REMOVALS.md.

Nothing this prints names the person: the list is private, and `purge` runs on a public
repository's runner. Only `status --show` prints entries, on the owner's own machine.
"""

from __future__ import annotations

import base64
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib_withheld import Entry, affected_paths, drop, parse, render, upsert  # noqa: E402

ENV_FILE = "/srv/permtracker/app/env/production.env"
V2 = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://permtracker.app"
UA = "PERMTracker-withhold/1.0 (+https://permtracker.app)"


def sh(*cmd: str, stdin: str | None = None, check: bool = True) -> str:
    r = subprocess.run(list(cmd), input=stdin, capture_output=True, text=True, cwd=V2)
    if check and r.returncode != 0:
        raise SystemExit(f"{cmd[0]} failed ({r.returncode}); see its own output above")
    return r.stdout


def server_list() -> list[Entry]:
    out = sh("ssh", "-o", "ConnectTimeout=15", "permtracker",
             f"sudo -n sed -n 's/^WITHHELD_EMPLOYERS=//p' {ENV_FILE}")
    return parse(out.strip().strip('"'))


def write_server(entries: list[Entry]) -> None:
    value = render(entries)
    if '"' in value or "\n" in value:
        raise SystemExit("an entry holds a quote or a line break; fix it before saving")
    # The script travels on stdin with the list base64-encoded inside it, so neither
    # appears in a process listing or passes through a second shell's quoting.
    encoded = base64.b64encode(value.encode()).decode()
    script = "\n".join([
        "set -e",
        f"F={ENV_FILE}",
        f"V=\"$(printf %s '{encoded}' | base64 -d)\"",
        'cp -p "$F" "$F.bak-$(date +%Y%m%d%H%M%S)"',
        "sed -i '/^WITHHELD_EMPLOYERS=/d' \"$F\"",
        'printf \'WITHHELD_EMPLOYERS="%s"\\n\' "$V" >> "$F"',
        'systemd-run --quiet --wait --pipe -p EnvironmentFile="$F" /usr/bin/printenv WITHHELD_EMPLOYERS',
    ]) + "\n"
    got = sh("ssh", "-o", "ConnectTimeout=15", "permtracker", "sudo -n bash -s", stdin=script)
    if got.strip() != value:
        raise SystemExit("the server's setting didn't read back as written; nothing else was changed")
    print(f"server: {len(entries)} withheld, read back as systemd hands it over")


def write_secret(entries: list[Entry]) -> None:
    sh("gh", "secret", "set", "WITHHELD_EMPLOYERS", stdin=render(entries))
    print("GitHub secret: updated")


def redeploy(wait: bool) -> None:
    before = sh("gh", "run", "list", "--workflow", "oracle-deploy.yml", "--limit", "1", "--json", "databaseId",
                "-q", ".[0].databaseId", check=False).strip()
    sh("gh", "workflow", "run", "oracle-deploy.yml", "--ref", "main")
    print("deploy: started (a fresh release, so no page cache holds the name)")
    if not wait:
        return
    run = ""
    for _ in range(30):
        time.sleep(5)
        run = sh("gh", "run", "list", "--workflow", "oracle-deploy.yml", "--limit", "1", "--json", "databaseId",
                 "-q", ".[0].databaseId", check=False).strip()
        if run and run != before:
            break
    for _ in range(90):
        info = json.loads(sh("gh", "run", "view", run, "--json", "status,conclusion", check=False) or "{}")
        if info.get("status") == "completed":
            print(f"deploy: {info.get('conclusion')}")
            if info.get("conclusion") != "success":
                raise SystemExit("the deploy didn't succeed; the setting is saved, so re-run it from GitHub")
            return
        time.sleep(30)
    raise SystemExit("the deploy is still running after 45 minutes; check it on GitHub")


def fetch(path: str) -> tuple[int, str]:
    req = urllib.request.Request(SITE + path, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, r.read().decode("utf-8", "ignore")
    except urllib.error.HTTPError as e:
        return e.code, ""


def with_database(fn):
    """Run fn(query) against production, read-only, through a tunnel this opens and closes."""
    from lib_db import Database, query_dicts  # noqa: E402
    token = sh("ssh", "-n", "permtracker", "sudo -n cat /srv/permtracker/secrets/db_ro.jwt").strip()
    port = "18091"
    tunnel = subprocess.Popen(["ssh", "-N", "-o", "ExitOnForwardFailure=yes", "-L",
                               f"{port}:127.0.0.1:8080", "permtracker"])
    try:
        time.sleep(4)
        db = Database(f"http://127.0.0.1:{port}", token)
        return fn(lambda sql, args: query_dicts(db, sql, args))
    finally:
        tunnel.terminate()


def check_live(entries: list[Entry], paths: list[str]) -> None:
    names = [e.name.lower() for e in entries]
    for e in entries:
        code, _ = fetch(f"/perm-employers/{e.slug}")
        print(f"live: a withheld employer's page answers {code}" + ("" if code == 404 else "  <- expected 404"))
    pages = [p for p in paths if "?" not in p and not p.endswith(".xml")][:12]
    bad = 0
    for p in pages:
        code, body = fetch(p)
        if code == 200 and any(n in body.lower() for n in names):
            bad += 1
    print(f"live: {len(pages) - bad} of {len(pages)} affected pages checked show no withheld name")


def tell_indexnow(paths: list[str]) -> None:
    urls = [SITE + p for p in paths if "?" not in p and not p.endswith(".xml")]
    fd, name = tempfile.mkstemp(prefix="withhold-", text=True)
    try:
        with os.fdopen(fd, "w") as f:
            f.write("\n".join(urls) + "\n")
        os.chmod(name, 0o600)
        out = sh("node", "scripts/indexnow.mjs", "--urls", name, check=False)
        print("IndexNow: " + ("accepted" if "Accepted" in out else "not confirmed; run indexnow by hand"))
    finally:
        os.unlink(name)


def change(new_entries: list[Entry], touched: list[Entry], wait: bool) -> None:
    write_server(new_entries)
    write_secret(new_entries)
    redeploy(wait)
    if not wait:
        return
    paths = with_database(lambda q: sorted({p for e in touched for p in affected_paths(q, e)}))
    check_live(new_entries, paths)
    tell_indexnow(paths)


def cmd_add(raw: str, wait: bool) -> None:
    entries = parse(raw)
    if len(entries) != 1:
        raise SystemExit('give exactly one entry: "slug|Name|Label|CASE-1,CASE-2"')
    new = entries[0]
    change(upsert(server_list(), new), [new], wait)
    print(
        "\nLeft by hand (docs/PRIVACY_REMOVALS.md):\n"
        "  1. Search Console > Removals > New request > Temporarily remove URL: the employer page.\n"
        "  2. Same, Clear snippet: any page the person named in their request.\n"
        "  3. Reply from support@ with the template, once the live checks above pass."
    )


def cmd_remove(slug: str, wait: bool) -> None:
    current = server_list()
    gone = [e for e in current if e.slug == slug.strip().lower()]
    if not gone:
        raise SystemExit("no entry for that page")
    change(drop(current, slug), gone, wait)


def cmd_status(show: bool) -> None:
    entries = server_list()
    print(f"{len(entries)} withheld on the server")
    if show:
        for e in entries:
            print("  " + e.text())


def cmd_purge() -> None:
    """The deploy's step: drop Cloudflare's copies of every affected page. Prints counts only."""
    entries = parse(os.environ.get("WITHHELD_EMPLOYERS"))
    token, zone = os.environ.get("CF_PURGE_TOKEN"), os.environ.get("CF_ZONE_ID")
    if not entries:
        print("withheld: none; nothing to purge")
        return
    if not token or not zone:
        print("withheld: no Cloudflare token here; skipping the purge")
        return
    from lib_db import Database, query_dicts  # noqa: E402
    db = Database()
    paths = sorted({p for e in entries for p in affected_paths(lambda s, a: query_dicts(db, s, a), e)})
    urls = [SITE + p for p in paths]
    failed = 0
    for i in range(0, len(urls), 30):
        body = json.dumps({"files": urls[i:i + 30]}).encode()
        req = urllib.request.Request(
            f"https://api.cloudflare.com/client/v4/zones/{zone}/purge_cache", data=body, method="POST",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json", "User-Agent": UA})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                failed += 0 if json.load(r).get("success") else 1
        except Exception:
            failed += 1
    print(f"withheld: {len(entries)}; {len(urls)} pages purged in {(len(urls) + 29) // 30} requests, {failed} failed")
    if failed:
        raise SystemExit(1)


def main(argv: list[str]) -> None:
    wait = "--no-wait" not in argv
    args = [a for a in argv if not a.startswith("--")]
    if args[:1] == ["add"] and len(args) == 2:
        cmd_add(args[1], wait)
    elif args[:1] == ["remove"] and len(args) == 2:
        cmd_remove(args[1], wait)
    elif args[:1] == ["status"]:
        cmd_status("--show" in argv)
    elif args[:1] == ["purge"]:
        cmd_purge()
    else:
        raise SystemExit(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])
