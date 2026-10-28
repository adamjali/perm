"""build_pwd_links.plan: the window, the floor, the clients and the quiet-period counts."""
from __future__ import annotations

import sys

import build_pwd_links as B


def case(i: int, *, employer="acme", attorney="firm-a", soc="15-1252", determined="2024-01-10",
         filed="2024-06-01", ad2="2024-04-07"):
    return {
        "employer": employer, "attorney": attorney, "occupation": soc,
        "determined": determined, "filed": filed, "decided": "2025-06-01",
        "ad1": "2024-03-31", "ad2": ad2, "job_order_end": "2024-04-15", "recr_steps": None,
    }


failures = []


def check(name, cond):
    print(("ok   " if cond else "FAIL ") + name)
    if not cond:
        failures.append(name)


START, END = "2023-10-01", "2024-03-31"
cases = [case(i) for i in range(12)]
# Outside the window: never counted, whoever filed it.
cases += [case(100 + i, determined="2024-09-01", filed="2024-10-01") for i in range(5)]
# A gap no plan explains (DOL typo): left out of the timing, still a link.
cases.append(case(200, filed="2030-01-01"))
# A second employer under the floor.
cases += [case(300 + i, employer="tiny") for i in range(3)]
rows = {(r[0], r[1]): dict(zip(B.COLS, r)) for r in B.plan(cases, START, END)}

acme = rows.get(("employer", "acme"))
check("employer row written", acme is not None)
check("only the window's cases count", acme and acme["linked"] == 12)
check("determination to filing, days", acme and acme["pwd_to_perm_p50"] == 143)
check("quiet period ends 30 days after the last step (the job order)", acme and acme["quiet_to_file_p50"] == 17)
check("filed within 14 days of the quiet end: none", acme and acme["quiet_within"] == 0)
check("window edges on the row", acme and (acme["from_day"], acme["to_day"]) == (START, END))
check("firm row counts its clients", rows.get(("attorney", "firm-a"), {}).get("clients") == 2)
check("an employer row carries no client count", acme and acme["clients"] is None)
check("under the floor: no row", ("employer", "tiny") not in rows)
check("every case row", rows.get(("all", "")) is not None and rows[("all", "")]["linked"] == 15)

# Filed the day the quiet period ends: inside two weeks.
quick = [case(400 + i, filed="2024-05-15") for i in range(10)]
row = {(r[0], r[1]): dict(zip(B.COLS, r)) for r in B.plan(quick, START, END)}[("employer", "acme")]
check("within two weeks counted", row["quiet_within"] == 10 and row["quiet_to_file_p50"] == 0)

sys.exit(1 if failures else 0)
