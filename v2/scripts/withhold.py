#!/usr/bin/env python3
"""Withhold a name from the site at its owner's request, in one step.

    python3 scripts/withhold.py add [--firm] <page-slug> [--label "Private household employer"] [--yes]
    python3 scripts/withhold.py add "slug|Name as DOL prints it|Label|CASE-1,CASE-2"   # the old form (an employer)
    python3 scripts/withhold.py remove [--firm] <page-slug>
    python3 scripts/withhold.py refresh           # re-gather every entry; number any entry without one
    python3 scripts/withhold.py check             # the live checks and IndexNow alone, nothing saved
    python3 scripts/withhold.py status            # counts only; --show prints the lists locally
    python3 scripts/withhold.py purge             # run by the deploy, after the switch
    (--no-deploy on add, remove or refresh saves without releasing, so several changes ship in one release:
     then run `gh workflow run oracle-deploy.yml -f when=now` and `withhold.py check`.)

What a removal does (convex/lib/withheldNames.ts): the name is masked everywhere as a numbered
label ("Law firm 3", "Employer 1") that links to a neutral page; every row, count, rank and chart
stays; the old URL answers 404 and never redirects; a search by the name finds nothing.

`add`, `remove` and `refresh` (run from the owner's Mac, which reaches the server over ssh):
  1. read the page from the database (read-only, through a tunnel this opens), gather every slug and
     printed spelling it's known by, and show the counts (never a name) before asking to go on;
  2. give the entry its number: the next one for its kind, never reused, skipping any whose neutral
     page address a real page already has;
  3. save WITHHELD_EMPLOYERS, WITHHELD_FIRMS and WITHHELD_NUMBERS in the server's production.env, the
     one source of the lists (a backup of the file is kept beside it), and read them back the way
     systemd hands them over;
  4. mirror the two lists to the GitHub secrets the build reads and to Convex production, whose
     emails, alerts and firm claims read the same database;
  5. redeploy main, so every page cache starts empty; the deploy drops Cloudflare's copies of every
     affected page (`purge`);
  6. check the live site and tell IndexNow which pages changed;
  7. print what is left by hand: Search Console's and Bing's removal tools, and the reply.
Runbook, legal notes and the reply template: docs/PRIVACY_REMOVALS.md.

Nothing this prints names anyone: the lists are private, and `purge` runs on a public repository's
runner. Only `status --show` prints entries, on the owner's own machine.
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
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib_withheld import (  # noqa: E402
    BASE,
    NUMBERS_SETTING,
    SETTINGS,
    Entry,
    affected_paths,
    check_fields,
    drop,
    gather,
    neutral_path,
    numbered,
    parse,
    parse_env,
    parse_numbers,
    render_kinds,
    render_numbers,
    shown_label,
    slug_taken,
    unlisted_spellings,
    upsert,
)

ENV_FILE = "/srv/permtracker/app/env/production.env"
V2 = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://permtracker.app"
UA = "PERMTracker-withhold/1.0 (+https://permtracker.app)"
SERVER_KEYS = (*SETTINGS.values(), NUMBERS_SETTING)


def sh(*cmd: str, stdin: str | None = None, check: bool = True) -> str:
    r = subprocess.run(list(cmd), input=stdin, capture_output=True, text=True, cwd=V2)
    if check and r.returncode != 0:
        raise SystemExit(f"{cmd[0]} failed ({r.returncode}); see its own output above")
    return r.stdout


def read_server() -> dict[str, str]:
    """The three settings as the server's env file holds them."""
    out = sh("ssh", "-o", "ConnectTimeout=15", "permtracker", f"sudo -n grep '^WITHHELD_' {ENV_FILE} || true")
    values: dict[str, str] = {}
    for line in out.splitlines():
        key, _, value = line.partition("=")
        if key in SERVER_KEYS:
            values[key] = value.strip().strip('"')
    return values


