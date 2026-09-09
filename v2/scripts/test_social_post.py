#!/usr/bin/env python3
"""The social-post composer and the OAuth 1.0a base string.

    python3 scripts/test_social_post.py

The composer is checked for what it must never do (exceed X's limit, print a
cutoff letter as a date, invent a moved count without a prior month). The
signing is checked against RFC 5849 section 3.4.1.1, the standard's own
worked example, character for character: duplicate parameter names, an
already-encoded query value, an empty value, a space, and an "@" in a key are
all in it, which is the whole difficulty of the base string.
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from social_post import X_LIMIT, compose, post_to_linkedin, post_to_x, cutoff_words, moved_count, oauth1_signature, signature_base_string  # noqa: E402

SNAPSHOT = {
    "permAsOf": "2026-08-31",
    "permQueues": [{"queue": "Analyst Review", "priorityDate": "2025-11", "raw": "November 2025"}],
    "permAverageDays": [{"determination": "Analyst Review", "month": "2026-08", "calendarDays": 336, "raw": "336"}],
}
BULLETIN = {"month": "2026-09", "final_action": {"EB2": {"india": "U", "china": "01SEP21"}, "EB3": {"india": "01JAN14", "china": "01JAN22"}}}
PREVIOUS = {"month": "2026-08", "final_action": {"EB2": {"india": "U", "china": "01AUG21"}, "EB3": {"india": "01JAN14", "china": "01JAN22"}}}

# RFC 5849, 3.4.1.1: the request and the base string it documents.
RFC_PAIRS = [
    ("b5", "=%3D"), ("a3", "a"), ("c@", ""), ("a2", "r b"),  # the query, decoded
    ("c2", ""), ("a3", "2 q"),  # the body, decoded
    ("oauth_consumer_key", "9djdj82h48djs9d2"), ("oauth_token", "kkk9d7dh3k39sjv7"),
    ("oauth_signature_method", "HMAC-SHA1"), ("oauth_timestamp", "137131201"), ("oauth_nonce", "7d8f3e4a"),
]
RFC_BASE = (
    "POST&http%3A%2F%2Fexample.com%2Frequest&a2%3Dr%2520b%26a3%3D2%2520q"
    "%26a3%3Da%26b5%3D%253D%25253D%26c%2540%3D%26c2%3D%26oauth_consumer_"
    "key%3D9djdj82h48djs9d2%26oauth_nonce%3D7d8f3e4a%26oauth_signature_m"
    "ethod%3DHMAC-SHA1%26oauth_timestamp%3D137131201%26oauth_token%3Dkkk"
    "9d7dh3k39sjv7"
)


def check(cond: bool, msg: str, failures: list[str]) -> None:
    print(("  ok   " if cond else "  FAIL ") + msg)
    if not cond:
        failures.append(msg)


def main() -> int:
    f: list[str] = []
    posts = compose(SNAPSHOT, BULLETIN, PREVIOUS)
    x, li = posts["x"], posts["linkedin"]
    check(len(x) <= X_LIMIT, f"X post fits {X_LIMIT} chars ({len(x)})", f)
    check("November 2025" in x and "336 days" in x and "August 31, 2026" in x, "queue month, days and DOL's date are in the post", f)
    check("EB-2 India unavailable" in x, "U prints as 'unavailable', never as a date", f)
    check("EB-3 India Jan 1, 2014" in x, "a cutoff prints as its date", f)
    check("1 cutoffs moved" in x, "the moved count is against the month before (China moved, 1)", f)
    check(x.endswith("https://permtracker.app/perm-queue"), "one link, last", f)
    check("EB-2 China Sep 1, 2021" in li and "visa-bulletin" in li, "LinkedIn keeps the China clause and both links", f)
    check(cutoff_words("C") == "current" and cutoff_words(None) == "not published", "C and a missing cell have words", f)
    check(moved_count(BULLETIN["final_action"], None) is None, "no prior month, no moved count", f)
    no_prior = compose(SNAPSHOT, BULLETIN, None)["x"]
    check("moved" not in no_prior, "the post never invents a moved count", f)
    long_snap = dict(SNAPSHOT)
    long_snap["permQueues"] = [{"queue": "Analyst Review", "priorityDate": "2025-11", "raw": "x"}]
    wide = compose(long_snap, {"month": "2026-09", "final_action": {"EB2": {"india": "01JAN2013", "china": "01SEP21"}, "EB3": {"india": "01JAN14"}}}, PREVIOUS)["x"]
    check(len(wide) <= X_LIMIT, "an odd cutoff string still fits", f)

    base = signature_base_string("POST", "http://example.com/request", RFC_PAIRS)
    check(base == RFC_BASE, "signature base string matches RFC 5849 section 3.4.1.1 exactly", f)
    if base != RFC_BASE:
        print("     got:", base)
    sig = oauth1_signature("POST", "http://example.com/request", RFC_PAIRS, "j49sk3j29djd", "dh893hdasih9")
    check(len(sig) == 28 and sig.endswith("="), "HMAC-SHA1 signature is 20 bytes, base64", f)

    print("\nALL PASS" if not f else f"\n{len(f)} FAILURE(S)")
    return 1 if f else 0


if __name__ == "__main__":
    sys.exit(main())


# ---------------------------------------------------------------- the HTTP request itself

def _serve_once():
    """A local HTTP server that records one request and answers like the API."""
    import http.server
    import json as _json
    import threading

    seen: dict = {}

    class H(http.server.BaseHTTPRequestHandler):
        def do_POST(self):
            n = int(self.headers.get("Content-Length", "0"))
            seen["path"] = self.path
            seen["headers"] = {k.lower(): v for k, v in self.headers.items()}
            seen["body"] = self.rfile.read(n).decode()
            self.send_response(201)
            self.send_header("Content-Type", "application/json")
            self.send_header("x-restli-id", "urn:li:share:1")
            self.end_headers()
            self.wfile.write(_json.dumps({"data": {"id": "1", "text": "ok"}}).encode())

        def log_message(self, *a):
            pass

    srv = http.server.HTTPServer(("127.0.0.1", 0), H)
    threading.Thread(target=srv.handle_request, daemon=True).start()
    return srv, seen


def test_post_to_x_sends_a_signed_json_request():
    """The request X receives: OAuth 1.0a header, JSON body, nothing else."""
    import json as _json
    import urllib.parse

    srv, seen = _serve_once()
    url = f"http://127.0.0.1:{srv.server_port}/2/tweets"
    creds = {"key": "ck", "secret": "cs", "token": "tk", "token_secret": "ts"}
    out = post_to_x("DOL is working November 2025.", creds, url=url)
    srv.server_close()
    assert out == {"data": {"id": "1", "text": "ok"}}
    assert seen["path"] == "/2/tweets"
    assert seen["headers"]["content-type"] == "application/json"
    assert _json.loads(seen["body"]) == {"text": "DOL is working November 2025."}
    auth = seen["headers"]["authorization"]
    assert auth.startswith("OAuth ")
    parts = dict(kv.split("=", 1) for kv in auth[6:].split(", "))
    for k in ("oauth_consumer_key", "oauth_nonce", "oauth_signature", "oauth_signature_method", "oauth_timestamp", "oauth_token", "oauth_version"):
        assert k in parts, k
    assert parts["oauth_consumer_key"] == '"ck"' and parts["oauth_token"] == '"tk"'
    assert parts["oauth_signature_method"] == '"HMAC-SHA1"' and parts["oauth_version"] == '"1.0"'
    # The signature is recomputable from the header's own nonce and timestamp,
    # over the URL the request actually went to, so a header that names one
    # URL and signs another cannot pass.
    sig_params = {k: urllib.parse.unquote(v.strip('"')) for k, v in parts.items() if k != "oauth_signature"}
    expected = oauth1_signature("POST", url, sig_params, "cs", "ts")
    assert urllib.parse.unquote(parts["oauth_signature"].strip('"')) == expected


def test_post_to_linkedin_sends_the_versioned_bearer_request():
    import json as _json

    srv, seen = _serve_once()
    url = f"http://127.0.0.1:{srv.server_port}/rest/posts"
    out = post_to_linkedin("A post.", "tok", "urn:li:person:abc", url=url)
    srv.server_close()
    assert out == {"status": 201, "id": "urn:li:share:1"}
    assert seen["headers"]["authorization"] == "Bearer tok"
    assert seen["headers"]["linkedin-version"] == "202601"
    assert seen["headers"]["x-restli-protocol-version"] == "2.0.0"
    body = _json.loads(seen["body"])
    assert body["author"] == "urn:li:person:abc" and body["commentary"] == "A post." and body["visibility"] == "PUBLIC"
