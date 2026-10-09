"""permtracker: the PERM Tracker API on the command line (Python edition).

Same commands as `npx permtracker`. The key comes from --key, then
PERMTRACKER_API_KEY, then the file `login` writes
(~/.config/permtracker/config.json, readable by you alone).
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Any, Optional

from . import EXPORT_KINDS, WEBHOOK_EVENTS, PermTracker, PermTrackerError, __version__

COMMANDS = {
    "case": "one case: PERM (G-), wage request (P-), LCA (I-), H-2A, H-2B, CW-1",
    "estimate": "when a pending PERM case is likely to be decided (a number, or --filed YYYY-MM-DD)",
    "queue": "DOL's processing times and the pending queue",
    "bulletin": "a visa bulletin, the newest by default (or YYYY-MM)",
    "employers": "search employers", "employer": "one employer by slug",
    "firms": "search law firms", "firm": "one law firm by slug",
    "jobs": "search occupations", "job": "one occupation by slug",
    "lookup": "the employer page a printed name belongs to (no key)",
    "export": "a whole search, CSV by default: cases (the case search's name=value parameters), employers, law-firms or occupations (q=...)",
    "watch": "watch a case for your webhooks (--employer <slug> for an employer); nothing after it lists your watches",
    "unwatch": "stop watching a case (--employer <slug> for an employer)",
    "webhooks": "your webhook endpoints; webhooks add <url> <event ...>; webhooks remove <id>",
    "me": "your key, your plan and what you've used",
    "login": "save your key", "logout": "forget it",
}


def config_path(env: Optional[dict] = None) -> Path:
    env = os.environ if env is None else env
    base = env.get("XDG_CONFIG_HOME") or str(Path.home() / ".config")
    return Path(base) / "permtracker" / "config.json"


def saved_key() -> Optional[str]:
    try:
        return json.loads(config_path().read_text()).get("apiKey")
    except (OSError, ValueError):
        return None


def render(value: Any, indent: str = "") -> str:
    """A plain listing of an answer: nested objects indented, lists one item a line."""
    if value is None or value == []:
        return f"{indent}none"
    if isinstance(value, list):
        return "\n".join(f"{indent}-\n{render(v, indent + '  ')}" if isinstance(v, (dict, list)) and v else f"{indent}- {v}" for v in value)
    if isinstance(value, dict):
        lines = []
        for k, v in value.items():
            if isinstance(v, (dict, list)) and v:
                lines.append(f"{indent}{k}:\n{render(v, indent + '  ')}")
            else:
                lines.append(f"{indent}{k}: {'none' if v is None or v == [] else v}")
        return "\n".join(lines)
    return f"{indent}{value}"


def export_params(args: list) -> dict:
    """An export's name=value arguments as query parameters."""
    params = {}
    for a in args:
        name, eq, value = a.partition("=")
        if not eq or not name:
            raise PermTrackerError(400, "bad_argument", f'"{a}" isn\'t name=value. Give the search\'s parameters like q=acme state=CA.')
        params[name] = value
    return params


def parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="permtracker", description="DOL case status, estimates and PERM data from permtracker.app",
                                epilog=f"Webhook events: {', '.join(WEBHOOK_EVENTS)}. "
                                       "Make a free key at https://permtracker.app/settings (API keys).")
    p.add_argument("command", choices=sorted(COMMANDS), help="; ".join(f"{k}: {v}" for k, v in COMMANDS.items()))
    p.add_argument("args", nargs="*")
    p.add_argument("--json", action="store_true", help="print the API's own JSON")
    p.add_argument("--key", help="an API key, instead of the saved one")
    p.add_argument("--filed", help="a filing date, YYYY-MM-DD, for estimate")
    p.add_argument("--live", action="store_true", help="case: ask DOL now when our records don't hold the number yet")
    p.add_argument("--employer", help="watch or unwatch an employer by slug")
    p.add_argument("--format", choices=["csv", "json"], help="export: csv (the default) or json")
    p.add_argument("--out", help="export: write to this file instead of the screen")
    p.add_argument("--version", action="version", version=f"permtracker {__version__}")
    return p