def server_state() -> tuple[list[Entry], dict[str, int]]:
    values = read_server()
    return parse_env(values), parse_numbers(values.get(NUMBERS_SETTING))


def write_server(values: dict[str, str]) -> None:
    for v in values.values():
        if '"' in v or "\n" in v:
            raise SystemExit("an entry holds a quote or a line break; fix it before saving")
    # The script travels on stdin with the values base64-encoded inside it, so none
    # appears in a process listing or passes through a second shell's quoting.
    lines = ["set -e", f"F={ENV_FILE}", 'cp -p "$F" "$F.bak-$(date +%Y%m%d%H%M%S)"']
    for key in SERVER_KEYS:
        lines.append(f"sed -i '/^{key}=/d' \"$F\"")
        value = values.get(key, "")
        if value:
            encoded = base64.b64encode(value.encode()).decode()
            lines.append(f"V=\"$(printf %s '{encoded}' | base64 -d)\"")
            lines.append(f"printf '{key}=\"%s\"\\n' \"$V\" >> \"$F\"")
    for key in SERVER_KEYS:
        lines.append(f"printf '%s\\n' \"$(systemd-run --quiet --wait --pipe -p EnvironmentFile=\"$F\" "
                     f"/bin/sh -c 'printf %s \"${key}\"' | base64 -w0)\"")
    got = sh("ssh", "-o", "ConnectTimeout=15", "permtracker", "sudo -n bash -s", stdin="\n".join(lines) + "\n")
    # One line per setting, an empty one for an unset setting.
    read = got.split("\n")[: len(SERVER_KEYS)]
    back = [base64.b64decode(x).decode() if x else "" for x in read]
    if len(read) != len(SERVER_KEYS) or back != [values.get(k, "") for k in SERVER_KEYS]:
        raise SystemExit("the server's settings didn't read back as written; nothing else was changed")
    print("server: saved, and read back as systemd hands them over")


def write_secrets(values: dict[str, str]) -> None:
    for key in SETTINGS.values():
        if values.get(key):
            sh("gh", "secret", "set", key, stdin=values[key])
        else:
            sh("gh", "secret", "delete", key, check=False)
    print("GitHub secrets: updated")


def write_convex(values: dict[str, str]) -> None:
    """Convex reads the same database for its emails, alerts and firm claims, so it masks the same names."""
    for key in SETTINGS.values():
        if values.get(key):
            sh("npx", "convex", "env", "set", key, "--prod", stdin=values[key])
        else:
            sh("npx", "convex", "env", "remove", key, "--prod", check=False)
    print("Convex production: updated")


NO_DEPLOY = False


def redeploy(wait: bool) -> None:
    if NO_DEPLOY:
        # --no-deploy: save several changes, then ship them in one release (each release empties the page cache).
        print("deploy: skipped (--no-deploy). Ship with: gh workflow run oracle-deploy.yml -f when=now, then withhold.py check")
        return
    before = sh("gh", "run", "list", "--workflow", "oracle-deploy.yml", "--limit", "1", "--json", "databaseId",
                "-q", ".[0].databaseId", check=False).strip()
    sh("gh", "workflow", "run", "oracle-deploy.yml", "--ref", "main", "-f", "when=now")
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
                raise SystemExit("the deploy didn't succeed; the settings are saved, so re-run it from GitHub")
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
    """Run fn(query) against production, read-only, through tunnels this opens and closes."""
    from lib_db import Database, query_dicts  # noqa: E402
    token = sh("ssh", "-n", "permtracker", "sudo -n cat /srv/permtracker/secrets/db_ro.jwt").strip()
    main_port, lca_port = "18091", "18093"
    tunnel = subprocess.Popen(["ssh", "-N", "-o", "ExitOnForwardFailure=yes",
                               "-L", f"{main_port}:127.0.0.1:8080", "-L", f"{lca_port}:127.0.0.1:8082", "permtracker"])
    try:
        time.sleep(4)
        db = Database(f"http://127.0.0.1:{main_port}", token, lca_url=f"http://127.0.0.1:{lca_port}")
        return fn(lambda sql, args: query_dicts(db, sql, args))
    finally:
        tunnel.terminate()


