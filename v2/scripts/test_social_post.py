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
from social_post import X_LIMIT, compose, cutoff_words, moved_count, oauth1_signature, signature_base_string  # noqa: E402

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
