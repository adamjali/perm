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
    clean = pc.run({**phone, "cmd": [sys.executable, "-c", "import sys\nprint('320 / overflow=0px  small=0  taps=0')\nsys.exit(1)\n"]})
    if not clean["tail"]:
        failures.append("a failure with no finding lines still reports what it printed")
    for f in failures:
        print("FAIL", f)
    print("ALL PASS" if not failures else f"{len(failures)} failed")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