def _says_a_name(body: str, entries: list[Entry]) -> bool:
    low = body.lower()
    return any(n.lower() in low for e in entries for n in e.all_names() if len(n) >= 5)


def check_live(entries: list[Entry], touched: list[Entry], paths: list[str], removed: bool = False) -> None:
    """The site as a reader meets it. Prints what passed and failed, never a name or an address."""
    held = [e for e in touched if not removed]
    for e in touched:
        code, _ = fetch(f"{BASE[e.kind]}/{e.slug}")
        want = 200 if removed else 404
        print(f"live: the old page answers {code}" + ("" if code == want else f"  <- expected {want}"))
    for e in held:
        np = neutral_path(e)
        if not np:
            print("live: this entry has no number yet, so no neutral page (run `refresh`)")
            continue
        code, body = fetch(np)
        ok = code == 200 and shown_label(e) in body and not _says_a_name(body, entries)
        print(f"live: the neutral page answers {code}, " + ("shows the label and no name" if ok else "<- check it by hand"))
    own = {f"{BASE[e.kind]}/{s}" for e in touched for s in e.all_slugs()} | {neutral_path(e) for e in touched}
    pages = [p for p in paths if "?" not in p and not p.endswith(".xml") and "/badge/" not in p and p not in own][:12]
    bad = labelled = 0
    for p in pages:
        code, body = fetch(p)
        if code == 200 and _says_a_name(body, entries):
            bad += 1
        if code == 200 and any(shown_label(e) in body for e in held):
            labelled += 1
    print(f"live: {len(pages) - bad} of {len(pages)} pages that showed it show no withheld name"
          + (f"; {labelled} show the label" if held else ""))
    for e in held:
        param = "firm" if e.kind == "firm" else "q"
        code, body = fetch(f"/api/case-search?{param}={urllib.parse.quote(e.name)}")
        try:
            answer = json.loads(body) if body else {}
        except ValueError:
            answer = {}
        found = bool(answer.get("rows")) and not answer.get("noMatch")
        print(f"live: a case search by the name answers {code}, " + ("finds nothing" if not found else "<- it found rows"))
        if e.cases:
            code, body = fetch(f"/embed/case-status?case={urllib.parse.quote(e.cases[0])}")
            ok = code == 200 and shown_label(e) in body and not _says_a_name(body, entries)
            print(f"live: a case lookup by number answers {code}, " + ("shows the label and no name" if ok else "<- check it by hand"))


def tell_indexnow(paths: list[str]) -> None:
    urls = [SITE + p for p in paths if "?" not in p and not p.endswith(".xml") and "/badge/" not in p]
    fd, name = tempfile.mkstemp(prefix="withhold-", text=True)
    try:
        with os.fdopen(fd, "w") as f:
            f.write("\n".join(urls) + "\n")
        os.chmod(name, 0o600)
        out = sh("node", "scripts/indexnow.mjs", "--urls", name, check=False)
        print("IndexNow: " + ("accepted" if "Accepted" in out else "not confirmed; run indexnow by hand"))
    finally:
        os.unlink(name)


def save(entries: list[Entry], numbers: dict[str, int]) -> None:
    for e in entries:
        check_fields(e)
    values = {**render_kinds(entries), NUMBERS_SETTING: render_numbers(numbers)}
    write_server(values)
    write_secrets(values)
    write_convex(values)


def finish(entries: list[Entry], touched: list[Entry], wait: bool, removed: bool = False) -> None:
    if not wait:
        return
    paths = with_database(lambda q: sorted({p for e in touched for p in affected_paths(q, e)}))
    check_live(entries, touched, paths, removed=removed)
    tell_indexnow(paths)


