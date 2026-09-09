#!/usr/bin/env python3
"""A weekly post for X and LinkedIn, composed from the record. SCAFFOLD.

    python3 scripts/social_post.py                 # print the draft, post nothing
    python3 scripts/social_post.py --post          # post, when the keys are set

WHAT IT SAYS. Only figures DOL and State publish, each with its date: the
filing month DOL's analysts are working and the average days to a decision,
from the processing-times snapshot; and the newest visa bulletin's EB-2 and
EB-3 cutoffs for India and China, with the count of categories that moved
against the month before. No estimate, no adjective, one link per post.

WHAT IS NOT BUILT. Posting needs Adam's API credentials, which do not exist
yet: X's v2 API with an OAuth 1.0a user context (X_API_KEY, X_API_SECRET,
X_ACCESS_TOKEN, X_ACCESS_SECRET) and LinkedIn's posts API with a member
token (LINKEDIN_ACCESS_TOKEN, LINKEDIN_AUTHOR_URN). Without them `--post`
prints the draft and exits 0, and the dispatch-only workflow does the same.
The signing code is tested against RFC 5849's own worked example (section
3.4.1.1); the HTTP calls have never been made from here and are the first
thing to verify when keys arrive. Nothing runs on a schedule until then.
"""
from __future__ import annotations

import argparse
import base64
import datetime as dt
import hashlib
import hmac
import json
import os
import sys
import time
import urllib.parse
import urllib.request
import uuid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
SITE = "https://permtracker.app"
X_LIMIT = 280


def month_name(ym: str) -> str:
    """'2025-11' -> 'November 2025'."""
    y, m = ym.split("-")
    return f"{MONTHS[int(m) - 1]} {y}"


def long_date(iso: str) -> str:
    d = dt.date.fromisoformat(iso)
    return f"{MONTHS[d.month - 1]} {d.day}, {d.year}"


def cutoff_words(v: str | None) -> str:
    """State's cell as words: 'C' is current, 'U' unavailable, else the date it printed."""
    if not v:
        return "not published"
    if v == "C":
        return "current"
    if v == "U":
        return "unavailable"
    try:
        d = dt.datetime.strptime(v, "%d%b%y").date()
        return f"{MONTHS[d.month - 1][:3]} {d.day}, {d.year}"
    except ValueError:
        return v


def moved_count(current: dict, previous: dict | None) -> int | None:
    """How many category/country cells changed between two bulletins' final-action charts."""
    if not previous:
        return None
    n = 0
    for cat, countries in current.items():
        for country, v in countries.items():
            if (previous.get(cat) or {}).get(country) != v:
                n += 1
    return n


def compose(snapshot: dict, bulletin: dict, previous_bulletin: dict | None) -> dict[str, str]:
    """The two posts. `snapshot` is the processing_times JSON; `bulletin` and
    `previous_bulletin` are {"month": "YYYY-MM", "final_action": {...}}."""
    analyst = next((q for q in snapshot.get("permQueues", []) if q.get("queue", "").lower() == "analyst review"), None)
    days = next((d for d in snapshot.get("permAverageDays", []) if d.get("determination", "").lower() == "analyst review"), None)
    as_of = snapshot.get("permAsOf")
    fa = bulletin["final_action"]
    lines = []
    if analyst and analyst.get("priorityDate"):
        lines.append(f"PERM queue: DOL is working {month_name(analyst['priorityDate'])} filings" + (f", averaging {days['calendarDays']} days to a decision" if days and days.get("calendarDays") else "") + (f" (DOL, {long_date(as_of)})." if as_of else "."))
    eb2i = cutoff_words((fa.get("EB2") or {}).get("india"))
    eb3i = cutoff_words((fa.get("EB3") or {}).get("india"))
    eb2c = cutoff_words((fa.get("EB2") or {}).get("china"))
    moved = moved_count(fa, previous_bulletin["final_action"] if previous_bulletin else None)
    bl = f"{month_name(bulletin['month'])} visa bulletin, final action: EB-2 India {eb2i}, EB-3 India {eb3i}, EB-2 China {eb2c}."
    if moved is not None:
        bl += f" {moved} cutoffs moved from the month before."
    lines.append(bl)
    x = " ".join(lines) + f" {SITE}/perm-queue"
    if len(x) > X_LIMIT:
        # Drop the China clause first, then the moved count; never the dates.
        x = x.replace(f", EB-2 China {eb2c}", "")
        if len(x) > X_LIMIT and moved is not None:
            x = x.replace(f" {moved} cutoffs moved from the month before.", "")
    linkedin = "\n\n".join(lines) + f"\n\nThe queue by month: {SITE}/perm-queue\nThe bulletin, month by month: {SITE}/visa-bulletin"
    return {"x": x, "linkedin": linkedin}


# ---------------------------------------------------------------- X (OAuth 1.0a)

def _pct(s: str) -> str:
    return urllib.parse.quote(s, safe="-._~")


def _pairs(params) -> list[tuple[str, str]]:
    return list(params.items()) if isinstance(params, dict) else list(params)


