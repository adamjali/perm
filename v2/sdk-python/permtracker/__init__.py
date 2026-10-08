"""The PERM Tracker API from Python: a thin client over https://permtracker.app/v1.

    from permtracker import PermTracker
    pt = PermTracker(api_key="pt_live_...")      # or PERMTRACKER_API_KEY
    pt.case("G-100-26045-123456").data["status"]

Every method returns an Answer (data, meta, usage). A refusal raises
PermTrackerError with the API's code, message and retry_after. Standard
library only. Keys go in the Authorization header, never the address.
"""

from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from typing import Any, Callable, Optional

__all__ = ["PermTracker", "PermTrackerError", "Answer", "Usage", "DEFAULT_BASE_URL", "__version__"]
__version__ = "0.1.0"
DEFAULT_BASE_URL = "https://permtracker.app/v1"
CASE_RE = re.compile(r"^[A-Z]{1,2}(-[A-Z])?-\d{3}-\d{5}-\d{6}$")


class PermTrackerError(Exception):
    """The API refused, or couldn't be reached. `code` is the API's own."""

    def __init__(self, status: int, code: str, message: str, retry_after: Optional[int] = None, url: Optional[str] = None):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.retry_after = retry_after
        self.url = url


@dataclass
class Usage:
    per_minute: Optional[int] = None
    remaining_this_minute: Optional[int] = None
    today: Optional[int] = None
    per_day: Optional[int] = None
    month: Optional[int] = None
    per_month: Optional[int] = None


@dataclass
class Answer:
    data: Any
    meta: dict = field(default_factory=dict)
    usage: Usage = field(default_factory=Usage)


def _num(headers, name: str, part: int = 0) -> Optional[int]:
    raw = headers.get(name) if headers is not None else None
    if not raw:
        return None
    try:
        return int(str(raw).split("/")[part])
    except (ValueError, IndexError):
        return None


def usage_from(headers) -> Usage:
    return Usage(
        per_minute=_num(headers, "RateLimit-Limit"),
        remaining_this_minute=_num(headers, "RateLimit-Remaining"),
        today=_num(headers, "X-Calls-Today", 0),
        per_day=_num(headers, "X-Calls-Today", 1),
        month=_num(headers, "X-Calls-Month", 0),
        per_month=_num(headers, "X-Calls-Month", 1),
    )


# (status, headers, body bytes) for a GET of `url` with `headers`, or an exception.
Transport = Callable[[str, dict, float], "tuple[int, Any, bytes]"]


def _urllib_transport(url: str, headers: dict, timeout: float):
    req = urllib.request.Request(url, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:  # noqa: S310 - our own https endpoint
            return res.status, res.headers, res.read()
    except urllib.error.HTTPError as err:
        return err.code, err.headers, err.read()


class PermTracker:
    def __init__(self, api_key: Optional[str] = None, base_url: str = DEFAULT_BASE_URL, timeout: float = 20.0,
                 transport: Optional[Transport] = None):
        key = api_key if api_key is not None else os.environ.get("PERMTRACKER_API_KEY")
        self.api_key = key.strip() if key and key.strip() else None
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self._transport = transport or _urllib_transport

    def get(self, path: str, query: Optional[dict] = None, needs_key: bool = True) -> Answer:
        """GET a /v1 path. Exposed for endpoints this version doesn't wrap yet."""
        if needs_key and not self.api_key:
            raise PermTrackerError(401, "missing_key", "This call needs an API key. Make one free at permtracker.app, in Settings, under API keys.")
        q = {k: v for k, v in (query or {}).items() if v is not None and v != ""}
        url = self.base_url + path + (("?" + urllib.parse.urlencode(q)) if q else "")
        headers = {"Accept": "application/json", "User-Agent": f"permtracker-python/{__version__}"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        try:
            status, res_headers, body = self._transport(url, headers, self.timeout)
        except Exception as exc:  # noqa: BLE001 - a network failure is the caller's to see
            raise PermTrackerError(0, "network_error", f"Couldn't reach {urllib.parse.urlparse(url).netloc}: {exc}") from exc
        try:
            parsed = json.loads(body.decode("utf-8")) if body else None
        except ValueError:
            parsed = None
        if status >= 400:
            err = (parsed or {}).get("error") or {} if isinstance(parsed, dict) else {}
            retry = err.get("retryAfter")
            if retry is None:
                retry = _num(res_headers, "Retry-After")
            raise PermTrackerError(status, err.get("code") or f"http_{status}", err.get("message") or f"The API answered {status}.",
                                   retry, err.get("url"))
        if not isinstance(parsed, dict) or "data" not in parsed:
            raise PermTrackerError(status, "bad_response", "The API's answer wasn't the expected JSON.")
        return Answer(data=parsed["data"], meta=parsed.get("meta") or {}, usage=usage_from(res_headers))

    def case(self, case_number: str) -> Answer:
        """One case by number: PERM, prevailing wage, H-1B LCA, or H-2A, H-2B and CW-1."""
        n = case_number.strip().upper()
        if not CASE_RE.match(n):
            raise PermTrackerError(400, "bad_case_number", f'"{case_number}" isn\'t a DOL case number (like G-100-26045-123456).')
        return self.get("/cases/" + urllib.parse.quote(n))

    def estimate(self, case: Optional[str] = None, filed: Optional[str] = None) -> Answer:
        """When a pending PERM case is likely to be decided: by case number or filing date (YYYY-MM-DD)."""
        if not case and not filed:
            raise PermTrackerError(400, "missing_argument", "Give a case number or a filing date.")
        return self.get("/estimate", {"case": case} if case else {"filed": filed})

    def queue(self) -> Answer:
        return self.get("/queue")

    def visa_bulletin(self, month: Optional[str] = None) -> Answer:
        return self.get("/visa-bulletin", {"month": month})

    def employers(self, q: str, limit: Optional[int] = None) -> Answer:
        return self.get("/employers", {"q": q, "limit": limit})

    def employer(self, slug: str) -> Answer:
        return self.get("/employers/" + urllib.parse.quote(slug))

    def law_firms(self, q: str, limit: Optional[int] = None) -> Answer:
        return self.get("/law-firms", {"q": q, "limit": limit})

    def law_firm(self, slug: str) -> Answer:
        return self.get("/law-firms/" + urllib.parse.quote(slug))

    def occupations(self, q: str, limit: Optional[int] = None) -> Answer:
        return self.get("/occupations", {"q": q, "limit": limit})

    def occupation(self, slug: str) -> Answer:
        return self.get("/occupations/" + urllib.parse.quote(slug))

    def lookup_employer(self, name: str) -> Answer:
        """The employer page a printed name belongs to. No key needed."""
        return self.get("/lookup/employer", {"name": name}, needs_key=False)

    def me(self) -> Answer:
        """Your key's plan, limits and use. Not counted."""
        return self.get("/me")
