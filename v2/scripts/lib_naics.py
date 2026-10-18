"""NAICS codes as DOL prints them, and their titles from the Census Bureau.

`scripts/data/naics_titles.json` is built by `build_naics_titles.py` from the
Census Bureau's 2022 and 2017 code lists (code -> [title, vintage]).
"""
from __future__ import annotations

import json
import pathlib
import re

_TABLE: dict[str, list] | None = None


def _table() -> dict[str, list]:
    global _TABLE
    if _TABLE is None:
        path = pathlib.Path(__file__).resolve().parent / "data" / "naics_titles.json"
        _TABLE = json.loads(path.read_text())
    return _TABLE


def normalize_naics(raw) -> str | None:
    """The code as digits, or None.

    A spreadsheet can hand back 541511, "541511", "541511.0" or "541511 ".
    Anything that is not two to six digits once that is stripped is not a
    NAICS code, and a wrong code is worse than none, so it is dropped rather
    than trimmed into shape.
    """
    if raw is None:
        return None
    s = str(raw).strip()
    s = re.sub(r"\.0+$", "", s)
    return s if re.fullmatch(r"\d{2,6}", s) else None


def naics_title(code: str | None) -> tuple[str, str] | None:
    """(the code the title belongs to, its title), for a code or its nearest parent.

    An employer that typed a code Census never defined gets the title of the
    closest code above it (541519 -> 54151), and the caller shows WHICH code
    the title belongs to, so a parent's title is never passed off as the
    exact industry.
    """
    if not code:
        return None
    t = _table()
    for n in range(len(code), 1, -1):
        hit = t.get(code[:n])
        if hit:
            return code[:n], hit[0]
    return None


def sector_of(code: str | None) -> tuple[str, str] | None:
    """(the sector's first two-digit code, its title) for any NAICS code, or None.

    Census gives some sectors several two-digit codes and one title
    (Manufacturing is 31, 32 and 33), so a sector is named by its first code,
    the same grouping as SECTOR_GROUPS in src/lib/naicsSectors.ts.
    """
    if not code or len(code) < 2:
        return None
    return _sectors().get(code[:2])


_SECTORS: dict[str, tuple[str, str]] | None = None


def _sectors() -> dict[str, tuple[str, str]]:
    """Each two-digit code -> (its sector's first code, title), built once."""
    global _SECTORS
    if _SECTORS is None:
        first_by_title: dict[str, str] = {}
        twos = sorted(k for k in _table() if len(k) == 2)
        for k in twos:
            first_by_title.setdefault(_table()[k][0], k)
        _SECTORS = {k: (first_by_title[_table()[k][0]], _table()[k][0]) for k in twos}
    return _SECTORS
