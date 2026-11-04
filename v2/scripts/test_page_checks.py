"""page_checks.run keeps a failing check's findings, not only its last lines.

Oct 26 2026: the phone sweep failed on two pages at 390px, and the morning
report showed its last 12 lines, every one a clean 320px page.
"""
import sys

import page_checks as pc


def main() -> int:
    failures: list[str] = []
    lines = [f"390 /page-{i}  overflow=0px  small=0  taps=0" for i in range(5)]
    lines += ["390 /visa-bulletin  overflow=0px  small=0  taps=1", "    tap: input 23px \"\""]
    lines += [f"320 /page-{i}  overflow=0px  small=0  taps=0" for i in range(14)]
    script = "import sys\n" + "".join(f"print({ln!r})\n" for ln in lines) + "sys.exit(1)\n"
    phone = next(c for c in pc.checks("https://example.test") if c["key"] == "phone")
    r = pc.run({**phone, "cmd": [sys.executable, "-c", script]})
    if not any("taps=1" in ln for ln in r["tail"]) or not any("tap: input" in ln for ln in r["tail"]):
        failures.append(f"a failing phone sweep's report keeps the page with the finding (got {r['tail']})")
    if any("taps=0" in ln for ln in r["tail"]):
        failures.append("a failing phone sweep's report leaves out the clean pages")
    # Nov 1 2026: each line ends with the page's load time; a clean line with it is still clean.
    timed = [f"390 /page-{i}  overflow=0px  small=0  taps=0  (3.{i} s)" for i in range(4)] + ["390 /bad  overflow=12px  small=0  taps=0  (4.0 s)"]
    script_t = "import sys\n" + "".join(f"print({ln!r})\n" for ln in timed) + "sys.exit(1)\n"
    rt = pc.run({**phone, "cmd": [sys.executable, "-c", script_t]})
    if any("overflow=0px" in ln for ln in rt["tail"]) or not any("/bad" in ln for ln in rt["tail"]):
        failures.append(f"a clean line that carries its load time is left out of the report (got {rt['tail']})")
    # Nov 2 2026: each line also counts covered text; a clean line with covered=0 is still clean, and on that
    # morning's deploy the clean lines filled the report and hid the finding.
    covered = [f"390 /page-{i}  overflow=0px  small=0  taps=0  covered=0  (2.{i} s)" for i in range(4)] + ["390 /hid  overflow=0px  small=0  taps=0  covered=1  (2.9 s)"]
    script_c = "import sys\n" + "".join(f"print({ln!r})\n" for ln in covered) + "sys.exit(1)\n"
    rc = pc.run({**phone, "cmd": [sys.executable, "-c", script_c]})
    if any("covered=0" in ln for ln in rc["tail"]) or not any("/hid" in ln for ln in rc["tail"]):
        failures.append(f"a clean line that counts covered text is left out of the report (got {rc['tail']})")
    # Nov 3 2026: a sweep that runs out of time says how far it got and its slowest loads.
    slow = [f"390 /page-{i}  overflow=0px  small=0  taps=0  covered=0  ({i}.5 s)" for i in range(8)]
    script_s = "import sys, time\n" + "".join(f"print({ln!r}, flush=True)\n" for ln in slow) + "time.sleep(30)\n"
    rs = pc.run({**phone, "cmd": [sys.executable, "-c", script_s], "limit": 3})
    if rs["exit"] != -1 or not any("reached 8 page loads" in ln for ln in rs["tail"]) or not any("/page-7" in ln for ln in rs["tail"]):
        failures.append(f"a sweep that ran out of time names how far it got and its slowest page (got {rs['tail']})")
    clean = pc.run({**phone, "cmd": [sys.executable, "-c", "import sys\nprint('320 / overflow=0px  small=0  taps=0')\nsys.exit(1)\n"]})
    if not clean["tail"]:
        failures.append("a failure with no finding lines still reports what it printed")
    # Oct 31 2026: a failed browser flow reached the report as "17 passed", the
    # line reporter's last line. Its findings are the failing test and its error.
    flows = next(c for c in pc.checks("https://example.test") if c["key"] == "flows")
    out = [
        "Running 18 tests using 1 worker",
        "  1) [chromium] \u203a tests/e2e/public-flows.spec.ts:18:1 \u203a the case lookup answers a real case number",
        "    Error: expect(locator).toBeVisible() failed",
        "    Locator: getByText('The record')",
        "  1 failed",
        "    [chromium] \u203a tests/e2e/public-flows.spec.ts:18:1 \u203a the case lookup answers a real case number",
        "  17 passed (2.1m)",
    ]
    script = "import sys\n" + "".join(f"print({ln!r})\n" for ln in out) + "sys.exit(1)\n"
    r = pc.run({**flows, "cmd": [sys.executable, "-c", script], "env": {}})
    found = r.get("findings") or []
    if not (found and "the case lookup answers" in found[0] and any(f.startswith("Error:") for f in found)):
        failures.append(f"a failing flow's report names the test and its error (got {found})")
    if any("passed" in f for f in found):
        failures.append("a failing flow's findings leave out the passing count")
    passing = pc.run({**flows, "cmd": [sys.executable, "-c", "print('  1) [chromium] x')"], "env": {}})
    if "findings" in passing:
        failures.append("a check that passed carries no findings")
    for f in failures:
        print("FAIL", f)
    print("ALL PASS" if not failures else f"{len(failures)} failed")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
