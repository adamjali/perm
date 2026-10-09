"""The PERM Tracker API from Python: a thin client over https://permtracker.app/v1.

    from permtracker import PermTracker
    pt = PermTracker(api_key="pt_live_...")      # or PERMTRACKER_API_KEY
    pt.case("G-100-26045-123456").data["status"]

Every method returns an Answer (data, meta, usage). A refusal raises
PermTrackerError with the API's code, message and retry_after. Standard
library only. Keys go in the Authorization header, never the address.

verify_webhook checks a webhook delivery's signature (Standard Webhooks:
HMAC-SHA256 over "id.timestamp.body", keyed by the whsec_ secret).
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from typing import Any, Callable, Optional

__all__ = ["PermTracker", "PermTrackerError", "Answer", "CsvExport", "Usage", "verify_webhook", "WEBHOOK_EVENTS",
           "EXPORT_KINDS", "DEFAULT_BASE_URL", "__version__"]
__version__ = "0.2.0"
WEBHOOK_EVENTS = ("case.status_changed", "employer.moved", "bulletin.published", "queue.moved", "processing_times.updated")
EXPORT_KINDS = ("cases", "employers", "law-firms", "occupations")
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


@dataclass
class CsvExport:
    csv: str
    rows: Optional[int] = None
    cap: Optional[int] = None
    truncated: bool = False
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


# (status, headers, body bytes) for a request of `method` to `url` with
# `headers` and `data` (JSON bytes or None), or an exception.
Transport = Callable[[str, dict, float, str, Optional[bytes]], "tuple[int, Any, bytes]"]


def _urllib_transport(url: str, headers: dict, timeout: float, method: str = "GET", data: Optional[bytes] = None):
    req = urllib.request.Request(url, headers=headers, method=method, data=data)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:  # noqa: S310 - our own https endpoint
            return res.status, res.headers, res.read()
    except urllib.error.HTTPError as err:
        return err.code, err.headers, err.read()


def _refusal(status: int, res_headers, parsed) -> PermTrackerError:
    err = ((parsed or {}).get("error") or {}) if isinstance(parsed, dict) else {}
    retry = err.get("retryAfter")
    if retry is None:
        retry = _num(res_headers, "Retry-After")
    return PermTrackerError(status, err.get("code") or f"http_{status}", err.get("message") or f"The API answered {status}.",
                            retry, err.get("url"))


def _parse(body: bytes):
    try:
        return json.loads(body.decode("utf-8")) if body else None
    except ValueError:
        return None


class PermTracker:
    def __init__(self, api_key: Optional[str] = None, base_url: str = DEFAULT_BASE_URL, timeout: float = 20.0,
                 transport: Optional[Transport] = None):
        key = api_key if api_key is not None else os.environ.get("PERMTRACKER_API_KEY")
        self.api_key = key.strip() if key and key.strip() else None
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self._transport = transport or _urllib_transport

    def _send(self, path: str, query: Optional[dict], needs_key: bool, method: str, payload: Any, accept: str):
        if needs_key and not self.api_key:
            raise PermTrackerError(401, "missing_key", "This call needs an API key. Make one free at permtracker.app, in Settings, under API keys.")
        q = {k: v for k, v in (query or {}).items() if v is not None and v != ""}
        url = self.base_url + path + (("?" + urllib.parse.urlencode(q)) if q else "")
        headers = {"Accept": accept, "User-Agent": f"permtracker-python/{__version__}"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        data = None
        if payload is not None:
            headers["Content-Type"] = "application/json"
            data = json.dumps(payload).encode("utf-8")
        try:
            return self._transport(url, headers, self.timeout, method, data)
        except Exception as exc:  # noqa: BLE001 - a network failure is the caller's to see
            raise PermTrackerError(0, "network_error", f"Couldn't reach {urllib.parse.urlparse(url).netloc}: {exc}") from exc

    def request(self, path: str, query: Optional[dict] = None, needs_key: bool = True, method: str = "GET",
                payload: Any = None) -> Answer:
        """Any /v1 call that answers JSON: GET, POST with a JSON body, or DELETE."""
        status, res_headers, body = self._send(path, query, needs_key, method, payload, "application/json")
        parsed = _parse(body)
        if status >= 400:
            raise _refusal(status, res_headers, parsed)
        if not isinstance(parsed, dict) or "data" not in parsed:
            raise PermTrackerError(status, "bad_response", "The API's answer wasn't the expected JSON.")
        return Answer(data=parsed["data"], meta=parsed.get("meta") or {}, usage=usage_from(res_headers))

    def get(self, path: str, query: Optional[dict] = None, needs_key: bool = True) -> Answer:
        """GET a /v1 path. Exposed for endpoints this version doesn't wrap yet."""
        return self.request(path, query, needs_key)

    def case(self, case_number: str, live: bool = False) -> Answer:
        """One case by number: PERM, prevailing wage, H-1B LCA, or H-2A, H-2B and CW-1.

        live=True asks DOL now for a number our records don't hold yet (needs the
        live_lookup scope; the plan sets how many a day).
        """
        n = case_number.strip().upper()
        if not CASE_RE.match(n):
            raise PermTrackerError(400, "bad_case_number", f'"{case_number}" isn\'t a DOL case number (like G-100-26045-123456).')
        return self.get("/cases/" + urllib.parse.quote(n), {"live": 1} if live else None)

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
        """Your key's scopes, the plan that applies, the paywall and what you've used. Not counted."""
        return self.get("/me")

    def export(self, kind: str, params: Optional[dict] = None) -> Answer:
        """A search's whole answer, up to the plan's export rows, as JSON. One call.

        kind is cases (the case search's parameters), employers, law-firms or occupations (q).
        """
        return self.get(f"/exports/{_export_kind(kind)}", {**(params or {}), "format": "json"})

    def export_csv(self, kind: str, params: Optional[dict] = None) -> CsvExport:
        """The same export as CSV text, with its row count and whether it was cut at the cap."""
        status, res_headers, body = self._send(f"/exports/{_export_kind(kind)}", {**(params or {}), "format": "csv"}, True,
                                               "GET", None, "text/csv")
        if status >= 400:
            raise _refusal(status, res_headers, _parse(body))
        return CsvExport(csv=body.decode("utf-8"), rows=_num(res_headers, "X-Export-Rows"), cap=_num(res_headers, "X-Export-Cap"),
                         truncated=str(res_headers.get("X-Export-Truncated") or "") == "true", usage=usage_from(res_headers))

    def webhooks(self) -> Answer:
        """The account's webhook endpoints and watches. Needs the webhooks scope."""
        return self.get("/webhooks")

    def create_webhook(self, url: str, events: "list[str]") -> Answer:
        """A new endpoint. Its signing secret is in the answer, once: keep it."""
        return self.request("/webhooks", method="POST", payload={"url": url, "events": list(events)})

    def delete_webhook(self, endpoint_id: str) -> Answer:
        return self.request("/webhooks/" + urllib.parse.quote(endpoint_id, safe=""), method="DELETE")

    def watches(self) -> Answer:
        """The account's watches (the same list webhooks() returns)."""
        return self.get("/watches")

    def watch(self, case_number: Optional[str] = None, employer: Optional[str] = None) -> Answer:
        """Watch a case number or an employer's slug for case.status_changed and employer.moved."""
        if (case_number is None) == (employer is None):
            raise PermTrackerError(400, "missing_argument", "Give a case number or an employer, one of them.")
        return self.request("/watches", method="POST", payload={"caseNumber": case_number} if case_number else {"employer": employer})

    def unwatch(self, target: str, kind: str = "case") -> Answer:
        return self.request("/watches/" + urllib.parse.quote(target, safe=""), {"kind": kind}, method="DELETE")