def merged(old: Entry, new: Entry) -> Entry:
    """`new` with everything `old` knew kept: a spelling once withheld stays withheld, whatever the map says today."""
    return Entry(
        old.kind, old.slug, old.name, new.label or old.label,
        tuple(dict.fromkeys([*old.cases, *new.cases])),
        old.number or new.number,
        tuple(dict.fromkeys([*old.all_slugs(), *new.all_slugs()])),
        tuple(dict.fromkeys([*old.all_names(), *new.all_names()])),
    )


def confirm(question: str, yes: bool) -> None:
    if yes:
        return
    if input(f"{question} [y/N] ").strip().lower() not in ("y", "yes"):
        raise SystemExit("nothing was changed")


def cmd_add(args: list[str], kind: str, label: str | None, yes: bool, wait: bool) -> None:
    if len(args) != 1:
        raise SystemExit(__doc__)
    raw = args[0]
    given: Entry | None = None
    if "|" in raw:
        old = parse(raw, kind)
        if len(old) != 1:
            raise SystemExit('give exactly one entry: "slug|Name|Label|CASE-1,CASE-2"')
        given = old[0]
    slug = given.slug if given else raw.strip().lower()
    current, numbers = server_state()
    existing = next((e for e in current if e.kind == kind and e.slug == slug), None)
    keep_label = label or (given.label if given else None) or (existing.label if existing else None)

    def work(q):
        g = gather(q, kind, slug, name=given.name if given else None, label=keep_label,
                   cases=given.cases if given else (), number=existing.number if existing else None)
        entry = merged(existing, g.entry) if existing else g.entry
        listed, marks = numbered(upsert(current, entry), numbers, lambda k, s: slug_taken(q, s))
        return g, listed, marks

    g, listed, marks = with_database(work)
    new = next(e for e in listed if e.kind == kind and e.slug == slug)
    print(f"{kind} page found: {g.counts['slugs']} slugs, {g.counts['names']} printed spellings, "
          f"{g.counts['rows']} rows naming it" + (f", {g.counts['cases']} case numbers" if kind == "employer" else ""))
    print(f"it will read \"{shown_label(new)}\" and link to {neutral_path(new)}"
          + (" (it already had an entry; it keeps its number)" if existing else ""))
    confirm("Withhold it?", yes)
    save(listed, marks)
    redeploy(wait)
    finish(listed, [new], wait)
    print(
        "\nLeft by hand (docs/PRIVACY_REMOVALS.md):\n"
        "  1. Search Console > Removals: the old page by prefix, and Clear snippet for any page the request named.\n"
        "  2. Bing Webmaster Tools > Block URLs: the old page, URL & Cache, from the account that owns the site.\n"
        "  3. Reply from support@ with the template, once the live checks above pass."
    )


def cmd_remove(args: list[str], kind: str | None, yes: bool, wait: bool) -> None:
    if len(args) != 1:
        raise SystemExit(__doc__)
    current, numbers = server_state()
    slug = args[0].strip().lower()
    gone = [e for e in current if e.slug == slug and (kind is None or e.kind == kind)]
    if not gone:
        raise SystemExit("no entry for that page")
    if len(gone) > 1:
        raise SystemExit("an employer and a firm share that slug; say which with --firm or --employer")
    confirm("Put the name back on the site?", yes)
    kept = drop(current, slug, gone[0].kind)
    # The numbers' high-water marks stay, so the removed entry's number is never given again.
    save(kept, numbers)
    redeploy(wait)
    finish(kept, gone, wait, removed=True)


