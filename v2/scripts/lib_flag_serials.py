"""Serial arithmetic shared by every FLAG prober.

DOL issues ONE sequential serial per filing across every program (PERM, PWD
and LCA draw from the same counter), stamps it with the filing day's YYDDD
code and pads it to six digits. Three measured facts every prober rests on:

- The counter WRAPS at 1,000,000. Serials ran 998,922 to 999,997 on
  2026-06-10 and restarted at 000001 (also seen 2024-05-15). A walk that
  compares serials numerically across the wrap, or stops at 999,999,
  deadlocks - which is exactly how the PWD backfill stuck on day 26161.
- Serials are zero-padded: 70,550 is "070550" in the case number. Asking
  DOL for "-70550" asks for a number it has never issued.
- The counter advances ~2,150 serials a day on average (~260 an hour in
  business hours). An overnight lull is a few hundred consecutive serials
  that are all PWD/LCA and no PERM; a prober that gives up after two empty
  PERM batches stops there and, because its frontier only moves on a hit,
  never starts again. Existence has to be tested per prefix: DOL returns
  nothing for a G-100 number whose serial belongs to an I-200 (measured
  2026-09-06 on serials 200,300-200,304 of day 26240).
"""
from __future__ import annotations

import datetime
import re

SERIAL_MOD = 1_000_000
SERIAL_WIDTH = 6

# Serial is \d+ rather than \d{6} on purpose: parsing must accept whatever a
# row already holds; FORMATTING is what must pad.
CASE_RE = re.compile(r"^([A-Za-z]-\d{3})-(\d{2})(\d{3})-(\d+)$")


def day_code(d: datetime.date) -> str:
    """YYDDD for a date, e.g. 2026-08-28 -> '26240'."""
    return f"{d.year % 100:02d}{d.timetuple().tm_yday:03d}"


def recent_day_codes(today: datetime.date, window: int) -> list[str]:
    """Codes for `today` back through `window` days, newest first. Built
    from real dates so Jan 1 looks back into the previous year's codes."""
    return [day_code(today - datetime.timedelta(days=i)) for i in range(window)]


def day_codes_between(start: str, end: str) -> list[str]:
    """Every day code from `start` through `end` inclusive, oldest first,
    walking real dates so a year boundary is crossed correctly."""
    a, b = code_to_date(start), code_to_date(end)
    if a is None or b is None or a > b:
        return []
    return [day_code(a + datetime.timedelta(days=i)) for i in range((b - a).days + 1)]


def code_to_date(code: str) -> datetime.date | None:
    """'26240' -> 2026-08-28, or None for an impossible day-of-year."""
    if len(code) != 5 or not code.isdigit():
        return None
    year, doy = 2000 + int(code[:2]), int(code[2:])
    if not 1 <= doy <= 366:
        return None
    d = datetime.date(year, 1, 1) + datetime.timedelta(days=doy - 1)
    return d if d.year == year else None


def decode_filing_date(case_number: str) -> str | None:
    """ISO date from the number's own YYDDD segment, or None off-shape.

    Exact for 94.6% of the corpus and equal to DOL's submittedDate for
    409,127 of 414,050 rows; a None (bad day-of-year) must stay None - a
    plausible wrong date is invisible downstream in a way a null is not.
    """
    m = CASE_RE.match(case_number)
    if not m:
        return None
    d = code_to_date(m.group(2) + m.group(3))
    return d.isoformat() if d else None


def prefix_of(case_number: str) -> str | None:
    """'G-100-26240-200246' -> 'G-100-'."""
    m = CASE_RE.match(case_number)
    return f"{m.group(1)}-" if m else None


def code_of(case_number: str) -> str | None:
    m = CASE_RE.match(case_number)
    return m.group(2) + m.group(3) if m else None


def serial_of(case_number: str) -> int | None:
    m = CASE_RE.match(case_number)
    return int(m.group(4)) if m else None


def fmt_serial(n: int) -> str:
    """Six digits, wrapped: 70550 -> '070550', 1_000_000 -> '000000'."""
    return f"{n % SERIAL_MOD:0{SERIAL_WIDTH}d}"


def serial_add(n: int, k: int) -> int:
    return (n + k) % SERIAL_MOD


def serial_span(start: int, count: int) -> list[int]:
    """`count` consecutive serials from `start`, wrapping at the modulus."""
    return [serial_add(start, i) for i in range(count)]


def serial_gap(a: int, b: int) -> int:
    """Forward distance from serial a to serial b on the wrapping counter."""
    return (b - a) % SERIAL_MOD


def case_number(prefix: str, code: str, serial: int) -> str:
    """Assemble a padded case number: ('G-100-', '26240', 200246) ->
    'G-100-26240-200246'."""
    return f"{prefix}{code}-{fmt_serial(serial)}"


def newer(a: tuple[str, int], b: tuple[str, int]) -> tuple[str, int]:
    """The later of two (day_code, serial) frontiers. The day code decides;
    within one day the serial does, and a wrap inside a day (serial near
    the modulus followed by a tiny one) is still ordered by the day."""
    if a[0] != b[0]:
        return a if a[0] > b[0] else b
    # Same day: prefer the serial closest ahead on the ring. Treat a jump of
    # more than half the ring as a wrap (the smaller number is newer).
    return a if serial_gap(b[1], a[1]) < SERIAL_MOD // 2 else b
