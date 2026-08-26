"""Minimal Turso/libSQL HTTP client.

Deliberately NOT a dependency. Turso speaks Hrana-over-HTTP at /v2/pipeline,
which is a JSON POST, so a client library would buy us nothing and would put
a third copy of the slug rules in a third language. Keeping the migration in
Python means it imports `entity_key` and `slugify` from the ingest scripts
that already own them, and a slug computed differently in the writer than in
the reader is a detail page that 404s from its own index.
"""
from __future__ import annotations

import json
import pathlib
import time
import urllib.error
import urllib.request


def env(name: str, path: str = ".env.local") -> str:
    for line in pathlib.Path(path).read_text().splitlines():
        if line.startswith(name + "="):
            return line.split("=", 1)[1].strip()
    raise SystemExit(f"{name} missing from {path}")


def lit(v):
    """A Python value as an Hrana argument.

    Integers travel as STRINGS on purpose: JSON numbers are doubles, and a
    case count or a wage silently losing precision is the kind of defect that
    looks fine until someone reconciles a total.
    """
    if v is None:
        return {"type": "null"}
    if isinstance(v, bool):
        return {"type": "integer", "value": str(int(v))}
    if isinstance(v, int):
        return {"type": "integer", "value": str(v)}
    if isinstance(v, float):
        return {"type": "float", "value": v}
    return {"type": "text", "value": str(v)}


class Turso:
    def __init__(self, url: str | None = None, token: str | None = None):
        self.url = (url or env("TURSO_DATABASE_URL")).replace("libsql://", "https://")
        self.token = token or env("TURSO_AUTH_TOKEN")

    def pipeline(self, requests: list[dict], *, timeout: int = 180, retries: int = 4):
        body = json.dumps({"requests": requests}).encode()
        last = None
        for attempt in range(retries):
            req = urllib.request.Request(
                self.url + "/v2/pipeline", data=body,
                headers={"Authorization": f"Bearer {self.token}",
                         "Content-Type": "application/json"})
            try:
                with urllib.request.urlopen(req, timeout=timeout) as resp:
                    out = json.loads(resp.read())
                break
            except (urllib.error.URLError, TimeoutError, OSError) as e:
                last = e
                if attempt == retries - 1:
                    raise
                time.sleep(1.5 * (attempt + 1))
        else:  # pragma: no cover
            raise last  # type: ignore[misc]
        # A pipeline returns 200 even when a statement failed. Surfacing that
        # is the whole point: a loader that reports success over a failed
        # INSERT is worse than one that crashes.
        for r in out.get("results", []):
            if r.get("type") == "error":
                raise RuntimeError("libsql error: " + json.dumps(r.get("error"))[:600])
        return out

    def execute(self, sql: str, args: list | None = None):
        reqs = [{"type": "execute", "stmt": {
            "sql": sql, "args": [lit(a) for a in (args or [])]}}]
        return self.pipeline(reqs + [{"type": "close"}])["results"][0]

    def scalar(self, sql: str, args: list | None = None):
        res = self.execute(sql, args or [])
        rows = res["response"]["result"]["rows"]
        if not rows:
            return None
        cell = rows[0][0]
        return None if cell["type"] == "null" else cell["value"]

    def script(self, statements: list[str]):
        """Run DDL in order, one pipeline, failing loudly on the first error."""
        reqs = [{"type": "execute", "stmt": {"sql": s}} for s in statements]
        return self.pipeline(reqs + [{"type": "close"}])
