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
