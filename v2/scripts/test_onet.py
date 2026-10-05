#!/usr/bin/env python3
"""ingest_onet.parse against a two-occupation release built here.

Run: python3 scripts/test_onet.py
"""
from __future__ import annotations

import io
import json
import pathlib
import sys
import zipfile

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import ingest_onet as onet  # noqa: E402

FAILS: list[str] = []
N = 0


def check(label, got, want):
    global N
    N += 1
    if got != want:
        FAILS.append(f"{label}: got {got!r}, want {want!r}")


FILES = {
    "occupation_data.csv": 'O*NET-SOC Code,Title,Description\n'
    '15-1252.00,Software Developers,"Research, design, and develop computer software."\n'
    '11-1011.03,Chief Sustainability Officers,Coordinate sustainability.\n'
    + "".join(f"13-20{i:02d}.00,Filler {i},Filler.\n" for i in range(4))
    + 'bad-code,Junk,No\n',
    "job_zones.csv": "O*NET-SOC Code,Title,Job Zone,Date,Domain Source\n"
    "15-1252.00,Software Developers,4,08/2023,Analyst\n"
    + "".join(f"13-20{i:02d}.00,Filler {i},3,08/2023,Analyst\n" for i in range(4)),
    "job_zone_reference.csv": "Job Zone,Name,Experience,Education,Job Training,Examples,SVP Range\n"
    "1,Zone One,None,HS,Days,x,1\n2,Zone Two,Some,HS,Months,x,2\n3,Zone Three,Med,Voc,Years,x,3\n"
    "4,Job Zone Four: Considerable Preparation Needed,Minimum of two to four years,Bachelor's degree,Several years,x,4\n",
    "education_categories.csv": "Element ID,Element Name,Scale ID,Scale Name,Category,Category Description\n"
    "2.D.1,Required Level of Education,RL,RL,2,High School Diploma\n"
    "2.D.1,Required Level of Education,RL,RL,6,Bachelor's Degree\n"
    "2.D.1,Required Level of Education,RL,RL,7,Post-Baccalaureate Certificate\n"
    "2.D.1,Required Level of Education,RL,RL,8,Master's Degree\n",
    "education.csv": "O*NET-SOC Code,Title,Element ID,Element Name,Scale ID,Scale Name,Category,Data Value,N,"
    "Standard Error,Lower CI Bound,Upper CI Bound,Recommend Suppress,Date,Domain Source\n"
    "15-1252.00,SD,2.D.1,RL,RL,RL,8,30.4,20,,,,N,x,y\n"
    "15-1252.00,SD,2.D.1,RL,RL,RL,6,64.6,20,,,,N,x,y\n"
    "15-1252.00,SD,2.D.1,RL,RL,RL,2,4.9,20,,,,N,x,y\n"
    "15-1252.00,SD,2.D.1,RL,RL,RL,7,50,20,,,,Y,x,y\n",
    "sample_of_reported_titles.csv": "O*NET-SOC Code,Title,Reported Job Title,Shown in My Next Move\n"
    "15-1252.00,SD,Application Developer,N\n15-1252.00,SD,Software Engineer,Y\n15-1252.00,SD,Software Engineer,N\n",
    "task_statements.csv": "O*NET-SOC Code,Title,Task ID,Task,Task Type,Incumbents Responding,Date,Domain Source\n"
    "15-1252.00,SD,1,Low task.,Core,1,x,y\n15-1252.00,SD,2,Top task.,Core,1,x,y\n"
    "15-1252.00,SD,3,Supplemental task.,Supplemental,1,x,y\n",
    "task_ratings.csv": "O*NET-SOC Code,Title,Task ID,Task,Scale ID,Scale Name,Category,Data Value,N,Standard Error,"
    "Lower CI Bound,Upper CI Bound,Recommend Suppress,Date,Domain Source\n"
    "15-1252.00,SD,1,Low task.,IM,Importance,,3.1,5,,,,N,x,y\n"
    "15-1252.00,SD,2,Top task.,IM,Importance,,4.6,5,,,,N,x,y\n"
    "15-1252.00,SD,3,Supplemental task.,IM,Importance,,5.0,5,,,,N,x,y\n",
    "related_occupations.csv": "O*NET-SOC Code,Title,Related O*NET-SOC Code,Related Title,Relatedness Tier,Index\n"
    "15-1252.00,SD,15-1253.00,Software QA Analysts,Primary-Short,2\n"
    "15-1252.00,SD,15-1251.00,Computer Programmers,Primary-Short,1\n",
}
BRIGHT = [{"Code": "15-1252.00", "Occupation": "Software Developers", "Categories": "Rapid Growth; Numerous Job Openings"}]


def release(files=FILES) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        for name, text in files.items():
            z.writestr(f"db_31_0_csv/{name}", text)
    return buf.getvalue()


def main() -> int:
    rows, ref = onet.parse(release(), BRIGHT, min_occupations=6)
    by = {r[0]: r for r in rows}
    check("only well-formed O*NET-SOC codes are kept", len(by), 6)
    check("and the junk one is not", "bad-code" in by, False)
    sd = by["15-1252.00"]
    check("soc7 is the six-digit SOC code", sd[1], "15-1252")
    check("job zone", sd[4], 4)
    check("an occupation with no zone has none", by["11-1011.03"][4], None)
    check("bright outlook categories", sd[5], "Rapid Growth; Numerous Job Openings")
    check("no bright outlook is None", by["11-1011.03"][5], None)
    d = json.loads(sd[6])
    check("education: suppressed and under-5% rows dropped, in level order",
          d["education"], [{"level": "Bachelor's Degree", "pct": 65}, {"level": "Master's Degree", "pct": 30}])
    check("titles: shown in My Next Move first, no repeats", d["titles"], ["Software Engineer", "Application Developer"])
    check("tasks: core only, by importance", d["tasks"], ["Top task.", "Low task."])
    check("related: by O*NET's own order", [r["code"] for r in d["related"]], ["15-1251.00", "15-1253.00"])
    check("the zone reference carries DOL's wording", ref["jobZones"]["4"]["education"], "Bachelor's degree")
    check("no bright list loads without it", {r[0]: r for r in onet.parse(release(), None, min_occupations=6)[0]}["15-1252.00"][5], None)

    for label, files, minimum in [
        ("a short release is refused", FILES, 7),
        ("a release missing its Job Zones is refused",
         {**FILES, "job_zones.csv": "O*NET-SOC Code,Title,Job Zone,Date,Domain Source\n"}, 6),
        ("a release missing a file is refused",
         {k: v for k, v in FILES.items() if k != "task_statements.csv"}, 6),
    ]:
        try:
            onet.parse(release(files), BRIGHT, min_occupations=minimum)
            refused = False
        except onet.Refusal:
            refused = True
        check(label, refused, True)
    check("version from the link name", onet.version_of("db_31_0_csv.zip"), "31.0")
    page = ('<a href="/dl_files/database/db_31_0_excel.zip" data-href-csv="/dl_files/database/db_31_0_csv.zip">'
            '"contentURL" : "https://www.onetcenter.org/dl_files/database/db_30_2_csv.zip"'
            '<a href="/dl_files/database/db_31_0_csv/software_skills.csv">')
    check("the CSV zip is found where the page names it, not only in an href",
          onet.csv_zip_url(page), "https://www.onetcenter.org/dl_files/database/db_31_0_csv.zip")
    check("a page naming none gives None", onet.csv_zip_url('<a href="/x.zip">'), None)

    print(f"{N} checks")
    for f in FAILS:
        print("FAIL", f)
    if FAILS:
        return 1
    print("all checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
