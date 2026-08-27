#!/usr/bin/env python3
"""Contract tests for the visa-bulletin parser and its primary-source route.

    python3 scripts/test_visa_bulletin.py

Why this exists as a test rather than a one-off check: the parser is the ONLY
thing standing between a saved government page and a cutoff date published on
the site, and every one of its guards protects against a failure that produces
a plausible wrong answer rather than an error.

The fixture is a trimmed real capture of the July 2026 bulletin (the last one
the Internet Archive obtained before travel.state.gov began refusing its
crawler). Trimmed deliberately: it keeps the title phrase and the two
employment-based tables and nothing else, which also proves the parser does
not depend on page chrome.
"""
from __future__ import annotations

import importlib.util
import pathlib
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
FIXTURE = HERE / "__fixtures__" / "visa-bulletin-2026-07.html"

spec = importlib.util.spec_from_file_location("vb", HERE / "ingest_visa_bulletin.py")
vb = importlib.util.module_from_spec(spec)
assert spec.loader
spec.loader.exec_module(vb)

failures: list[str] = []


def check(label: str, cond: bool, detail: str = "") -> None:
    print(f"  {'PASS' if cond else 'FAIL'}  {label}{'' if cond else f': {detail}'}")
    if not cond:
        failures.append(label)


def refuses(label: str, page: str, month: str | None, expect: str) -> None:
    """Every guard must raise SystemExit BEFORE any database connection."""
    with tempfile.TemporaryDirectory() as d:
        p = pathlib.Path(d) / "page.html"
        p.write_text(page)
        try:
            vb.ingest_saved_page(str(p), month)
        except SystemExit as exc:
            check(label, expect.lower() in str(exc).lower(), f"said {exc!s:.70}")
        except Exception as exc:  # noqa: BLE001
            check(label, False, f"{type(exc).__name__}: {exc}")
        else:
            check(label, False, "did not refuse")


def main() -> int:
    page = FIXTURE.read_text()

    # --- the happy path, which is also the control -----------------------
    # Five refusals below prove nothing on their own: a parser that refused
    # everything would pass all of them.
    check("month read off the page", vb.month_from_page(page) == "2026-07",
          f"got {vb.month_from_page(page)}")

    parsed = vb.parse_bulletin(page)
    check("both charts parsed", bool(parsed))
    if parsed:
        fa = parsed["finalAction"]
        check("all six categories", sorted(fa) == ["EB1", "EB2", "EB3", "EB4", "EB5", "EW3"],
              f"got {sorted(fa)}")
        check("every country column present",
              all(set(r) == {"worldwide", "china", "india", "mexico", "philippines"}
                  for r in fa.values()))
        # A cutoff cell is a DATE, or C, or U, and C and U are opposites. If a
        # future change ever coerced U into a date, EB2 India would read as
        # "nearly there" in the month the category shut.
        check("EB2 India is U, not a date", fa["EB2"]["india"] == "U", fa["EB2"]["india"])
        check("EB2 worldwide is C", fa["EB2"]["worldwide"] == "C", fa["EB2"]["worldwide"])
        check("EB3 India is a real cutoff", fa["EB3"]["india"] == "01JAN14", fa["EB3"]["india"])
        # Final action first, dates for filing second. Swapping them would
        # publish the wrong chart under the right heading.
        check("the two charts differ",
              parsed["finalAction"] != parsed["datesForFiling"])

    # --- the guards ------------------------------------------------------
    refuses("refuses a Cloudflare challenge page",
            "<html><title>Attention Required! | Cloudflare</title></html>", None,
            "challenge page")
    refuses("refuses a month that contradicts the page", page, "2026-08", "page says")
    refuses("refuses a page with no month", "<html><table></table></html>", None,
            "exactly one bulletin month")
    refuses("refuses a month with no charts",
            "<html>Visa Bulletin For March 2026</html>", None,
            "no employment-based charts")
    refuses("refuses two different months on one page",
            "Visa Bulletin For March 2026 ... Visa Bulletin For April 2026", None,
            "exactly one bulletin month")

    # --- the column-order assertion, which is the subtlest one -----------
    # Two distinct failures, and they are rejected by two different
    # mechanisms. Both must hold.
    #
    # 1. A column REORDERED but still present. The chart still looks like an
    #    employment chart, so it is selected, and only the header assertion
    #    stands between it and India's cutoff being published as China's.
    swapped = (page.replace("CHINA", "\x00", 1)
                   .replace("INDIA", "CHINA", 1)
                   .replace("\x00", "INDIA", 1))
    check("the swap fixture actually changed the page", swapped != page)
    try:
        vb.parse_bulletin(swapped)
        check("a reordered column is rejected", False, "parsed a mislabelled chart")
    except ValueError as exc:
        check("a reordered column is rejected", "column" in str(exc), str(exc)[:60])
    except Exception as exc:  # noqa: BLE001
        check("a reordered column is rejected", False, f"{type(exc).__name__}")

    # 2. A column MISSING - which is what a family-sponsored chart looks like,
    #    since it carries El Salvador where this one carries India. That chart
    #    fails the selector rather than the header assertion, so it yields no
    #    charts at all, and the caller turns that into a refusal.
    family = page.replace("INDIA", "EL SALVADOR")
    check("a family-sponsored chart yields nothing",
          vb.parse_bulletin(family) is None)
    refuses("refuses a family-sponsored chart", family, "2026-07",
            "no employment-based charts")

    print(f"\n  {len(failures)} failure(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
