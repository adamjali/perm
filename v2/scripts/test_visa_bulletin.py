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

    # --- the SIX-column layout, which is why position cannot be trusted ---
    # Bulletins before ~April 2023 carry an extra EL SALVADOR / GUATEMALA /
    # HONDURAS column on the EMPLOYMENT chart, between CHINA and INDIA. A
    # parser keyed on position reads El Salvador's cell as India's: for this
    # very bulletin that would have published EB3 India as "Current" when it
    # was actually backlogged to 2012.
    six = (HERE / "__fixtures__" / "visa-bulletin-2023-02-sixcol.html").read_text()
    check("the six-column month is read", vb.month_from_page(six) == "2023-02",
          str(vb.month_from_page(six)))
    old = vb.parse_bulletin(six)
    check("the six-column layout parses at all", bool(old))
    if old:
        fa6 = old["finalAction"]
        check("six-column: all six categories",
              sorted(fa6) == ["EB1", "EB2", "EB3", "EB4", "EB5", "EW3"], str(sorted(fa6)))
        # The whole point: India from India's column, not El Salvador's.
        check("six-column: EB3 India is 15JUN12, not El Salvador's C",
              fa6["EB3"]["india"] == "15JUN12", fa6["EB3"]["india"])
        check("six-column: EB2 India is 08OCT11",
              fa6["EB2"]["india"] == "08OCT11", fa6["EB2"]["india"])
        check("six-column: the extra column is not stored",
              set(fa6["EB3"]) == {"worldwide", "china", "india", "mexico", "philippines"},
              str(sorted(fa6["EB3"])))

    # --- a MISSING country is still a hard failure ------------------------
    # Resolving by name means a reordered column is read correctly rather
    # than refused, which is strictly better. What must still fail loudly is
    # a country we need not being there at all - that is a family-sponsored
    # chart, or a layout change we have not seen.
    # Two refusal MECHANISMS, and the test must accept both or it reports a
    # working guard as broken. Removing INDIA also removes the token that
    # SELECTS the employment chart, so the chart is never picked and
    # parse_bulletin returns None - a refusal that arrives earlier than the
    # ValueError, not a weaker one.
    gone = six.replace("INDIA", "ELBONIA")
    try:
        got = vb.parse_bulletin(gone)
        check("a missing country column is rejected", got is None,
              "parsed a chart with no India column")
    except ValueError as exc:
        check("a missing country column is rejected", True, str(exc)[:60])
    except Exception as exc:  # noqa: BLE001
        check("a missing country column is rejected", False, type(exc).__name__)

    # And the ValueError path specifically: a chart that IS selected (INDIA
    # present in the header) but is missing another required country.
    lost_mexico = six.replace("MEXICO", "ELBONIA")
    try:
        vb.parse_bulletin(lost_mexico)
        check("a chart missing MEXICO raises", False, "parsed anyway")
    except ValueError as exc:
        check("a chart missing MEXICO raises", "MEXICO" in str(exc).upper(), str(exc)[:60])
    except Exception as exc:  # noqa: BLE001
        check("a chart missing MEXICO raises", False, type(exc).__name__)

    # --- a family-sponsored chart still yields nothing ---------------------
    page_family = page.replace("INDIA", "EL SALVADOR")
    check("a family-sponsored chart yields nothing",
          vb.parse_bulletin(page_family) is None)
    refuses("refuses a family-sponsored chart", page_family, "2026-07",
            "no employment-based charts")

    print(f"\n  {len(failures)} failure(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
