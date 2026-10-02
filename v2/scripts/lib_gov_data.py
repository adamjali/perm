"""Shared helpers for pulling published data off federal agency sites.

The DOL and USCIS ingests all hit the same two problems: the agencies front
their static files with a CDN that refuses an incomplete client, and XLSX omits
empty cells in a way that silently shifts columns.

* `flag.dol.gov` serves scripts as they are. `www.dol.gov` and `www.uscis.gov`
  answer a bare User-Agent with 403 and a full browser header set with 200;
  `egov.uscis.gov` and `travel.state.gov` refuse automated clients outright
  and nothing here fetches them.
* Sustained traffic from one address draws a 403 even with the full header
  set, which is address reputation rather than the client, so `fetch` backs
  off rather than retrying at once.
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


# A large disclosure workbook can take minutes to arrive.
FETCH_TIMEOUT_S = 300
FETCH_ATTEMPTS = 4
# Backoff starts here and triples: 20 s, 60 s, 180 s.
BACKOFF_FIRST_S = 20
BACKOFF_FACTOR = 3
# Throttle answers worth waiting out. Anything else (a 404 above all) raises
# at once, because retrying only delays the real error.
RETRYABLE_STATUS = (403, 429, 503)
# Between consecutive files from the same agency in one run.
POLITE_PAUSE_S = 1.5


def log(message: str) -> None:
    print(message, flush=True)


def fetch(url: str, referer: str | None = None, attempts: int = FETCH_ATTEMPTS) -> bytes:
    """GET with the browser header set, backing off on a throttle.

    Raises after the final attempt rather than returning empty. A run that could
    not read the agency is not a run that found no data, and the two must never
    report the same way.
    """
    headers = dict(BROWSER_HEADERS)
    if referer:
        headers["Referer"] = referer

    delay = BACKOFF_FIRST_S
    for attempt in range(1, attempts + 1):
        try:
            request = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(request, timeout=FETCH_TIMEOUT_S) as response:
                return response.read()
        except urllib.error.HTTPError as exc:
            if exc.code not in RETRYABLE_STATUS or attempt == attempts:
                raise
            log(f"  HTTP {exc.code} (attempt {attempt}/{attempts}); waiting {delay}s")
            time.sleep(delay)
            delay *= BACKOFF_FACTOR
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


def quarter_end(fy: int, quarter: int) -> str:
    """The last day of a federal fiscal quarter: FY2026 Q1 ends 2025-12-31."""
    return {1: f"{fy - 1}-12-31", 2: f"{fy}-03-31", 3: f"{fy}-06-30", 4: f"{fy}-09-30"}[quarter]


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