def cmd_refresh(yes: bool, wait: bool) -> None:
    current, numbers = server_state()
    if not current:
        raise SystemExit("nothing is withheld")

    missing = 0

    def work(q):
        nonlocal missing
        out: list[Entry] = []
        for e in current:
            try:
                g = gather(q, e.kind, e.slug, name=e.name, label=e.label, cases=e.cases, number=e.number)
                out.append(merged(e, g.entry))
            except LookupError:
                # Its page is gone (merged or no longer published): it stays withheld exactly as listed.
                missing += 1
                out.append(e)
        return numbered(out, numbers, lambda k, s: slug_taken(q, s))

    listed, marks = with_database(work)
    fresh = sum(1 for a, b in zip(current, listed) if a.number != b.number)
    grown = sum(1 for a, b in zip(current, listed) if len(b.all_slugs()) + len(b.all_names()) > len(a.all_slugs()) + len(a.all_names()))
    print(f"{len(listed)} entries: {fresh} given a number, {grown} with spellings added"
          + (f", {missing} whose page wasn't found (kept as listed)" if missing else ""))
    confirm("Save and redeploy?", yes)
    save(listed, marks)
    redeploy(wait)
    finish(listed, listed, wait)


def cmd_check() -> None:
    """The live checks and IndexNow alone, for every entry: after a deploy the tool didn't see through."""
    entries, _ = server_state()
    if not entries:
        raise SystemExit("nothing is withheld")
    finish(entries, entries, True)


def cmd_status(show: bool) -> None:
    entries, numbers = server_state()
    by_kind = {k: sum(1 for e in entries if e.kind == k) for k in SETTINGS}
    print(f"{by_kind['employer']} employers and {by_kind['firm']} firms withheld on the server; "
          f"{sum(1 for e in entries if not e.number)} without a number")
    if show:
        for e in entries:
            print(f"  {e.kind}: {shown_label(e)}  {e.text()}")


def cmd_purge() -> None:
    """The deploy's step: drop Cloudflare's copies of every affected page. Prints counts only."""
    entries = parse_env(dict(os.environ))
    token, zone = os.environ.get("CF_PURGE_TOKEN"), os.environ.get("CF_ZONE_ID")
    if not entries:
        print("withheld: none; nothing to purge")
        return
    if not token or not zone:
        print("withheld: no Cloudflare token here; skipping the purge")
        return
    from lib_db import Database, query_dicts  # noqa: E402
    db = Database()

    def q(s: str, a: list) -> list[dict]:
        return query_dicts(db, s, a)

    paths = sorted({p for e in entries for p in affected_paths(q, e)})
    # A spelling the nightly map gave the page since the entry was made is masked by its
    # name, but its own slug isn't in the list: say so, in a count, so it gets refreshed.
    unlisted = sum(unlisted_spellings(q, e) for e in entries)
    if unlisted:
        print(f"::warning::withheld: {unlisted} page-map spellings aren't in the lists; run `withhold.py refresh`")
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
        if i + 30 < len(urls):
            time.sleep(0.5)
    print(f"withheld: {len(entries)}; {len(urls)} pages purged in {(len(urls) + 29) // 30} requests, {failed} failed")
    if failed:
        raise SystemExit(1)


def main(argv: list[str]) -> None:
    global NO_DEPLOY
    NO_DEPLOY = "--no-deploy" in argv
    # Nothing shipped yet with --no-deploy, so the live checks would read the old site: they run after the release.
    wait = "--no-wait" not in argv and not NO_DEPLOY
    yes = "--yes" in argv
    label: str | None = None
    args: list[str] = []
    it = iter(argv)
    for a in it:
        if a == "--label":
            label = next(it, None)
        elif not a.startswith("--"):
            args.append(a)
    kind = "firm" if "--firm" in argv else "employer"
    if args[:1] == ["add"]:
        cmd_add(args[1:], kind, label, yes, wait)
    elif args[:1] == ["remove"]:
        cmd_remove(args[1:], "firm" if "--firm" in argv else ("employer" if "--employer" in argv else None), yes, wait)
    elif args[:1] == ["refresh"]:
        cmd_refresh(yes, wait)
    elif args[:1] == ["check"]:
        cmd_check()
    elif args[:1] == ["status"]:
        cmd_status("--show" in argv)
    elif args[:1] == ["purge"]:
        cmd_purge()
    else:
        raise SystemExit(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])
