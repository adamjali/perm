"""api.data.gov: the key, and the request budget every reader on it shares.

api.data.gov is the GSA gateway in front of regulations.gov, congress.gov and
GovInfo. One key covers all of them (its developer manual, read Oct 27 2026:
the key "gives you access to all APIs from agencies participating in
api.data.gov's service"), with 1,000 requests an hour across all of them.

THE KEY. Read from DATA_GOV_API_KEY. Until the owner's key is installed the
readers run on DEMO_KEY, which the manual allows 30 requests an hour and 50 a
day per IP address. regulations.gov and congress.gov each answered DEMO_KEY with
`X-RateLimit-Limit: 10` on Oct 27 2026, so their own hourly allowance for it is
ten. So a DEMO_KEY run gets a small budget (DEMO_RUN_BUDGET) and says so in a
warning; a keyed run gets KEYED_RUN_BUDGET. The key goes in the X-Api-Key
header, never the address, so no log line, error message or exception can
print it.

TROUBLE. Every answer's X-RateLimit-Remaining is read, and the client stops
before it reaches RESERVE. A 429, a 5xx, a timeout or a dropped connection is a
stop (Stopped): the reader records an ok run with the reason in its note and
tries again on its next run. A key the gateway refuses (403 API_KEY_INVALID or
API_KEY_MISSING) is KeyRefused: a broken install, which the reader turns into a
failed run. Any other 4xx is raised as is: an address or a parameter of ours is
wrong. A defect in a reader crashes.
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request

KEY_ENV = "DATA_GOV_API_KEY"
DEMO_KEY = "DEMO_KEY"
# Requests one run may make. DEMO_KEY's day is 50 per IP across every
# api.data.gov service, and two readers share it: six each, twice a day, is 24.
DEMO_RUN_BUDGET = 6
# A keyed run: far below the key's 1,000 an hour, so one runaway run can't
# spend the hour the other readers need.
KEYED_RUN_BUDGET = 200
# Stop while this many requests are still left in the gateway's own window.
RESERVE = 2
TIMEOUT_S = 45
UA = "PERMTracker/1.0 (+https://permtracker.app; support@permtracker.app)"
TRANSIENT = (429, 500, 502, 503, 504)


class Stopped(RuntimeError):
    """The run stops here and tries again next time: the budget is spent, the
    gateway's window is nearly spent, or the host refused or failed."""


class KeyRefused(RuntimeError):
    """The gateway refused the key: the install is wrong, not the source."""


def _urlopen(url: str, headers: dict[str, str]) -> tuple[int, dict[str, str], bytes]:
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=TIMEOUT_S) as r:
        return r.status, {k.lower(): v for k, v in r.headers.items()}, r.read()


class Client:
    """One run's requests to api.data.gov.

    `opener(url, headers) -> (status, lowercased headers, body)` is the
    transport, so a test can stand in for the network. It may raise
    urllib.error.HTTPError, as urllib does.
    """

    def __init__(self, *, key: str | None = None, budget: int | None = None, opener=_urlopen, log=print):
        env_key = (key if key is not None else os.environ.get(KEY_ENV, "")).strip()
        self.demo = not env_key or env_key == DEMO_KEY
        self._key = env_key or DEMO_KEY
        self.budget = budget if budget is not None else (DEMO_RUN_BUDGET if self.demo else KEYED_RUN_BUDGET)
        self.used = 0
        self.remaining: int | None = None
        self._opener = opener
        self._log = log
        if self.demo:
            log(f"::warning::{KEY_ENV} is not set; running on DEMO_KEY with {self.budget} requests this run")

    @property
    def key_note(self) -> str:
        return "on DEMO_KEY" if self.demo else "on the site's key"

    def get_json(self, url: str, params: dict | None = None) -> dict:
        if self.used >= self.budget:
            raise Stopped(f"this run's {self.budget} requests are spent")
        if self.remaining is not None and self.remaining <= RESERVE:
            raise Stopped(f"the gateway's window is nearly spent ({self.remaining} left)")
        full = url + ("?" + urllib.parse.urlencode(params, safe="[]+:,") if params else "")
        headers = {"X-Api-Key": self._key, "User-Agent": UA, "Accept": "application/json"}
        self.used += 1
        try:
            status, hdrs, body = self._opener(full, headers)
        except urllib.error.HTTPError as e:
            self._read_remaining({k.lower(): v for k, v in (e.headers or {}).items()})
            if e.code in TRANSIENT:
                raise Stopped(f"{urllib.parse.urlsplit(url).netloc} answered HTTP {e.code}") from None
            if e.code == 403 and _key_refused(e):
                raise KeyRefused(f"api.data.gov refused the key ({KEY_ENV})") from None
            raise
        except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as e:
            raise Stopped(f"{urllib.parse.urlsplit(url).netloc} unreachable ({type(e).__name__})") from None
        self._read_remaining(hdrs)
        if status != 200:
            raise Stopped(f"{urllib.parse.urlsplit(url).netloc} answered HTTP {status}")
        try:
            return json.loads(body)
        except ValueError:
            raise Stopped(f"{urllib.parse.urlsplit(url).netloc} answered something that isn't JSON") from None

    def _read_remaining(self, hdrs: dict[str, str]) -> None:
        v = hdrs.get("x-ratelimit-remaining")
        if v is not None and str(v).strip().lstrip("-").isdigit():
            self.remaining = int(v)


def _key_refused(e: urllib.error.HTTPError) -> bool:
    try:
        body = e.read().decode("utf-8", "replace")
    except Exception:  # noqa: BLE001 - an unreadable body isn't a key verdict
        return False
    return "API_KEY_INVALID" in body or "API_KEY_MISSING" in body or "API_KEY_DISABLED" in body
