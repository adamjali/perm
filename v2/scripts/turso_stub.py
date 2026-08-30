#!/usr/bin/env python3
"""A local stand-in for Turso, so an ingest can be tested in seconds.

WHY THIS EXISTS
---------------
The quarterly ingest takes 30-40 minutes per run, almost all of it
re-downloading 156 MB from DOL and re-parsing 1.21 GB of XML *before* it
reaches the load steps. Six dispatches were spent finding five bugs in those
load steps, one per run, because the only way to exercise them was to run the
whole pipeline against production.

Every one of those bugs was in the last three minutes of a forty-minute job.

This serves the same HTTP surface `lib_turso.Turso` speaks - a single
`POST /v2/pipeline` endpoint - backed by a local SQLite file. Point
TURSO_DATABASE_URL at it and any ingest script runs unmodified, in seconds,
against a database you can throw away and reseed.

FIDELITY THAT MATTERS
---------------------
It returns INTEGERS AS STRINGS, exactly as libSQL does over HTTP. That is not
a quirk worth smoothing over: a diff in build_entity_detail.py silently never
matched because a stored `is_final` came back as '0' and never equalled the
built int 0, so it rewrote all 136,886 rows every night while logging "ok". A
stub that helpfully returned real ints would pass a test that production
fails, which is worse than no stub at all.

It is deliberately NOT a general libSQL implementation. It covers the calls
lib_turso actually makes: execute (with args), close, and multi-statement
pipelines. Anything else should fail loudly rather than be approximated.

USAGE
-----
    python3 scripts/turso_stub.py --db /tmp/t.sqlite --port 8099 &
    TURSO_DATABASE_URL=http://127.0.0.1:8099 TURSO_AUTH_TOKEN=x \
        python3 scripts/turso_migrate_public.py /tmp/artifacts
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer


def to_py(cell: dict):
    """One Hrana argument -> a Python value."""
    t = cell.get("type")
    if t == "null":
        return None
    v = cell.get("value")
    if t == "integer":
        return int(v)
    if t == "float":
        return float(v)
    return v


def to_cell(v):
    """A SQLite value -> one Hrana cell.

    Integers go back as STRINGS because that is what libSQL does. See the
    module docstring: a diff that compares a read value against a built int
    depends on this, and getting it 'right' here would hide the bug.
    """
    if v is None:
        return {"type": "null"}
    if isinstance(v, bool):
        return {"type": "integer", "value": str(int(v))}
    if isinstance(v, int):
        return {"type": "integer", "value": str(v)}
    if isinstance(v, float):
        return {"type": "float", "value": v}
    if isinstance(v, bytes):
        return {"type": "blob", "base64": ""}
    return {"type": "text", "value": str(v)}


class Handler(BaseHTTPRequestHandler):
    db_path = ":memory:"
    lock = threading.Lock()

    def log_message(self, *a):  # quiet
        pass

    def do_POST(self):
        if not self.path.endswith("/v2/pipeline"):
            self.send_error(404)
            return
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        results = []
        with Handler.lock:
            con = sqlite3.connect(Handler.db_path)
            try:
                for req in body.get("requests", []):
                    kind = req.get("type")
                    if kind == "close":
                        results.append({"type": "ok",
                                        "response": {"type": "close"}})
                        continue
                    if kind != "execute":
                        results.append({"type": "error", "error": {
                            "message": f"stub does not implement request type {kind!r}"}})
                        continue
                    stmt = req["stmt"]
                    args = [to_py(a) for a in stmt.get("args", [])]
                    try:
                        cur = con.execute(stmt["sql"], args)
                        rows = [[to_cell(c) for c in r] for r in cur.fetchall()]
                        cols = [{"name": d[0]} for d in (cur.description or [])]
                        results.append({"type": "ok", "response": {
                            "type": "execute",
                            "result": {"cols": cols, "rows": rows,
                                       "affected_row_count": cur.rowcount
                                       if cur.rowcount and cur.rowcount > 0 else 0}}})
                    except Exception as exc:  # surfaced, never swallowed
                        results.append({"type": "error",
                                        "error": {"message": str(exc),
                                                  "code": "SQL_INPUT_ERROR"}})
                con.commit()
            finally:
                con.close()
        out = json.dumps({"baton": None, "base_url": None,
                          "results": results}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(out)))
        self.end_headers()
        self.wfile.write(out)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--db", default="/tmp/turso_stub.sqlite")
    ap.add_argument("--port", type=int, default=8099)
    args = ap.parse_args()
    Handler.db_path = args.db
    # 127.0.0.1 ONLY. A stub that binds 0.0.0.0 serves whatever it is holding
    # to the whole network, and this one is routinely seeded with a copy of
    # production shapes.
    srv = HTTPServer(("127.0.0.1", args.port), Handler)
    print(f"turso stub on http://127.0.0.1:{args.port} -> {args.db}", flush=True)
    srv.serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