def signature_base_string(method: str, url: str, params) -> str:
    """RFC 5849 section 3.4.1: method, base URI and the normalised parameters,
    each percent-encoded, joined by "&". Parameters sort by encoded name then
    encoded value, which is what puts a repeated name in the right order."""
    encoded = sorted((_pct(k), _pct(v)) for k, v in _pairs(params))
    param_string = "&".join(f"{k}={v}" for k, v in encoded)
    return f"{method.upper()}&{_pct(url)}&{_pct(param_string)}"


def oauth1_signature(method: str, url: str, params, consumer_secret: str, token_secret: str) -> str:
    """HMAC-SHA1 over the base string, keyed on the two secrets (RFC 5849 section 3.4.2)."""
    key = f"{_pct(consumer_secret)}&{_pct(token_secret)}"
    digest = hmac.new(key.encode(), signature_base_string(method, url, params).encode(), hashlib.sha1).digest()
    return base64.b64encode(digest).decode()


def oauth1_header(method: str, url: str, body_params: dict[str, str], creds: dict[str, str], nonce: str | None = None, timestamp: str | None = None) -> str:
    oauth = {
        "oauth_consumer_key": creds["key"],
        "oauth_nonce": nonce or uuid.uuid4().hex,
        "oauth_signature_method": "HMAC-SHA1",
        "oauth_timestamp": timestamp or str(int(time.time())),
        "oauth_token": creds["token"],
        "oauth_version": "1.0",
    }
    sig = oauth1_signature(method, url, [*body_params.items(), *oauth.items()], creds["secret"], creds["token_secret"])
    oauth["oauth_signature"] = sig
    return "OAuth " + ", ".join(f'{_pct(k)}="{_pct(v)}"' for k, v in sorted(oauth.items()))


X_TWEETS_URL = "https://api.twitter.com/2/tweets"
LINKEDIN_POSTS_URL = "https://api.linkedin.com/rest/posts"


def post_to_x(text: str, creds: dict[str, str], url: str = X_TWEETS_URL) -> dict:
    """POST /2/tweets with a JSON body; only the oauth_* params sign a JSON request.

    `url` is a parameter so test_social_post.py can point the real request at
    a local server and read back exactly what X would receive: the header, the
    body and the content type. The signing was proved against RFC 5849's
    worked example; this is what proves the request that carries it.
    """
    req = urllib.request.Request(url, data=json.dumps({"text": text}).encode(), method="POST")
    req.add_header("Authorization", oauth1_header("POST", url, {}, creds))
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


# ---------------------------------------------------------------- LinkedIn

def post_to_linkedin(text: str, token: str, author_urn: str, url: str = LINKEDIN_POSTS_URL) -> dict:
    body = {"author": author_urn, "commentary": text, "visibility": "PUBLIC", "distribution": {"feedDistribution": "MAIN_FEED", "targetEntities": [], "thirdPartyDistributionChannels": []}, "lifecycleState": "PUBLISHED"}
    req = urllib.request.Request(url, data=json.dumps(body).encode(), method="POST")
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", "application/json")
    req.add_header("X-Restli-Protocol-Version", "2.0.0")
    req.add_header("LinkedIn-Version", "202601")
    with urllib.request.urlopen(req, timeout=30) as r:
        return {"status": r.status, "id": r.headers.get("x-restli-id")}


# ---------------------------------------------------------------- record

def load_record() -> tuple[dict, dict, dict | None]:
    from lib_turso import Turso  # noqa: E402

    db = Turso()
    cells = lambda r: [None if c["type"] == "null" else c["value"] for c in r]  # noqa: E731
    snap = db.execute("SELECT json FROM processing_times ORDER BY perm_as_of DESC LIMIT 1")
    snapshot = json.loads(cells(snap["response"]["result"]["rows"][0])[0])
    bl = db.execute("SELECT bulletin_month, final_action FROM visa_bulletins ORDER BY bulletin_month DESC LIMIT 2")
    rows = [cells(r) for r in bl["response"]["result"]["rows"]]
    bulletin = {"month": rows[0][0], "final_action": json.loads(rows[0][1])}
    previous = {"month": rows[1][0], "final_action": json.loads(rows[1][1])} if len(rows) > 1 else None
    return snapshot, bulletin, previous


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--post", action="store_true", help="post when credentials are set; otherwise print")
    a = ap.parse_args()
    snapshot, bulletin, previous = load_record()
    posts = compose(snapshot, bulletin, previous)
    print(f"--- X ({len(posts['x'])} chars) ---\n{posts['x']}\n\n--- LinkedIn ---\n{posts['linkedin']}\n")
    if not a.post:
        return 0
    x_creds = {k: os.environ.get(e, "") for k, e in [("key", "X_API_KEY"), ("secret", "X_API_SECRET"), ("token", "X_ACCESS_TOKEN"), ("token_secret", "X_ACCESS_SECRET")]}
    li_token, li_urn = os.environ.get("LINKEDIN_ACCESS_TOKEN", ""), os.environ.get("LINKEDIN_AUTHOR_URN", "")
    if all(x_creds.values()):
        print("X:", post_to_x(posts["x"], x_creds))
    else:
        print("X: no credentials set; not posted (scaffold).")
    if li_token and li_urn:
        print("LinkedIn:", post_to_linkedin(posts["linkedin"], li_token, li_urn))
    else:
        print("LinkedIn: no credentials set; not posted (scaffold).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
