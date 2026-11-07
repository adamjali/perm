#!/usr/bin/env python3
"""The two CLAUDE.md files stay small, and every notes file they point to exists.

    python3 scripts/test_instruction_size.py

Every Claude Code session in this project loads ../CLAUDE.md and v2/CLAUDE.md
before anything else. By Nov 7 2026 the two had grown to 972 KB (10,742 lines
in v2 alone) because every session appended its lessons there, and a reopened
session failed with "Prompt is too long". The history moved word for word to
docs/notes/, one file per area. This test keeps it there: a lesson goes in its
notes file, and only a standing decision or a rule every change follows goes
in a CLAUDE.md, one line each.
"""
from __future__ import annotations

import pathlib
import re
import sys

V2 = pathlib.Path(__file__).resolve().parents[1]
ROOT = V2.parent
NOTES = V2 / "docs" / "notes"

LIMITS = {ROOT / "CLAUDE.md": 16_000, V2 / "CLAUDE.md": 40_000}


def too_big(text: str, limit: int) -> bool:
    return len(text.encode("utf-8")) > limit


def notes_links(text: str, prefix: str) -> set[str]:
    """Every notes file a CLAUDE.md links to, by file name."""
    return set(re.findall(re.escape(prefix) + r"([a-z0-9-]+\.md)", text))


def main() -> int:
    fails: list[str] = []

    # The detector must see an oversized file, or a pass means nothing.
    if not too_big("x" * 40_001, 40_000) or too_big("x" * 40_000, 40_000):
        fails.append("control: too_big() misjudges a file at its limit")

    for path, limit in LIMITS.items():
        if not path.exists():
            fails.append(f"{path.relative_to(ROOT)} is missing")
            continue
        size = len(path.read_bytes())
        print(f"{path.relative_to(ROOT)}: {size:,} bytes (limit {limit:,})")
        if size > limit:
            fails.append(f"{path.relative_to(ROOT)} is {size:,} bytes, over {limit:,}: move the detail to "
                         "v2/docs/notes/<area>.md and keep one line here")

    files = sorted(p.name for p in NOTES.glob("*.md") if p.name != "README.md")
    print(f"notes files: {len(files)}")
    if len(files) < 9:
        fails.append(f"only {len(files)} notes files in {NOTES.relative_to(ROOT)}; expected the ten areas")

    linked_v2 = notes_links((V2 / "CLAUDE.md").read_text(), "docs/notes/")
    linked_root = notes_links((ROOT / "CLAUDE.md").read_text(), "v2/docs/notes/")
    readme = (NOTES / "README.md").read_text() if (NOTES / "README.md").exists() else ""
    if not readme:
        fails.append("docs/notes/README.md is missing")
    linked_readme = set(re.findall(r"\]\(([a-z0-9-]+\.md)\)", readme))

    for name in sorted(linked_v2 | linked_root | linked_readme):
        if name != "README.md" and not (NOTES / name).exists():
            fails.append(f"a link names docs/notes/{name}, which doesn't exist")
    for name in files:
        if name not in linked_readme:
            fails.append(f"docs/notes/{name} isn't listed in docs/notes/README.md")
        if name not in linked_v2:
            fails.append(f"docs/notes/{name} isn't in v2/CLAUDE.md's table of notes")
        first = (NOTES / name).read_text().split("\n", 1)[0]
        if not first.startswith("# "):
            fails.append(f"docs/notes/{name} doesn't open with a '# ' title")

    for f in fails:
        print("FAIL", f)
    if fails:
        return 1
    print("ok: both CLAUDE.md files under their limits, every notes file linked and present")
    return 0


if __name__ == "__main__":
    sys.exit(main())