def run(argv: list) -> int:
    a = parser().parse_args(argv)
    text = " ".join(a.args).strip()
    if a.command == "login":
        key = (a.key or input("Paste your PERM Tracker API key (pt_live_...): ")).strip()
        if not re.fullmatch(r"pt_(live|test)_[0-9A-Za-z]{38}", key):
            print("That isn't a PERM Tracker key: keys start with pt_live_ (or pt_test_ for the sandbox) and are 46 characters.",
                  file=sys.stderr)
            return 1
        me = PermTracker(api_key=key).me().data
        path = config_path()
        path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        path.write_text(json.dumps({"apiKey": key}) + "\n")
        os.chmod(path, 0o600)
        print(f"Saved. Key {me['key']['id']}, {me['plan']['name']} plan, {me['usage']['remainingToday']} calls left today.")
        return 0
    if a.command == "logout":
        config_path().unlink(missing_ok=True)
        print("Forgot the saved key.")
        return 0
    pt = PermTracker(api_key=a.key or os.environ.get("PERMTRACKER_API_KEY") or saved_key())

    def need(what: str) -> str:
        if not text:
            raise PermTrackerError(400, "missing_argument", f"Give {what}.")
        return text

    c = a.command
    if c == "export":
        return run_export(pt, a)
    if c == "case": ans = pt.case(need("a case number"), live=a.live)
    elif c == "estimate": ans = pt.estimate(filed=a.filed) if a.filed else pt.estimate(case=need("a case number, or --filed YYYY-MM-DD"))
    elif c == "queue": ans = pt.queue()
    elif c == "bulletin": ans = pt.visa_bulletin(a.args[0] if a.args else None)
    elif c == "employers": ans = pt.employers(need("a name to search"))
    elif c == "employer": ans = pt.employer(need("an employer's slug (search with employers)"))
    elif c == "firms": ans = pt.law_firms(need("a name to search"))
    elif c == "firm": ans = pt.law_firm(need("a law firm's slug (search with firms)"))
    elif c == "jobs": ans = pt.occupations(need("a job title to search"))
    elif c == "job": ans = pt.occupation(need("an occupation's slug (search with jobs)"))
    elif c == "lookup": ans = pt.lookup_employer(need("an employer's name"))
    elif c == "watch":
        if a.employer: ans = pt.watch(employer=a.employer)
        elif text: ans = pt.watch(case_number=text)
        else:
            ans = pt.watches()
            ans.data = ans.data.get("watches")
    elif c == "unwatch":
        ans = pt.unwatch(a.employer, kind="employer") if a.employer else pt.unwatch(need("a case number, or --employer <slug>"))
    elif c == "webhooks":
        sub, rest = (a.args[0], a.args[1:]) if a.args else (None, [])
        if sub == "add":
            if len(rest) < 2:
                raise PermTrackerError(400, "missing_argument", f"Give an https address and at least one event: {', '.join(WEBHOOK_EVENTS)}.")
            ans = pt.create_webhook(rest[0], rest[1:])
        elif sub == "remove":
            if not rest:
                raise PermTrackerError(400, "missing_argument", "Give an endpoint's id (list them with webhooks).")
            ans = pt.delete_webhook(rest[0])
        elif sub is None:
            ans = pt.webhooks()
            ans.data = ans.data.get("endpoints")
        else:
            print(f'Unknown webhooks command "{sub}": use add or remove, or nothing to list them.', file=sys.stderr)
            return 1
    else: ans = pt.me()
    if a.json:
        print(json.dumps({"data": ans.data, "meta": ans.meta}, indent=2))
    else:
        print(render(ans.data))
        if ans.meta.get("source"):
            print(f"\nSource: {ans.meta['source']}" + (f" (as of {ans.meta['asOf']})" if ans.meta.get("asOf") else ""))
    return 0


def run_export(pt: PermTracker, a) -> int:
    if not a.args or a.args[0] not in EXPORT_KINDS:
        print(f"Name what to export: {', '.join(EXPORT_KINDS)}.", file=sys.stderr)
        return 1
    kind, params = a.args[0], export_params(a.args[1:])
    fmt = a.format or ("json" if a.json else "csv")
    if fmt == "csv":
        got = pt.export_csv(kind, params)
        text, rows, truncated, cap = got.csv, got.rows, got.truncated, got.cap
    else:
        page = pt.export(kind, params)
        text = json.dumps({"data": page.data, "meta": page.meta}, indent=2) + "\n"
        rows, truncated, cap = page.data.get("count"), page.data.get("truncated"), page.data.get("cap")
    if a.out:
        Path(a.out).write_text(text)
        print(f"Wrote {rows if rows is not None else 'the'} rows to {a.out}.", file=sys.stderr)
    else:
        sys.stdout.write(text)
    if truncated:
        print(f"More matched than your plan's {cap or ''} rows; narrow the search to get the rest.", file=sys.stderr)
    return 0


def main() -> None:
    try:
        sys.exit(run(sys.argv[1:]))
    except PermTrackerError as err:
        print(err.message + (f" (try again in {err.retry_after} seconds)" if err.retry_after else ""), file=sys.stderr)
        if err.url:
            print(err.url, file=sys.stderr)
        sys.exit(3 if err.status == 404 else 2)


if __name__ == "__main__":
    main()
