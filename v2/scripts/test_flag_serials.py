"""Pins lib_flag_serials: the wrap, the padding, and the day-code arithmetic
that both probers rest on. Stdlib only; run directly."""
from __future__ import annotations

import datetime
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib_flag_serials import (  # noqa: E402
    SERIAL_MOD, case_number, code_of, code_to_date, day_code, day_codes_between,
    decode_filing_date, fmt_serial, newer, prefix_of, recent_day_codes,
    serial_add, serial_gap, serial_of, serial_span,
)

FAILURES: list[str] = []


def check(name: str, got, want) -> None:
    if got == want:
        print(f"  ok   {name}")
    else:
        FAILURES.append(name)
        print(f"  FAIL {name}\n         got  {got!r}\n         want {want!r}")


def main() -> int:
    # Padding: the bug the old prober had.
    check("fmt_serial pads to six digits", fmt_serial(70550), "070550")
    check("fmt_serial keeps six-digit values", fmt_serial(200246), "200246")
    check("fmt_serial wraps the modulus to 000000", fmt_serial(SERIAL_MOD), "000000")
    check("case_number assembles padded", case_number("G-100-", "26240", 70550), "G-100-26240-070550")

    # The wrap (measured 2026-06-10: 999,997 then 000001).
    check("serial_add wraps", serial_add(999_990, 15), 5)
    check("serial_span crosses the wrap", serial_span(999_998, 4), [999_998, 999_999, 0, 1])
    check("serial_gap forward across the wrap", serial_gap(999_998, 2), 4)
    check("serial_gap same serial is zero", serial_gap(5, 5), 0)

    # Parsing tolerates unpadded stored rows; formatting never emits them.
    check("serial_of parses padded", serial_of("P-100-26240-000012"), 12)
    check("serial_of parses unpadded legacy", serial_of("G-100-24229-273803"), 273803)
    check("serial_of rejects off-shape", serial_of("nonsense"), None)
    check("prefix_of", prefix_of("I-203-26239-199948"), "I-203-")
    check("code_of", code_of("G-200-26246-215323"), "26246")

    # Day codes.
    check("day_code Aug 28 2026", day_code(datetime.date(2026, 8, 28)), "26240")
    check("day_code Jan 1", day_code(datetime.date(2027, 1, 1)), "27001")
    check("recent_day_codes crosses the year", recent_day_codes(datetime.date(2027, 1, 2), 3),
          ["27002", "27001", "26365"])
    check("code_to_date round trip", code_to_date("26240"), datetime.date(2026, 8, 28))
    check("code_to_date rejects doy 000", code_to_date("26000"), None)
    check("code_to_date rejects doy 366 in a non-leap year", code_to_date("26366"), None)
    check("code_to_date accepts doy 366 in a leap year", code_to_date("28366"), datetime.date(2028, 12, 31))
    check("day_codes_between inclusive and ordered", day_codes_between("26364", "27002"),
          ["26364", "26365", "27001", "27002"])
    check("day_codes_between reversed is empty", day_codes_between("27002", "26364"), [])
    check("decode_filing_date", decode_filing_date("G-100-26240-200246"), "2026-08-28")
    check("decode_filing_date bad doy stays None", decode_filing_date("G-100-26400-000001"), None)

    # Frontier ordering: the day decides, then the ring.
    check("newer by day", newer(("26240", 999_999), ("26241", 3)), ("26241", 3))
    check("newer within a day", newer(("26240", 200_246), ("26240", 200_300)), ("26240", 200_300))
    check("newer within a day across the wrap", newer(("26161", 999_990), ("26161", 12)), ("26161", 12))

    if FAILURES:
        print(f"\n{len(FAILURES)} failure(s): {', '.join(FAILURES)}")
        return 1
    print("\nall checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
