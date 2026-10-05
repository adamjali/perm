"""Shared plumbing for the reference-data loaders (O*NET, BLS, Census, BEA,
DOL's wage tables, State's visa issuances).

These sources change once a month at most and usually once a year, and every
loader asks the same three questions:

* Has the file changed since the last load? `seen_before` compares a SHA-256 of
  the bytes against the record the last successful load kept in `perm_docs`.
* Which rows actually differ? `sync_rows` reads the table's current rows,
  writes only new and changed ones and deletes keys the source no longer has,
  so a monthly re-run of an unchanged year writes nothing.
* What did the load find? Each loader stamps freshness only after its writes
  succeed, and records its run either way.
"""
from __future__ import annotations

import hashlib
import io
import time
import zipfile
from collections.abc import Iterator, Sequence
from xml.etree.ElementTree import iterparse

from lib_gov_data import SPREADSHEET_NS, iter_rows, read_shared_strings

from lib_turso import (Turso, canon_hash, insert_stmts, query_rows, read_doc, run_stmts, stmt,
                       write_doc)


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def seen_before(db: Turso, record_key: str, digest: str) -> bool:
    """Whether the last successful load of `record_key` read these exact bytes."""
    doc = read_doc(db, record_key) or {}
    return doc.get("sha256") == digest


def keep_record(db: Turso, record_key: str, digest: str, **facts) -> None:
    """Remember what a successful load read, for `seen_before` next time."""
    write_doc(db, record_key, {"sha256": digest, "loadedAt": int(time.time() * 1000), **facts})


def sync_rows(
    db: Turso,
    table: str,
    key_cols: Sequence[str],
    cols: Sequence[str],
    rows: Sequence[Sequence],
    *,
    scope_sql: str = "",
    scope_args: Sequence = (),
    per_stmt: int = 300,
    per_request: int = 4,
    pause_s: float = 0.0,
) -> dict[str, int]:
    """Make `table` (or the slice `scope_sql` selects) hold exactly `rows`.

    `cols` lists every column, key columns first in `key_cols` order. Rows are
    compared through `canon_hash`, so 93205 stored as 93205.0 isn't a change.
    Returns {"written": n, "deleted": n, "unchanged": n}. `pause_s` sleeps
    between write requests: a long backfill must not crowd the site's reads
    (a history load stalled the database on Oct 3 2026).
    """
    nkey = len(key_cols)
    assert list(cols[:nkey]) == list(key_cols), "key columns must lead `cols`"
    where = f" WHERE {scope_sql}" if scope_sql else ""
    current = {
        tuple(str(v) if v is not None else "" for v in r[:nkey]): canon_hash(r)
        for r in query_rows(db, f"SELECT {', '.join(cols)} FROM {table}{where}", list(scope_args))
    }
    changed: list[Sequence] = []
    wanted: set[tuple] = set()
    for r in rows:
        key = tuple(str(v) if v is not None else "" for v in r[:nkey])
        wanted.add(key)
        if current.get(key) != canon_hash(r):
            changed.append(r)
    gone = [k for k in current if k not in wanted]

    statements = list(insert_stmts(table, cols, changed, per_stmt))
    for i in range(0, len(statements), per_request):
        run_stmts(db, statements[i:i + per_request], per_request)
        if pause_s and i + per_request < len(statements):
            time.sleep(pause_s)
    for i in range(0, len(gone), 200):
        chunk = gone[i:i + 200]
        cond = " OR ".join("(" + " AND ".join(f"{c} = ?" for c in key_cols) + ")" for _ in chunk)
        run_stmts(db, [stmt(f"DELETE FROM {table} WHERE {cond}", [v for k in chunk for v in k])])
    return {"written": len(changed), "deleted": len(gone), "unchanged": len(rows) - len(changed)}


REL_NS = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"


def sheet_paths(archive: zipfile.ZipFile) -> dict[str, str]:
    """Each sheet's name to its path inside the workbook, in tab order.

    `sheet1.xml` is only a convention, so the names come from the workbook and
    the paths from its relationships, the way Excel itself resolves them.
    """
    ids: list[tuple[str, str]] = []
    with archive.open("xl/workbook.xml") as f:
        for _, el in iterparse(f, events=("end",)):
            if el.tag == SPREADSHEET_NS + "sheet":
                ids.append((el.get("name", ""), el.get(REL_NS + "id", "")))
    targets: dict[str, str] = {}
    with archive.open("xl/_rels/workbook.xml.rels") as f:
        for _, el in iterparse(f, events=("end",)):
            if el.get("Id"):
                t = el.get("Target", "").lstrip("/")
                targets[el.get("Id")] = t if t.startswith("xl/") else f"xl/{t}"
    return {name: targets[rid] for name, rid in ids if rid in targets}


def sheet_rows(xlsx: bytes, name: str | None = None) -> Iterator[list[str]]:
    """The rows of one sheet (the first when `name` is None) as lists of text.

    Built on lib_gov_data's streaming reader, so a 60 MB workbook never sits in
    memory, and on each cell's own reference, so a blank cell can't shift the
    columns after it.
    """
    archive = zipfile.ZipFile(io.BytesIO(xlsx))
    paths = sheet_paths(archive)
    if name is None:
        path = next(iter(paths.values()))
    elif name in paths:
        path = paths[name]
    else:
        raise KeyError(f"no sheet named {name!r} (has {list(paths)})")
    shared = read_shared_strings(archive)
    for row in iter_rows(archive, path, shared):
        width = max(row) + 1 if row else 0
        yield [row.get(i, "") for i in range(width)]
