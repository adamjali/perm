#!/usr/bin/env python3
"""Nothing may follow a script's `if __name__ == "__main__":` guard.

    python3 scripts/test_main_guard.py

When a script runs, the guard calls main() and usually sys.exit(), so any
definition BELOW it never executes. pyflakes cannot see this: the name IS
defined at module level, just too late. build_entity_detail.py defined
refresh_recent_12m under its guard from 2026-09-07 to 09-23; every nightly
call raised NameError inside a try/except that logged "recent_12m refresh
FAILED" while the run reported ok, and the 12-month counts on every employer
and firm page froze for sixteen days.
"""
from __future__ import annotations

import ast
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent


def is_main_guard(node: ast.stmt) -> bool:
    if not isinstance(node, ast.If):
        return False
    t = node.test
    return (isinstance(t, ast.Compare) and isinstance(t.left, ast.Name) and t.left.id == "__name__"
            and len(t.comparators) == 1 and isinstance(t.comparators[0], ast.Constant)
            and t.comparators[0].value == "__main__")


def trailing(tree: ast.Module) -> list[str]:
    """What sits after the guard, as 'line N: kind'. Empty when the guard is last."""
    body = tree.body
    for i, node in enumerate(body):
        if is_main_guard(node):
            return [f"line {n.lineno}: {type(n).__name__}" for n in body[i + 1:]]
    return []


def main() -> int:
    failures: list[str] = []

    # The checker first, on two fixtures: it must flag the shape that broke
    # and pass the shape that works, or a clean sweep proves nothing.
    bad = ast.parse('def main():\n    pass\n\nif __name__ == "__main__":\n    main()\n\ndef late():\n    pass\n')
    good = ast.parse('def main():\n    pass\n\ndef early():\n    pass\n\nif __name__ == "__main__":\n    main()\n')
    if not trailing(bad):
        failures.append("the checker missed a definition after the guard")
    if trailing(good):
        failures.append("the checker flagged a guard that is already last")

    scanned = 0
    for path in sorted(HERE.glob("*.py")):
        try:
            tree = ast.parse(path.read_text(encoding="utf-8"))
        except SyntaxError as exc:
            failures.append(f"{path.name}: does not parse ({exc})")
            continue
        scanned += 1
        after = trailing(tree)
        if after:
            failures.append(f"{path.name}: code after the __main__ guard at {', '.join(after)}")
    if scanned < 50:
        failures.append(f"scanned only {scanned} scripts; the glob is probably wrong")

    for f in failures:
        print("  FAIL " + f)
    print(f"\n{scanned} scripts scanned; " + ("ALL PASS" if not failures else f"{len(failures)} FAILURE(S)"))
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