def _export_kind(kind: str) -> str:
    if kind not in EXPORT_KINDS:
        raise PermTrackerError(400, "bad_argument", f"Exports: {', '.join(EXPORT_KINDS)}.")
    return kind


def verify_webhook(secret: str, headers, raw_body, tolerance_seconds: int = 300, now: Optional[float] = None) -> bool:
    """True when a delivery's signature matches `secret` (the whsec_ value shown when
    the endpoint was made) and its timestamp is within `tolerance_seconds` of now.

    Pass the RAW body, exactly as it arrived (str or bytes): parsing and
    re-serialising JSON changes the bytes. `headers` is any mapping; names are
    matched without regard to case.
    """
    lower = {str(k).lower(): v for k, v in dict(headers).items()}
    msg_id, ts, sig = lower.get("webhook-id"), lower.get("webhook-timestamp"), lower.get("webhook-signature")
    if not msg_id or not ts or not sig or not secret.startswith("whsec_"):
        return False
    try:
        seconds = int(ts)
    except ValueError:
        return False
    if abs((time.time() if now is None else now) - seconds) > tolerance_seconds:
        return False
    try:
        key = base64.b64decode(secret[len("whsec_"):], validate=True)
    except ValueError:
        return False
    body = raw_body.decode("utf-8") if isinstance(raw_body, (bytes, bytearray)) else str(raw_body)
    want = base64.b64encode(hmac.new(key, f"{msg_id}.{ts}.{body}".encode("utf-8"), hashlib.sha256).digest()).decode("ascii")
    # Several space-separated signatures may arrive while a secret is rotated.
    for part in str(sig).split(" "):
        version, _, value = part.partition(",")
        if version == "v1" and hmac.compare_digest(value, want):
            return True
    return False
