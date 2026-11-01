#!/usr/bin/env python3
"""The header builder's end rules, on drawn pictures (no capture needed).

    python3 scripts/test_article_heroes.py

drop_orphan_end takes off a stray section rule a capture caught under a wide gap, and must leave a
box's own bottom edge alone: on Nov 1 2026 it cut the frame off the Cloudera chart.
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw  # noqa: E402

import make_article_heroes as m  # noqa: E402

FAILS: list[str] = []


def check(cond: bool, what: str) -> None:
    print(("ok   " if cond else "FAIL ") + what)
    if not cond:
        FAILS.append(what)


PAPER = (250, 250, 250)
INK = (20, 20, 20)

lone = Image.new("RGB", (800, 600), PAPER)
d = ImageDraw.Draw(lone)
d.rectangle((40, 40, 760, 440), fill=(30, 30, 30))
d.rectangle((40, 520, 760, 522), fill=INK)
check(m.drop_orphan_end(lone).height < 520, "a lone rule under a wide gap is taken off")

# Shaped like the capture that lost its edge: a wide box whose 2px sides leave its inside rows reading
# blank, the chart well above a white band, and the bottom edge alone at the foot.
framed = Image.new("RGB", (1872, 600), PAPER)
d = ImageDraw.Draw(framed)
d.rectangle((60, 40, 1810, 560), fill=(255, 255, 255), outline=INK, width=2)
d.rectangle((100, 80, 1700, 440), fill=(30, 30, 30))
check(m.drop_orphan_end(framed).height == 600, "a framed box keeps its bottom edge")

print(f"\n{len(FAILS)} failed")
sys.exit(1 if FAILS else 0)
