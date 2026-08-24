"""Shared helpers for pulling published data off federal agency sites.

Two ingests use these (DOL's PERM disclosure files and USCIS's I-140 counts) and
both hit the same two problems: the agencies front their static files with a CDN
that refuses an incomplete client, and XLSX omits empty cells in a way that
silently shifts columns.

Measured while building these, and the reason each helper exists:

* `flag.dol.gov` serves scripts fine. `www.dol.gov` returns 403 "Access Denied"
  to a bare User-Agent and 200 to a full browser header set. `www.uscis.gov`
  behaves like the former; `egov.uscis.gov` and `travel.state.gov` refuse
  automated clients outright and are not fetched by anything here.
* Sustained traffic from one address gets 403 even WITH the full header set: a
  request that returned 200 came back 403 twenty minutes and 240 MB later.
  Hence the backoff.
"""
from __future__ import annotations

import re
import time
import urllib.error
import urllib.request
import zipfile
from xml.etree.ElementTree import iterparse

SPREADSHEET_NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"

# A complete browser header set. A partial one is refused by the CDN in front of
# www.dol.gov and www.uscis.gov, and the refusal looks like a dead link.
BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Sec-Ch-Ua": '"Chromium";v="126", "Not)A;Brand";v="24", "Google Chrome";v="126"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"macOS"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
}


def log(message: str) -> None:
    print(message, flush=True)


def fetch(url: str, referer: str | None = None, attempts: int = 4) -> bytes:
    """GET with the browser header set, backing off on a throttle.

    Raises after the final attempt rather than returning empty. A run that could
    not read the agency is not a run that found no data, and the two must never
    report the same way.
    """
    headers = dict(BROWSER_HEADERS)
    if referer:
        headers["Referer"] = referer

    delay = 20
    for attempt in range(1, attempts + 1):
        try:
            request = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(request, timeout=300) as response:
                return response.read()
        except urllib.error.HTTPError as exc:
            if exc.code not in (403, 429, 503) or attempt == attempts:
                raise
            log(f"  HTTP {exc.code} (attempt {attempt}/{attempts}); waiting {delay}s")
            time.sleep(delay)
            delay *= 3
    raise SystemExit("unreachable")


def discover_links(html: str, pattern: str, host: str) -> dict[str, str]:
    """Map filename to absolute URL for every href matching `pattern`.

    Links are discovered rather than constructed because the agencies move
    them: DOL's current-year disclosure file sits under `/media/` while the
    archive stays under `/sites/dolgov/files/`, and a hardcoded path returns a
    styled 404 that reads exactly like a dead link.
    """
    found: dict[str, str] = {}
    for href in re.findall(r'href="([^"]+)"', html):
        href = href.replace("&amp;", "&")
        name = href.rsplit("/", 1)[-1]
        if not re.match(pattern, name, re.I):
            continue
        found[name] = href if href.startswith("http") else f"{host}{href}"
    return found


def column_index(ref: str) -> int:
    """`BC12` to 54, zero-based.

    XLSX omits empty cells entirely, so indexing a row's <c> children by
    position shifts every column after the first blank one. Each cell's own
    r= reference is the only reliable source of its column.
    """
    n = 0
    for ch in ref:
        if ch.isdigit():
            break
        n = n * 26 + (ord(ch.upper()) - 64)
    return n - 1


def read_shared_strings(archive: zipfile.ZipFile) -> list[str]:
    """The workbook's shared string table, streamed."""
    strings: list[str] = []
    if "xl/sharedStrings.xml" not in archive.namelist():
        return strings
    with archive.open("xl/sharedStrings.xml") as handle:
        for _, element in iterparse(handle, events=("end",)):
            if element.tag == SPREADSHEET_NS + "si":
                strings.append(
                    "".join(t.text or "" for t in element.iter(SPREADSHEET_NS + "t"))
                )
                element.clear()
    return strings


def iter_rows(archive: zipfile.ZipFile, sheet: str, shared: list[str]):
    """Yield each row as {column_index: value}, streaming.

    Streams rather than loading because DOL's disclosure sheet is 1.21 GB of
    XML uncompressed. USCIS's files are a few hundred KB, but one reader for
    both is simpler than two.
    """
    with archive.open(sheet) as handle:
        for _, element in iterparse(handle, events=("end",)):
            if element.tag != SPREADSHEET_NS + "row":
                continue
            row: dict[int, str] = {}
            for cell in element.findall(SPREADSHEET_NS + "c"):
                value = cell.find(SPREADSHEET_NS + "v")
                index = column_index(cell.get("r", "A1"))
                if value is None or value.text is None:
                    if cell.get("t") == "inlineStr":
                        row[index] = "".join(
                            t.text or "" for t in cell.iter(SPREADSHEET_NS + "t")
                        )
                    continue
                if cell.get("t") == "s":
                    i = int(value.text)
                    row[index] = shared[i] if i < len(shared) else ""
                else:
                    row[index] = value.text
            element.clear()
            yield row
